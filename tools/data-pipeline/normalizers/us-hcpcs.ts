/**
 * Normalizer: us/hcpcs — HCPCS Level II quarterly code set (CMS).
 *
 * Source: quarterly ZIP linked from the CMS quarterly-update page; the ZIP
 * contains HCPC<year>_<MON>_ANWEB_*.xlsx (corrections/transaction workbooks
 * are ignored). The download link is resolved from the landing page
 * (pattern /files/zip/<month>-<year>-alpha-numeric-hcpcs-file.zip).
 * The code file carries no prices (fee schedules are separate CMS datasets).
 */
import * as XLSX from 'xlsx';
import { fetchText, fetchToFile, findFile, unzipToTemp } from '../lib/fetch';
import type { NormalizeContext, NormalizeResult } from '../lib/types';
import { NeedsLocalFileError } from '../lib/util';

const MONTHS: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function isoDate(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  return /^\d{8}$/.test(raw) ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : undefined;
}

async function resolveZip(ctx: NormalizeContext): Promise<string> {
  if (ctx.localPath) return ctx.localPath;
  if (!ctx.download) throw new NeedsLocalFileError('us/hcpcs: pass --local <zip> or --download');
  const landing = await fetchText(ctx.sourceEntry.landingUrl);
  const match = landing.match(/\/files\/zip\/[a-z]+-\d{4}-alpha-numeric-hcpcs-file[^"']*\.zip/i);
  if (!match) throw new Error('us/hcpcs: no quarterly ZIP link found on the CMS landing page');
  return fetchToFile(new URL(match[0], 'https://www.cms.gov').toString());
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  const notes: string[] = [];
  const zipPath = await resolveZip(ctx);
  const dir = unzipToTemp(zipPath);
  const xlsxPath = findFile(dir, /^HCPC.*ANWEB.*\.xlsx$/i, /correct|transaction/i);

  const fileName = xlsxPath.split('/').pop() ?? '';
  const nameMatch = fileName.match(/HCPC(\d{4})_([A-Z]{3})/i);
  const version =
    ctx.version ??
    (nameMatch ? `${nameMatch[1]}-${MONTHS[nameMatch[2].toUpperCase()] ?? '01'}` : new Date().toISOString().slice(0, 7));

  const workbook = XLSX.readFile(xlsxPath);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);

  const entries: Array<Record<string, unknown>> = [];
  const labels: Record<string, { name: string; shortName: string }> = {};
  for (const row of rows) {
    const code = String(row['HCPC'] ?? '').trim();
    if (!code) continue;
    if (labels[code]) {
      // RECID continuation rows extend the previous code's long description.
      const extra = String(row['LONG DESCRIPTION'] ?? '').trim();
      if (extra) labels[code].name = `${labels[code].name} ${extra}`.trim();
      continue;
    }
    const entry: Record<string, unknown> = {
      code,
      category: code.length >= 5 ? code[0].toUpperCase() : 'modifier',
    };
    const added = isoDate(row['ADD DT']);
    const effective = isoDate(row['ACT EFF DT']);
    const terminated = isoDate(row['TERM DT']);
    if (added) entry.addedDate = added;
    if (effective) entry.effectiveDate = effective;
    if (terminated) entry.terminationDate = terminated;
    const coverage = String(row['COV'] ?? '').trim();
    if (coverage) entry.coverageCode = coverage;
    entries.push(entry);
    labels[code] = {
      name: String(row['LONG DESCRIPTION'] ?? '').trim(),
      shortName: String(row['SHORT DESCRIPTION'] ?? '').trim(),
    };
  }
  notes.push(`parsed ${fileName}`);

  return {
    version,
    entryCount: entries.length,
    notes,
    files: {
      'index.json': {
        list: 'hcpcs',
        jurisdiction: 'us',
        version,
        languages: ['en'],
        source: { file: fileName, landingUrl: ctx.sourceEntry.landingUrl },
        entries,
      },
      'en.json': {
        list: 'hcpcs',
        jurisdiction: 'us',
        version,
        language: 'en',
        entries: labels,
      },
    },
  };
}

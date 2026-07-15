/**
 * Normalizer: fr/lpp — Liste des Produits et Prestations (CNAM / ameli).
 *
 * Source: LPP<nnn>.zip from codage.ext.cnamts.fr (archive number increments
 * per release; the latest is resolved from the download index page). The zip
 * carries dBase tables; we use:
 *   - lpp_fiche_tot<nnn>.dbf — one row per code (CODE_TIPS, NOM_COURT, DATE_FIN, ARBO1-10)
 *   - lpp_histo_tot<nnn>.dbf — tariff history (DEBUTVALID, FINHISTO, TARIF, QTE_MAX, MT_MAX)
 * Current tariff per code = history row with the latest DEBUTVALID whose
 * FINHISTO is empty (still open), falling back to the latest closed row.
 */
import { readDbf, DbfValue } from '../lib/dbf';
import { fetchText, fetchToFile, findFile, unzipToTemp } from '../lib/fetch';
import type { NormalizeContext, NormalizeResult } from '../lib/types';
import { NeedsLocalFileError } from '../lib/util';

const DOWNLOAD_BASE = 'http://www.codage.ext.cnamts.fr/codif/tips/download_file.php?filename=tips/';

async function resolveZip(ctx: NormalizeContext): Promise<{ path: string; archive?: number }> {
  if (ctx.localPath) {
    const numMatch = ctx.localPath.match(/LPP(\d+)\.zip/i);
    return { path: ctx.localPath, archive: numMatch ? Number(numMatch[1]) : undefined };
  }
  if (!ctx.download) throw new NeedsLocalFileError('fr/lpp: pass --local <LPPnnn.zip> or --download');
  const index = await fetchText(ctx.sourceEntry.landingUrl);
  const archives = [...index.matchAll(/LPP(\d+)\.zip/gi)].map((m) => Number(m[1]));
  if (archives.length === 0) throw new Error('fr/lpp: no LPP<nnn>.zip links found on the CNAM index page');
  const latest = Math.max(...archives);
  return { path: await fetchToFile(`${DOWNLOAD_BASE}LPP${latest}.zip`), archive: latest };
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  const notes: string[] = [];
  const { path: zipPath, archive } = await resolveZip(ctx);
  const dir = unzipToTemp(zipPath);

  const fiche = readDbf(findFile(dir, /^lpp_fiche_tot\d+\.dbf$/i));
  const histo = readDbf(findFile(dir, /^lpp_histo_tot\d+\.dbf$/i));

  // Latest applicable tariff row per code (prefer open rows, then latest start).
  const tariffByCode = new Map<string, Record<string, DbfValue>>();
  for (const row of histo.records) {
    const code = String(row.CODE_TIPS ?? '').trim();
    if (!code) continue;
    const current = tariffByCode.get(code);
    const rowOpen = row.FINHISTO === null;
    const curOpen = current ? current.FINHISTO === null : false;
    const rowStart = String(row.DEBUTVALID ?? '');
    const curStart = current ? String(current.DEBUTVALID ?? '') : '';
    if (!current || (rowOpen && !curOpen) || (rowOpen === curOpen && rowStart > curStart)) {
      tariffByCode.set(code, row);
    }
  }

  let latestValidity = '';
  const entries: Array<Record<string, unknown>> = [];
  const labels: Record<string, unknown> = {};
  for (const row of fiche.records) {
    const code = String(row.CODE_TIPS ?? '').trim();
    if (!code) continue;
    const tariffRow = tariffByCode.get(code);
    const entry: Record<string, unknown> = {
      code,
      tariff: tariffRow && typeof tariffRow.TARIF === 'number' ? tariffRow.TARIF : null,
    };
    if (tariffRow?.DEBUTVALID) {
      entry.validFrom = tariffRow.DEBUTVALID;
      if (String(tariffRow.DEBUTVALID) > latestValidity) latestValidity = String(tariffRow.DEBUTVALID);
    }
    const end = (tariffRow?.FINHISTO ?? row.DATE_FIN) as string | null;
    if (end) entry.validUntil = end;
    if (typeof tariffRow?.QTE_MAX === 'number') entry.maxQuantity = tariffRow.QTE_MAX;
    if (typeof tariffRow?.MT_MAX === 'number' && tariffRow.MT_MAX > 0) entry.maxAmount = tariffRow.MT_MAX;
    const hierarchy = [row.ARBO1, row.ARBO2, row.ARBO3]
      .filter((v): v is number => typeof v === 'number' && v > 0)
      .map(String);
    if (hierarchy.length) entry.hierarchy = hierarchy;
    entries.push(entry);
    labels[code] = { name: String(row.NOM_COURT ?? '').trim() };
  }

  const version = ctx.version ?? (latestValidity ? latestValidity.slice(0, 7) : new Date().toISOString().slice(0, 7));
  notes.push(`archive LPP${archive ?? '?'}; ${histo.records.length} tariff-history rows collapsed to current tariffs`);

  return {
    version,
    entryCount: entries.length,
    notes,
    files: {
      'index.json': {
        list: 'lpp',
        jurisdiction: 'fr',
        version,
        currency: 'EUR',
        languages: ['fr'],
        archiveNumber: archive ?? null,
        source: { file: `LPP${archive ?? 'unknown'}.zip`, landingUrl: ctx.sourceEntry.landingUrl },
        entries,
      },
      'fr.json': {
        list: 'lpp',
        jurisdiction: 'fr',
        version,
        language: 'fr',
        entries: labels,
      },
    },
  };
}

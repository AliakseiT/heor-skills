/**
 * Normalizer: ch/migel — Swiss Mittel- und Gegenständeliste (MiGeL), BAG/FOPH.
 *
 * Source format: one Excel workbook with one sheet per language
 * ("MiGeL D" / "MiGeL F" / "MiGeL I"). Columns (0-based):
 *   0    Produktegruppe (main group id, "01")
 *   1    Kategorie (category id, "01.01")
 *   2-6  1.-5. Unterkategorie (deeper hierarchy ids, e.g. "03.07.01", "14.10a")
 *   7    Positions-Nr. ("01.01.01.00.1")
 *   8    L flag (position carries a limitation)
 *   9    Bezeichnung (name; on hierarchy header rows: group name + note)
 *   10   Limitation
 *   11   Menge / Einheit (unit, language-specific)
 *   12   HVB Selbstanwendung (max reimbursement, self-application, CHF)
 *   13   HVB Pflege (max reimbursement, professional care, CHF)
 *   14   Gültig ab (valid from, Excel serial date)
 *
 * Output: index.json (language-independent codes/hierarchy/prices) +
 * de.json / fr.json / it.json (labels), per CONVENTIONS.md §1.
 */
import * as path from 'path';
import XLSX from 'xlsx';
import { cleanText, excelSerialToISO, parseNumberCell, NeedsLocalFileError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

const POSITION_REGEX = /^\d{2}\.\d{2}\.\d{2}\.\d{2}\.\d$/;
const SHEET_LANGS: Array<{ sheet: string; lang: 'de' | 'fr' | 'it' }> = [
  { sheet: 'MiGeL D', lang: 'de' },
  { sheet: 'MiGeL F', lang: 'fr' },
  { sheet: 'MiGeL I', lang: 'it' },
];

interface ParsedEntry {
  code: string;
  parent: string | null;
  limitationFlag: boolean;
  name: string;
  limitation: string | null;
  unit: string | null;
  priceSelfApplication: number | null;
  priceCare: number | null;
  validFrom: string | null;
}

interface ParsedNode {
  id: string;
  level: number;
  parent: string | null;
  name: string;
  note: string | null;
}

function parseSheet(sheet: XLSX.WorkSheet): { entries: ParsedEntry[]; nodes: ParsedNode[] } {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const entries: ParsedEntry[] = [];
  const nodes: ParsedNode[] = [];
  // Stack of active hierarchy ids by column depth (index = column 0..6).
  const stack: Array<string | null> = [null, null, null, null, null, null, null];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const position = cleanText(row[7]);
    const description = cleanText(row[9]);

    if (POSITION_REGEX.test(position)) {
      const deepest = [...stack].reverse().find((id) => id !== null) ?? null;
      entries.push({
        code: position,
        parent: deepest,
        limitationFlag: cleanText(row[8]) === 'L',
        name: description,
        limitation: cleanText(row[10]) || null,
        unit: cleanText(row[11]) || null,
        priceSelfApplication: parseNumberCell(row[12]),
        priceCare: parseNumberCell(row[13]),
        validFrom: excelSerialToISO(row[14]),
      });
      continue;
    }

    // Hierarchy header row: no valid position, but a group id in columns 0..6 and a name.
    if (!description) continue;
    let depth = -1;
    for (let col = 6; col >= 0; col--) {
      if (cleanText(row[col])) {
        depth = col;
        break;
      }
    }
    if (depth === -1) continue;
    const id = cleanText(row[depth]);
    const parent = depth > 0 ? [...stack.slice(0, depth)].reverse().find((v) => v !== null) ?? null : null;
    for (let col = depth; col < stack.length; col++) stack[col] = null;
    stack[depth] = id;

    const [firstLine, ...rest] = description.split('\n');
    nodes.push({
      id,
      level: depth + 1,
      parent,
      name: firstLine.trim(),
      note: rest.join('\n').trim() || null,
    });
  }

  return { entries, nodes };
}

function versionFromFilename(filename: string): string | null {
  const match = filename.match(/per\s+(\d{2})\.(\d{2})\.(\d{4})/);
  if (match) return `${match[3]}-${match[2]}`;
  return null;
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  if (!ctx.localPath) {
    throw new NeedsLocalFileError(
      'ch/migel: the BAG Excel download links are versioned and change per release. ' +
        `Download the current "MiGeL in Excel-Format" from ${ctx.sourceEntry.landingUrl} ` +
        'and pass it with --local <file.xlsx>.'
    );
  }

  const notes: string[] = [];
  const workbook = XLSX.readFile(ctx.localPath);
  const parsed: Partial<Record<'de' | 'fr' | 'it', ReturnType<typeof parseSheet>>> = {};
  for (const { sheet, lang } of SHEET_LANGS) {
    const ws = workbook.Sheets[sheet];
    if (!ws) {
      notes.push(`sheet "${sheet}" (${lang}) not found — language skipped`);
      continue;
    }
    parsed[lang] = parseSheet(ws);
  }
  const master = parsed.de;
  if (!master) throw new Error('ch/migel: German sheet "MiGeL D" is required as master.');

  const version =
    ctx.version ?? versionFromFilename(path.basename(ctx.localPath)) ?? null;
  if (!version) {
    throw new Error(
      'ch/migel: could not derive version from filename (expected "per DD.MM.YYYY"); pass --version YYYY-MM.'
    );
  }

  const languages = SHEET_LANGS.filter(({ lang }) => parsed[lang]).map(({ lang }) => lang);

  const index = {
    list: 'migel',
    jurisdiction: 'ch',
    version,
    currency: 'CHF',
    languages,
    source: {
      file: path.basename(ctx.localPath),
      landingUrl: ctx.sourceEntry.landingUrl,
    },
    hierarchy: master.nodes.map((n) => ({ id: n.id, level: n.level, parent: n.parent })),
    entries: master.entries.map((e) => ({
      code: e.code,
      parent: e.parent,
      limitationFlag: e.limitationFlag,
      prices: { selfApplication: e.priceSelfApplication, care: e.priceCare },
      validFrom: e.validFrom,
    })),
  };

  const files: Record<string, unknown> = { 'index.json': index };

  for (const lang of languages) {
    const sheetData = parsed[lang]!;
    const entryLabels: Record<string, unknown> = {};
    const hierarchyLabels: Record<string, unknown> = {};
    const byCode = new Map(sheetData.entries.map((e) => [e.code, e]));
    for (const masterEntry of master.entries) {
      const localized = lang === 'de' ? masterEntry : byCode.get(masterEntry.code);
      if (!localized) {
        if (lang !== 'de') notes.push(`missing ${lang} translation for position ${masterEntry.code}`);
        continue;
      }
      entryLabels[masterEntry.code] = {
        name: localized.name,
        limitation: localized.limitation,
        unit: localized.unit,
      };
    }
    const nodeById = new Map(sheetData.nodes.map((n) => [n.id, n]));
    for (const masterNode of master.nodes) {
      const localized = lang === 'de' ? masterNode : nodeById.get(masterNode.id);
      if (!localized) {
        if (lang !== 'de') notes.push(`missing ${lang} translation for hierarchy node ${masterNode.id}`);
        continue;
      }
      hierarchyLabels[masterNode.id] = { name: localized.name, note: localized.note };
    }
    files[`${lang}.json`] = {
      list: 'migel',
      jurisdiction: 'ch',
      version,
      language: lang,
      hierarchy: hierarchyLabels,
      entries: entryLabels,
    };
  }

  return { version, files, entryCount: master.entries.length, notes };
}

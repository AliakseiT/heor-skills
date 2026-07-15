/**
 * Normalizer: ch/analysenliste — Swiss Analysenliste (AL), BAG/FOPH.
 *
 * Source format: Excel workbook. Every language edition published by BAG
 * (DE "Analysenliste per …", FR "Liste des analyses …", IT "Elenco delle analisi …")
 * contains the same three sheets: "Deutsch", "Français", "Italiano" —
 * so a single downloaded file yields all three languages.
 *
 * Sheet layout: header row (row 1) with columns:
 *   Kapitel / Unterkapitel | Pos.-Nr. | TP | Bezeichnung | Analysentechnik |
 *   Probenmaterial | Resultat | Anwendungen pro Primärprobe | Limitationen |
 *   Bemerkungen | Kumulierbarkeit | Chemie | Hämatologie | Immunologie | Genetik
 *
 * Output: index.json (codes, chapter, tax points, discipline flags) +
 * de.json / fr.json / it.json (labels), per CONVENTIONS.md §1.
 */
import * as path from 'path';
import XLSX from 'xlsx';
import { cleanText, parseNumberCell, NeedsLocalFileError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

const SHEET_LANGS: Array<{ sheet: string; lang: 'de' | 'fr' | 'it' }> = [
  { sheet: 'Deutsch', lang: 'de' },
  { sheet: 'Français', lang: 'fr' },
  { sheet: 'Italiano', lang: 'it' },
];

const TRUE_VALUES = new Set(['ja', 'oui', 'si', 'sì', 'yes']);

interface ParsedRow {
  code: string;
  chapter: string;
  taxPoints: number | null;
  name: string;
  method: string | null;
  material: string | null;
  result: string | null;
  /** Clean integer if the cell is purely numeric, else null (the column is often free text). */
  applicationsPerSample: number | null;
  /** Raw "applications per primary sample" text — language-specific, kept in labels. */
  applicationsText: string | null;
  limitation: string | null;
  remarks: string | null;
  cumulation: string | null;
  disciplines: { chemistry: boolean; hematology: boolean; immunology: boolean; genetics: boolean };
}

/** Only accept a pure integer/number cell; free text like "1 pro Antigen" → null. */
function pureNumber(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? parseInt(text, 10) : null;
}

function findHeaderRow(rows: unknown[][]): { index: number; cols: Record<string, number> } | null {
  const findCol = (header: string[], patterns: string[]) =>
    header.findIndex((h) => patterns.some((p) => h.toLowerCase().includes(p.toLowerCase())));

  for (let i = 0; i < Math.min(20, rows.length); i++) {
    // Array.from materializes holes in the sparse rows sheet_to_json produces.
    const header = Array.from(rows[i] ?? [], (c) => cleanText(c));
    const pos = findCol(header, ['Pos.-Nr.', 'No. Pos.', 'No. pos.']);
    const desc = findCol(header, ['Bezeichnung', 'Dénomination', 'Denominazione']);
    if (pos === -1 || desc === -1) continue;
    return {
      index: i,
      cols: {
        chapter: findCol(header, ['Kapitel', 'Chapitre', 'Capitoli']),
        pos,
        taxPoints: findCol(header, ['TP', 'PT']),
        desc,
        method: findCol(header, ['Analysentechnik', "Technique d", 'Tecnica d']),
        material: findCol(header, ['Probenmaterial', 'Matériel', 'Campione']),
        result: findCol(header, ['Resultat', 'Résultat', 'Risultato']),
        applications: findCol(header, ['Anwendungen', 'Application', 'Applicazioni']),
        limitation: findCol(header, ['Limitationen', 'Limitation', 'Limitazioni']),
        remarks: findCol(header, ['Bemerkungen', 'Remarques', 'Osservazioni']),
        cumulation: findCol(header, ['Kumulierbarkeit', 'cumul', 'Cumulabilità']),
        chemistry: findCol(header, ['Chemie', 'Chimie', 'Chimica']),
        hematology: findCol(header, ['Hämatologie', 'Hématologie', 'Ematologia']),
        immunology: findCol(header, ['Immunologie', 'Immunologia']),
        genetics: findCol(header, ['Genetik', 'Génétique', 'Genetica']),
      },
    };
  }
  return null;
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): Map<string, ParsedRow> {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const header = findHeaderRow(rows);
  if (!header) throw new Error(`ch/analysenliste: header row not found in sheet "${sheetName}"`);
  const { cols } = header;

  const flag = (row: unknown[], col: number) => TRUE_VALUES.has(cleanText(row[col]).toLowerCase());
  const text = (row: unknown[], col: number) => (col >= 0 ? cleanText(row[col]) || null : null);

  const parsed = new Map<string, ParsedRow>();
  for (let i = header.index + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const code = cleanText(row[cols.pos]);
    if (!code) continue;
    parsed.set(code, {
      code,
      chapter: cleanText(row[cols.chapter]),
      taxPoints: parseNumberCell(row[cols.taxPoints]),
      name: cleanText(row[cols.desc]),
      method: text(row, cols.method),
      material: text(row, cols.material),
      result: text(row, cols.result),
      applicationsPerSample: pureNumber(row[cols.applications]),
      applicationsText: text(row, cols.applications),
      limitation: text(row, cols.limitation),
      remarks: text(row, cols.remarks),
      cumulation: text(row, cols.cumulation),
      disciplines: {
        chemistry: flag(row, cols.chemistry),
        hematology: flag(row, cols.hematology),
        immunology: flag(row, cols.immunology),
        genetics: flag(row, cols.genetics),
      },
    });
  }
  return parsed;
}

const MONTHS: Record<string, string> = {
  // de
  januar: '01', februar: '02', märz: '03', april: '04', mai: '05', juni: '06',
  juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
  // fr
  janvier: '01', février: '02', mars: '03', avril: '04', juin: '06', juillet: '07',
  août: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12',
  // it
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', dicembre: '12',
};

function versionFromFilename(filename: string): string | null {
  const numeric = filename.match(/(\d{1,2})\.(\d{2})\.(\d{4})/);
  if (numeric) return `${numeric[3]}-${numeric[2]}`;
  const named = filename
    .toLowerCase()
    .match(/\d{1,2}(?:er|°|\.)?\s*(?:de\s+)?([a-zäéûù]+)\s+(\d{4})/);
  if (named && MONTHS[named[1]]) return `${named[2]}-${MONTHS[named[1]]}`;
  return null;
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  if (!ctx.localPath) {
    throw new NeedsLocalFileError(
      'ch/analysenliste: the BAG Excel download links are versioned and change per release. ' +
        `Download the current "Analysenliste im Excel-Format" from ${ctx.sourceEntry.landingUrl} ` +
        'and pass it with --local <file.xlsx> (any language edition; all contain all three sheets).'
    );
  }

  const notes: string[] = [];
  const workbook = XLSX.readFile(ctx.localPath);
  const parsed: Partial<Record<'de' | 'fr' | 'it', Map<string, ParsedRow>>> = {};
  for (const { sheet, lang } of SHEET_LANGS) {
    const ws = workbook.Sheets[sheet];
    if (!ws) {
      notes.push(`sheet "${sheet}" (${lang}) not found — language skipped`);
      continue;
    }
    parsed[lang] = parseSheet(ws, sheet);
  }
  const master = parsed.de;
  if (!master) throw new Error('ch/analysenliste: German sheet "Deutsch" is required as master.');

  const version = ctx.version ?? versionFromFilename(path.basename(ctx.localPath));
  if (!version) {
    throw new Error(
      'ch/analysenliste: could not derive version from filename; pass --version YYYY-MM.'
    );
  }

  const languages = SHEET_LANGS.filter(({ lang }) => parsed[lang]).map(({ lang }) => lang);

  const index = {
    list: 'analysenliste',
    jurisdiction: 'ch',
    version,
    currency: 'CHF',
    unit: 'tax-point',
    languages,
    source: {
      file: path.basename(ctx.localPath),
      landingUrl: ctx.sourceEntry.landingUrl,
    },
    entries: [...master.values()].map((e) => ({
      code: e.code,
      chapter: e.chapter,
      taxPoints: e.taxPoints,
      applicationsPerSample: e.applicationsPerSample,
      disciplines: e.disciplines,
    })),
  };

  const files: Record<string, unknown> = { 'index.json': index };

  for (const lang of languages) {
    const langMap = parsed[lang]!;
    const entries: Record<string, unknown> = {};
    for (const code of master.keys()) {
      const localized = langMap.get(code);
      if (!localized) {
        notes.push(`missing ${lang} translation for position ${code}`);
        continue;
      }
      entries[code] = {
        name: localized.name,
        method: localized.method,
        material: localized.material,
        result: localized.result,
        applicationsPerSample: localized.applicationsText,
        limitation: localized.limitation,
        remarks: localized.remarks,
        cumulation: localized.cumulation,
      };
    }
    files[`${lang}.json`] = {
      list: 'analysenliste',
      jurisdiction: 'ch',
      version,
      language: lang,
      entries,
    };
  }

  return { version, files, entryCount: master.size, notes };
}

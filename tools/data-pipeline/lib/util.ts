import * as fs from 'fs';
import * as path from 'path';

/** Excel serial date (1900 system) → ISO date string (UTC). Returns null for non-dates. */
export function excelSerialToISO(value: unknown): string | null {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) return null;
  const ms = Math.round((value - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  const date = new Date(ms);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** Normalize cell text: unify newlines, trim, drop trailing whitespace per line. */
export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

/** Parse a numeric cell (number or localized string). Returns null when empty/invalid. */
export function parseNumberCell(value: unknown): number | null {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const text = String(value ?? '').replace(/[^0-9.,-]/g, '').replace(',', '.');
  if (!text) return null;
  const parsed = parseFloat(text);
  return isNaN(parsed) ? null : parsed;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

export function readJsonFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export interface EntryDiff {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
}

/** Diff two code→value maps (order-insensitive, deep-equal via canonical JSON). */
export function diffEntryMaps(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): EntryDiff {
  const diff: EntryDiff = { added: [], removed: [], changed: [], unchanged: 0 };
  for (const code of Object.keys(after)) {
    if (!(code in before)) diff.added.push(code);
    else if (canonicalJson(before[code]) !== canonicalJson(after[code])) diff.changed.push(code);
    else diff.unchanged++;
  }
  for (const code of Object.keys(before)) {
    if (!(code in after)) diff.removed.push(code);
  }
  return diff;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Format an EntryDiff as a short markdown fragment. */
export function formatDiff(label: string, diff: EntryDiff, sampleLimit = 10): string {
  const sample = (codes: string[]) =>
    codes.length === 0 ? '' : ` (${codes.slice(0, sampleLimit).join(', ')}${codes.length > sampleLimit ? ', …' : ''})`;
  return (
    `- \`${label}\`: +${diff.added.length} added${sample(diff.added)}, ` +
    `-${diff.removed.length} removed${sample(diff.removed)}, ` +
    `~${diff.changed.length} changed${sample(diff.changed)}, ` +
    `${diff.unchanged} unchanged`
  );
}

/** Thrown by a normalizer when it needs a manually downloaded file (--local). */
export class NeedsLocalFileError extends Error {}

/** Thrown by a normalizer that is scaffolded but not yet implemented. */
export class NotImplementedError extends Error {}

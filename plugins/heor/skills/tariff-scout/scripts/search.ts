/**
 * Lexical search over the normalized reimbursement lists in data/.
 *
 * No embeddings (CONVENTIONS.md §2 forbids them by default): this is
 * multi-language token matching with a simple TF-style score. Deterministic
 * and dependency-free.
 *
 * Usage:
 *   npx tsx scripts/search.ts "breast pump" --jurisdiction ch
 *   npx tsx scripts/search.ts "vitamin D" --list ch/analysenliste --lang de --limit 5
 *   npx tsx scripts/search.ts "tire-lait" --json
 *
 * Data location resolution (first hit wins):
 *   --data-dir <dir>  >  env HEOR_DATA_DIR  >  <repo>/data
 *
 * Flags:
 *   --jurisdiction <code>  restrict to one jurisdiction (ch|de|fr|us|...)
 *   --list <jur/list>      restrict to one list (e.g. ch/migel)
 *   --lang <code>          search only this language's labels (default: all present)
 *   --limit <n>            max results (default 10)
 *   --data-dir <dir>       override data root
 *   --json                 machine-readable output
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// plugins/heor/skills/tariff-scout/scripts → repo root is five levels up.
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..', '..');

interface Args {
  query: string;
  jurisdiction?: string;
  list?: string;
  lang?: string;
  limit: number;
  dataDir: string;
  json: boolean;
}

interface Hit {
  jurisdiction: string;
  list: string;
  version: string;
  language: string;
  code: string;
  name: string;
  score: number;
  price: { value: number | null; currency: string; unit?: string | null } | null;
  matchedField: string;
}

/** Lowercase, strip diacritics, split on non-alphanumeric, drop 1-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

/**
 * Score query tokens against a field's tokens.
 * Each query token that appears scores 1 + 0.1 per extra occurrence;
 * an exact substring of the whole query adds a bonus. Multi-language aware
 * because callers run it over each language's concatenated label text.
 */
export function scoreText(queryTokens: string[], fieldText: string): number {
  if (queryTokens.length === 0) return 0;
  const fieldTokens = tokenize(fieldText);
  if (fieldTokens.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const t of fieldTokens) counts.set(t, (counts.get(t) ?? 0) + 1);

  let matched = 0;
  let score = 0;
  for (const qt of queryTokens) {
    const c = counts.get(qt) ?? 0;
    if (c > 0) {
      matched++;
      score += 1 + Math.min(c - 1, 5) * 0.1;
    }
  }
  if (matched === 0) return 0;
  // Reward covering more of the query.
  score *= matched / queryTokens.length;
  // Phrase bonus.
  if (queryTokens.length > 1 && fieldText.toLowerCase().includes(queryTokens.join(' '))) score += 1.5;
  return score;
}

function listDataDirs(dataDir: string, filterJur?: string, filterList?: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dataDir)) return results;
  for (const jur of fs.readdirSync(dataDir)) {
    if (filterJur && jur !== filterJur) continue;
    const jurDir = path.join(dataDir, jur);
    if (!fs.statSync(jurDir).isDirectory()) continue;
    for (const list of fs.readdirSync(jurDir)) {
      const key = `${jur}/${list}`;
      if (filterList && key !== filterList) continue;
      const listDir = path.join(jurDir, list);
      if (!fs.statSync(listDir).isDirectory()) continue;
      // Pick the latest version directory.
      const versions = fs
        .readdirSync(listDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      if (versions.length) results.push(path.join(listDir, versions[versions.length - 1]));
    }
  }
  return results;
}

function priceForCode(index: any, code: string): Hit['price'] {
  const entry = Array.isArray(index.entries)
    ? index.entries.find((e: any) => e.code === code)
    : undefined;
  if (!entry) return null;
  const currency = index.currency ?? '';
  if (entry.prices) {
    const value =
      entry.prices.selfApplication ?? entry.prices.care ?? entry.prices.manufacturerPrice ?? null;
    return { value, currency };
  }
  if (typeof entry.taxPoints === 'number') {
    return { value: entry.taxPoints, currency, unit: index.unit ?? 'tax-point' };
  }
  if (typeof entry.tariff === 'number') return { value: entry.tariff, currency };
  return null;
}

function searchVersionDir(versionDir: string, queryTokens: string[], langFilter: string | undefined): Hit[] {
  const indexPath = path.join(versionDir, 'index.json');
  if (!fs.existsSync(indexPath)) return [];
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  const jurisdiction: string = index.jurisdiction;
  const list: string = index.list;
  const version: string = index.version;
  const languages: string[] = index.languages ?? [];

  const hits: Hit[] = [];
  for (const lang of languages) {
    if (langFilter && lang !== langFilter) continue;
    const langPath = path.join(versionDir, `${lang}.json`);
    if (!fs.existsSync(langPath)) continue;
    const labels = JSON.parse(fs.readFileSync(langPath, 'utf-8'));
    const entries: Record<string, any> = labels.entries ?? {};
    for (const [code, label] of Object.entries(entries)) {
      // Concatenate the label's text fields for scoring.
      const fieldText = Object.values(label as Record<string, unknown>)
        .filter((v): v is string => typeof v === 'string')
        .join(' • ');
      const score = scoreText(queryTokens, fieldText);
      if (score <= 0) continue;
      hits.push({
        jurisdiction,
        list,
        version,
        language: lang,
        code,
        name: (label as any).name ?? code,
        score,
        price: priceForCode(index, code),
        matchedField: 'label',
      });
    }
  }
  return hits;
}

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const args: Args = {
    query: '',
    limit: 10,
    dataDir: process.env.HEOR_DATA_DIR
      ? path.resolve(process.env.HEOR_DATA_DIR)
      : path.join(REPO_ROOT, 'data'),
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--jurisdiction': args.jurisdiction = argv[++i]; break;
      case '--list': args.list = argv[++i]; break;
      case '--lang': args.lang = argv[++i]; break;
      case '--limit': args.limit = parseInt(argv[++i], 10); break;
      case '--data-dir': args.dataDir = path.resolve(argv[++i]); break;
      case '--json': args.json = true; break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
        positional.push(arg);
    }
  }
  args.query = positional.join(' ').trim();
  if (!args.query) throw new Error('Provide a search query, e.g.: search.ts "breast pump" --jurisdiction ch');
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const queryTokens = tokenize(args.query);
  const versionDirs = listDataDirs(args.dataDir, args.jurisdiction, args.list);

  if (versionDirs.length === 0) {
    const msg = `No data found under ${args.dataDir}. Set --data-dir or HEOR_DATA_DIR, or generate data with tools/data-pipeline/refresh.ts.`;
    if (args.json) console.log(JSON.stringify({ query: args.query, dataDir: args.dataDir, results: [], error: msg }, null, 2));
    else console.error(msg);
    process.exit(versionDirs.length === 0 ? 3 : 0);
  }

  const allHits = versionDirs.flatMap((d) => searchVersionDir(d, queryTokens, args.lang));
  // Deduplicate by (list, code): keep the best-scoring language variant.
  const best = new Map<string, Hit>();
  for (const hit of allHits) {
    const key = `${hit.jurisdiction}/${hit.list}:${hit.code}`;
    const existing = best.get(key);
    if (!existing || hit.score > existing.score) best.set(key, hit);
  }
  const results = [...best.values()].sort((a, b) => b.score - a.score).slice(0, args.limit);

  if (args.json) {
    console.log(JSON.stringify({ query: args.query, dataDir: args.dataDir, count: results.length, results }, null, 2));
    return;
  }

  console.log(`Query: "${args.query}"  (data: ${args.dataDir})`);
  console.log(`Searched ${versionDirs.length} list version(s); ${results.length} result(s):\n`);
  if (results.length === 0) {
    console.log('No matches. Try fewer or different terms, or another --lang.');
    return;
  }
  for (const r of results) {
    const price = r.price && r.price.value !== null
      ? `  ${r.price.value} ${r.price.currency}${r.price.unit ? '/' + r.price.unit : ''}`
      : '';
    console.log(`[${r.score.toFixed(2)}] ${r.jurisdiction}/${r.list} ${r.code} (${r.language})  ${r.name}${price}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

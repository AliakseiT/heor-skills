/**
 * Data pipeline orchestrator — the only way data/ is ever written (CONVENTIONS.md §2).
 *
 * For each selected list it:
 *   1. obtains the official source artifact (downloads when the source registry
 *      has a verified download URL and --download is set, otherwise expects --local),
 *   2. runs the per-list normalizer (tools/data-pipeline/normalizers/<jur>-<list>.ts),
 *   3. validates every produced JSON file against tools/data-pipeline/schemas/<list>.schema.json,
 *   4. diffs against the existing files under data/<jur>/<list>/ and prints a change summary,
 *   5. writes data/<jur>/<list>/<version>/{index.json,<lang>.json}.
 *
 * Usage:
 *   npx tsx tools/data-pipeline/refresh.ts --list ch/migel --local path/to/migel.xlsx
 *   npx tsx tools/data-pipeline/refresh.ts --all --download --summary-file refresh-summary.md
 *
 * Flags:
 *   --list <jur/list>     select one list (repeatable). Default with --all: every list in sources.json.
 *   --all                 process every registered list (unimplemented/manual ones are reported as skipped).
 *   --local <file>        path to a manually downloaded source artifact (applies to the single selected list).
 *   --version <YYYY-MM>   override the version derived from the source.
 *   --download            allow network downloads for sources with status "download-verified".
 *   --data-dir <dir>      output root (default: <repo>/data).
 *   --summary-file <file> also write the change summary as markdown (used by CI to fill the PR body).
 *   --dry-run             validate and diff, but do not write.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validate, SchemaObject } from './lib/validate';
import {
  diffEntryMaps,
  formatDiff,
  readJsonFile,
  writeJsonFile,
  NeedsLocalFileError,
  NotImplementedError,
} from './lib/util';
import type { NormalizeContext, NormalizeResult, Normalizer, SourceEntry } from './lib/types';

const PIPELINE_DIR = __dirname;
const REPO_ROOT = path.resolve(PIPELINE_DIR, '..', '..');

interface CliArgs {
  lists: string[];
  all: boolean;
  local?: string;
  version?: string;
  download: boolean;
  dataDir: string;
  summaryFile?: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    lists: [],
    all: false,
    download: false,
    dataDir: path.join(REPO_ROOT, 'data'),
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    switch (arg) {
      case '--list': args.lists.push(next()); break;
      case '--all': args.all = true; break;
      case '--local': args.local = path.resolve(next()); break;
      case '--version': args.version = next(); break;
      case '--download': args.download = true; break;
      case '--data-dir': args.dataDir = path.resolve(next()); break;
      case '--summary-file': args.summaryFile = path.resolve(next()); break;
      case '--dry-run': args.dryRun = true; break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function loadSources(): Record<string, SourceEntry> {
  const raw = readJsonFile(path.join(PIPELINE_DIR, 'sources.json')) as {
    sources: Record<string, SourceEntry>;
  };
  return raw.sources;
}

async function loadNormalizer(key: string): Promise<Normalizer> {
  const moduleName = key.replace('/', '-');
  const mod = await import(path.join(PIPELINE_DIR, 'normalizers', `${moduleName}.ts`));
  if (typeof mod.normalize !== 'function') throw new Error(`Normalizer ${moduleName} has no normalize()`);
  return mod.normalize as Normalizer;
}

function loadSchema(list: string): SchemaObject {
  return readJsonFile(path.join(PIPELINE_DIR, 'schemas', `${list}.schema.json`)) as SchemaObject;
}

async function downloadSource(source: SourceEntry): Promise<string> {
  if (!source.downloadUrl) throw new NeedsLocalFileError('no verified download URL in sources.json');
  const response = await fetch(source.downloadUrl);
  if (!response.ok) throw new Error(`download failed: HTTP ${response.status} for ${source.downloadUrl}`);
  const tempFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'heor-data-')),
    path.basename(new URL(source.downloadUrl).pathname) || 'source.bin'
  );
  fs.writeFileSync(tempFile, Buffer.from(await response.arrayBuffer()));
  return tempFile;
}

/** Extract a code→entry map from a produced file for diffing. */
function entryMap(fileName: string, content: unknown): Record<string, unknown> {
  const data = content as { entries?: unknown };
  if (Array.isArray(data.entries)) {
    return Object.fromEntries(
      (data.entries as Array<{ code: string }>).map((e) => [e.code, e])
    );
  }
  if (data.entries && typeof data.entries === 'object') return data.entries as Record<string, unknown>;
  return {};
}

function latestExistingVersion(listDir: string): string | null {
  if (!fs.existsSync(listDir)) return null;
  const versions = fs
    .readdirSync(listDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return versions[versions.length - 1] ?? null;
}

async function processList(
  key: string,
  source: SourceEntry,
  args: CliArgs,
  summary: string[]
): Promise<void> {
  summary.push(`\n### ${key} — ${source.name}`);
  let localPath = args.local;
  try {
    const normalizer = await loadNormalizer(key);
    if (!localPath && args.download && source.status === 'download-verified' && source.downloadUrl) {
      localPath = await downloadSource(source);
      summary.push(`- downloaded ${source.downloadUrl}`);
    }
    const ctx: NormalizeContext = {
      localPath,
      version: args.version,
      download: args.download,
      sourceEntry: source,
    };
    const result: NormalizeResult = await normalizer(ctx);
    validateResult(source.list, result);

    const listDir = path.join(args.dataDir, source.jurisdiction, source.list);
    const versionDir = path.join(listDir, result.version);
    const previousVersion = latestExistingVersion(listDir);
    const compareDir =
      previousVersion !== null ? path.join(listDir, previousVersion) : null;

    summary.push(`- version: \`${result.version}\` (${result.entryCount} entries)`);
    if (previousVersion && previousVersion !== result.version) {
      summary.push(`- new version directory (previous: \`${previousVersion}\`)`);
    }

    let anyChange = false;
    for (const [fileName, content] of Object.entries(result.files)) {
      const existingPath = compareDir ? path.join(compareDir, fileName) : null;
      if (existingPath && fs.existsSync(existingPath)) {
        const diff = diffEntryMaps(
          entryMap(fileName, readJsonFile(existingPath)),
          entryMap(fileName, content)
        );
        if (diff.added.length || diff.removed.length || diff.changed.length) anyChange = true;
        summary.push(formatDiff(`${result.version}/${fileName} vs ${previousVersion}`, diff));
      } else {
        anyChange = true;
        summary.push(`- \`${result.version}/${fileName}\`: new file (${Object.keys(entryMap(fileName, content)).length} entries)`);
      }
    }
    if (!anyChange) summary.push('- no content changes vs existing data');

    const uniqueNotes = [...new Set(result.notes)];
    for (const note of uniqueNotes.slice(0, 20)) summary.push(`- note: ${note}`);
    if (uniqueNotes.length > 20) summary.push(`- note: … and ${uniqueNotes.length - 20} more`);

    if (!args.dryRun) {
      for (const [fileName, content] of Object.entries(result.files)) {
        writeJsonFile(path.join(versionDir, fileName), content);
      }
      summary.push(`- wrote ${Object.keys(result.files).length} files to \`${path.relative(REPO_ROOT, versionDir)}/\``);
    } else {
      summary.push('- dry run: nothing written');
    }
  } catch (error) {
    if (error instanceof NeedsLocalFileError) {
      summary.push(`- skipped (manual download required): ${error.message}`);
    } else if (error instanceof NotImplementedError) {
      summary.push(`- skipped (normalizer not implemented): ${error.message}`);
    } else {
      summary.push(`- FAILED: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}

function validateResult(list: string, result: NormalizeResult): void {
  const schema = loadSchema(list);
  const defs = (schema.$defs ?? {}) as Record<string, SchemaObject>;
  for (const [fileName, content] of Object.entries(result.files)) {
    const defName = fileName === 'index.json' ? 'index' : 'labels';
    const def = defs[defName];
    if (!def) throw new Error(`schema for ${list} has no $defs.${defName}`);
    const errors = validate(def, content, schema);
    if (errors.length > 0) {
      throw new Error(
        `schema validation failed for ${fileName}:\n  ${errors.slice(0, 15).join('\n  ')}` +
          (errors.length > 15 ? `\n  … and ${errors.length - 15} more` : '')
      );
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sources = loadSources();

  let selected = args.lists;
  if (args.all) selected = Object.keys(sources);
  if (selected.length === 0) {
    console.error('Nothing selected. Use --list <jurisdiction/list> (e.g. --list ch/migel) or --all.');
    console.error(`Registered lists: ${Object.keys(sources).join(', ')}`);
    process.exit(2);
  }
  if (args.local && selected.length !== 1) {
    console.error('--local applies to exactly one --list.');
    process.exit(2);
  }

  const summary: string[] = [`## Data refresh summary (${new Date().toISOString().slice(0, 10)})`];
  for (const key of selected) {
    const source = sources[key];
    if (!source) {
      summary.push(`\n### ${key}\n- FAILED: not registered in sources.json`);
      process.exitCode = 1;
      continue;
    }
    await processList(key, source, args, summary);
  }

  const text = summary.join('\n') + '\n';
  console.log(text);
  if (args.summaryFile) fs.writeFileSync(args.summaryFile, text, 'utf-8');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

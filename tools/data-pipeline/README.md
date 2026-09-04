# Data pipeline

The evergreen mechanism behind `data/`. It fetches (or accepts a local copy of) the official
reimbursement lists, normalizes them to schema-validated JSON, and prints a change summary.
**`data/` is machine-owned — never hand-edit it; fix the pipeline instead** (CONVENTIONS.md §2).

```
sources.json          registry of official sources per jurisdiction+list (URLs, format, cadence, status)
schemas/*.schema.json JSON Schemas ($defs.index for index.json, $defs.labels for <lang>.json)
normalizers/<jur>-<list>.ts  one module per list: official format → { version, files, entryCount, notes }
refresh.ts            orchestrator: download/normalize/validate/diff/write
lib/                  validate.ts (dependency-free JSON-Schema subset), util.ts, types.ts
```

## Output layout

`data/<jurisdiction>/<list>/<version>/` with a language-independent `index.json`
(codes, hierarchy, prices, validity) plus one `<lang>.json` label file per language
(names, descriptions, limitations). Jurisdictions are ISO 3166-1 alpha-2 lowercase;
languages are BCP-47 lowercase.

## Usage

```bash
# One list from a manually downloaded file (the Swiss Excel lists):
npx tsx tools/data-pipeline/refresh.ts --list ch/migel --local path/to/migel.xlsx
npx tsx tools/data-pipeline/refresh.ts --list ch/analysenliste --local path/to/analysenliste.xlsx

# Everything (scheduled CI mode); download-verified sources are fetched, the rest are
# reported as skipped with the reason:
npx tsx tools/data-pipeline/refresh.ts --all --download --summary-file refresh-summary.md

# Validate + diff without writing:
npx tsx tools/data-pipeline/refresh.ts --list ch/migel --local file.xlsx --dry-run
```

Flags: `--list <jur/list>` (repeatable), `--all`, `--local <file>`, `--version <YYYY-MM>`,
`--download`, `--data-dir <dir>`, `--summary-file <file>`, `--dry-run`.

## Source status (`sources.json`)

- `download-verified` — the normalizer fetches data from the official source
  (API or landing-page scrape). `--download` triggers it. Some sources have a
  `downloadUrl` (direct fetch); others resolve their URL internally.
- `landing-verified` — landing page confirmed reachable, but the download link
  is versioned per release; download manually and pass `--local`.
- `verify` — URL/API not yet confirmed.

CH MiGeL and Analysenliste are `landing-verified` (BAG Excel links embed the
release name and change each revision). DE/DiGA (BfArM FHIR API), DE/HMV
(GKV REST API), FR/LPP (CNAM DBF archive), and US/HCPCS (CMS quarterly ZIP)
are all `download-verified` and run automatically in CI.

## CI

`.github/workflows/data-refresh.yml` runs this monthly (and on demand), and opens a PR with the
change summary in the body whenever `data/` changed. Merging is the only maintenance action;
merged updates are released as `data-YYYY-MM-DD` tags.

## Adding / extending a normalizer

1. Add or update the entry in `sources.json`.
2. Write `normalizers/<jurisdiction>-<list>.ts` exporting
   `normalize(ctx): Promise<NormalizeResult>` (see `lib/types.ts`). Throw `NeedsLocalFileError`
   when a manual download is required, `NotImplementedError` while scaffolding.
3. Write `schemas/<list>.schema.json` with `$defs.index` and `$defs.labels`.
4. Run `refresh.ts --list <jur/list> --local <file>` and confirm it validates and writes.

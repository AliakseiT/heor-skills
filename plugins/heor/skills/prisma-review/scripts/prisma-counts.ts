#!/usr/bin/env npx tsx
/**
 * prisma-counts.ts — compute PRISMA 2020 flow-diagram counts for a dossier.
 *
 * Counting logic ported from the HEOR Copilot app
 * (src/ai/flows/prisma-review-flow.ts + src/lib/prisma-utils.ts).
 * Zero runtime dependencies (only node:fs / node:path).
 *
 * Usage:
 *   npx tsx scripts/prisma-counts.ts [dossier-dir]      # default: cwd
 *   npx tsx scripts/prisma-counts.ts [dossier-dir] --json   # counts JSON only
 *
 * Reads (all under <dossier-dir>/prisma/, missing files tolerated):
 *   search-results.json    { searches: [...], duplicatesRemoved: n, records: [...] }
 *                          (a bare array of records is also accepted)
 *   screening.json         [{ id, decision: include|exclude|maybe, reason, screenedBy }]
 *   included-studies.json  [{ id, ..., fullTextRetrieved?: boolean }]
 *
 * Prints counts as JSON, then (unless --json) a ready-to-paste PRISMA 2020
 * mermaid diagram and a markdown table using those exact numbers.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

interface RawRecord {
  id?: string;
  source?: string;          // dossier-format field: pubmed | clinicaltrials | manual | ...
  sourceDatabase?: string;  // legacy app field: PubMed | ClinicalTrials.gov | Other
  title?: string;
  doi?: string;
  pmid?: string;
  nctId?: string;
  isMandatory?: boolean;
  abstract?: string;
}

interface SearchMeta {
  database: string;         // pubmed | clinicaltrials | mandatory | manual
  tier?: string;
  query?: string;
  totalAvailable?: number;  // total hits reported by the database for the query
  retrieved?: number;       // records actually fetched
}

interface SearchResultsFile {
  searches?: SearchMeta[];
  duplicatesRemoved?: number;
  records?: RawRecord[];
}

interface ScreeningEntry {
  id: string;
  decision: 'include' | 'exclude' | 'maybe';
  reason?: string;
  screenedBy?: string;
}

interface IncludedStudy {
  id: string;
  fullTextRetrieved?: boolean;
  [k: string]: unknown;
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

// Same normalization as the source app (prisma-review-flow.ts).
const normalizeTitle = (t?: string) =>
  (t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Dedup key priority: DOI > PMID > NCT > source:id > normalized title.
function dedupKey(rec: RawRecord): string {
  const doi = (rec.doi || '').trim().toLowerCase();
  if (doi) return `doi:${doi}`;
  if (rec.pmid) return `pmid:${rec.pmid}`;
  if (rec.nctId) return `nct:${rec.nctId}`;
  const src = rec.source || rec.sourceDatabase || 'other';
  if (rec.id) return `${src}:${rec.id}`;
  return `title:${normalizeTitle(rec.title)}`;
}

function isOtherSource(rec: RawRecord): boolean {
  if (rec.isMandatory) return true;
  const src = (rec.source || rec.sourceDatabase || '').toLowerCase();
  return src === 'manual' || src === 'mandatory' || src === 'other';
}

function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--json');
  const jsonOnly = process.argv.includes('--json');
  const dossierDir = path.resolve(args[0] || '.');
  const prismaDir = path.join(dossierDir, 'prisma');

  const searchFileRaw = readJson<SearchResultsFile | RawRecord[]>(
    path.join(prismaDir, 'search-results.json')
  );
  const screening =
    readJson<ScreeningEntry[]>(path.join(prismaDir, 'screening.json')) ?? [];
  const included = readJson<IncludedStudy[]>(
    path.join(prismaDir, 'included-studies.json')
  );

  // Accept both the object form and a bare record array.
  const isArray = Array.isArray(searchFileRaw);
  const records: RawRecord[] = isArray
    ? (searchFileRaw as RawRecord[])
    : (searchFileRaw as SearchResultsFile | undefined)?.records ?? [];
  const searches: SearchMeta[] = isArray
    ? []
    : (searchFileRaw as SearchResultsFile | undefined)?.searches ?? [];
  const metaDuplicates = isArray
    ? undefined
    : (searchFileRaw as SearchResultsFile | undefined)?.duplicatesRemoved;

  // --- Identification ---------------------------------------------------
  const isOtherSearch = (s: SearchMeta) =>
    /mandatory|manual|other/i.test(s.database || '');
  const dbSearches = searches.filter((s) => !isOtherSearch(s));
  const otherSearches = searches.filter(isOtherSearch);

  const dbRecords = records.filter((r) => !isOtherSource(r));
  const otherRecords = records.filter(isOtherSource);

  // Prefer database-reported totals (as the source app did with totalCount);
  // fall back to fetched/record counts.
  const recordsIdentifiedDatabases = dbSearches.length
    ? dbSearches.reduce(
        (sum, s) => sum + (s.totalAvailable ?? s.retrieved ?? 0),
        0
      )
    : dbRecords.length;
  const recordsIdentifiedOther = otherSearches.length
    ? otherSearches.reduce(
        (sum, s) => sum + (s.totalAvailable ?? s.retrieved ?? 0),
        0
      )
    : otherRecords.length;
  const totalIdentified = recordsIdentifiedDatabases + recordsIdentifiedOther;

  // --- Deduplication -----------------------------------------------------
  // Recompute over the stored records (catches stragglers), then take the
  // larger of recomputed vs. the recorded meta value.
  const seen = new Set<string>();
  let recomputedDuplicates = 0;
  const uniqueRecords: RawRecord[] = [];
  for (const rec of records) {
    const key = dedupKey(rec);
    if (seen.has(key)) {
      recomputedDuplicates++;
    } else {
      seen.add(key);
      uniqueRecords.push(rec);
    }
  }
  const duplicatesRemoved = Math.max(metaDuplicates ?? 0, recomputedDuplicates);

  // --- Screening ---------------------------------------------------------
  const recordsScreened = uniqueRecords.length;
  // Records identified but never retrieved for screening (beyond duplicates).
  const otherExclusionsBeforeScreening = Math.max(
    0,
    totalIdentified - duplicatesRemoved - recordsScreened
  );

  const decisionFor = new Map<string, ScreeningEntry>();
  for (const e of screening) decisionFor.set(e.id, e);

  let includeCount = 0;
  let excludeCount = 0;
  let maybeCount = 0;
  const exclusionReasons = new Map<string, number>();
  for (const e of screening) {
    if (e.decision === 'include') includeCount++;
    else if (e.decision === 'maybe') maybeCount++;
    else if (e.decision === 'exclude') {
      excludeCount++;
      const reason = (e.reason || 'No reason recorded').trim();
      exclusionReasons.set(reason, (exclusionReasons.get(reason) ?? 0) + 1);
    }
  }
  const unscreened = uniqueRecords.filter(
    (r) => !decisionFor.has(String(r.id))
  ).length;

  // --- Eligibility / inclusion -------------------------------------------
  const reportsSoughtRetrieval = includeCount;
  // Workflow fallback: when a full text cannot be retrieved the study is
  // still assessed/synthesized from its abstract (source app behavior), so
  // "reports not retrieved" is 0; unavailable full texts are informational.
  const reportsNotRetrieved = 0;
  const fullTextUnavailable = included
    ? included.filter((s) => s.fullTextRetrieved === false).length
    : 0;
  const reportsAssessedEligibility = Math.max(
    0,
    reportsSoughtRetrieval - reportsNotRetrieved
  );
  const studiesIncludedSynthesis = included
    ? included.length
    : includeCount;
  const reportsExcludedEligibility = Math.max(
    0,
    reportsAssessedEligibility - studiesIncludedSynthesis
  );

  const counts = {
    recordsIdentifiedDatabases,
    recordsIdentifiedOther,
    totalIdentified,
    duplicatesRemoved,
    otherExclusionsBeforeScreening,
    recordsScreened,
    recordsExcludedScreening: excludeCount,
    screeningExclusionReasons: [...exclusionReasons.entries()].map(
      ([reason, count]) => ({ reason, count })
    ),
    pendingMaybeDecisions: maybeCount,
    unscreenedRecords: unscreened,
    reportsSoughtRetrieval,
    reportsNotRetrieved,
    fullTextUnavailable,
    reportsAssessedEligibility,
    reportsExcludedEligibility,
    studiesIncludedSynthesis,
  };

  console.log(JSON.stringify(counts, null, 2));

  if (maybeCount > 0 || unscreened > 0) {
    console.error(
      `\nWARNING: ${maybeCount} 'maybe' decision(s) and ${unscreened} unscreened record(s) remain. ` +
        `Resolve them (human review) before finalizing the PRISMA diagram.`
    );
  }

  if (jsonOnly) return;

  const reasonLines = counts.screeningExclusionReasons
    .map((r) => `${r.reason}: ${r.count}`)
    .join('<br/>');

  console.log(`
--- mermaid (paste into prisma/prisma-diagram.md) ---

\`\`\`mermaid
flowchart TD
    A["Records identified from databases<br/>(n = ${recordsIdentifiedDatabases})"] --> C
    B["Records identified from other sources<br/>(mandatory references, manual uploads)<br/>(n = ${recordsIdentifiedOther})"] --> C
    C["Records removed before screening:<br/>Duplicates removed (n = ${duplicatesRemoved})<br/>Records not retrieved for screening (n = ${otherExclusionsBeforeScreening})"] --> D
    D["Records screened<br/>(n = ${recordsScreened})"] --> E["Records excluded<br/>(n = ${excludeCount})${reasonLines ? `<br/>${reasonLines}` : ''}"]
    D --> F["Reports sought for retrieval<br/>(n = ${reportsSoughtRetrieval})"]
    F --> G["Reports not retrieved<br/>(n = ${reportsNotRetrieved})"]
    F --> H["Reports assessed for eligibility<br/>(n = ${reportsAssessedEligibility})"]
    H --> I["Reports excluded<br/>(n = ${reportsExcludedEligibility})"]
    H --> J["Studies included in synthesis<br/>(n = ${studiesIncludedSynthesis})"]
\`\`\`

--- markdown table ---

| PRISMA 2020 stage | n |
|---|---|
| Records identified — databases | ${recordsIdentifiedDatabases} |
| Records identified — other sources | ${recordsIdentifiedOther} |
| Duplicates removed | ${duplicatesRemoved} |
| Records not retrieved for screening | ${otherExclusionsBeforeScreening} |
| Records screened | ${recordsScreened} |
| Records excluded at screening | ${excludeCount} |
| Reports sought for retrieval | ${reportsSoughtRetrieval} |
| Reports not retrieved | ${reportsNotRetrieved} |
| Reports assessed for eligibility | ${reportsAssessedEligibility} |
| Reports excluded at eligibility | ${reportsExcludedEligibility} |
| Studies included in synthesis | ${studiesIncludedSynthesis} |
`);
}

main();

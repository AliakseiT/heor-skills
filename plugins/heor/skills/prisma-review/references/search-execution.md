# Search Execution

Ported from the HEOR Copilot app (`src/ai/tools/database-search-tool.ts`). The
*strategy* (tier adaptation, dedup, mandatory references, relevance heuristics)
carries over; the raw API-calling code is replaced by MCP tools with a curl
fallback.

## Tool selection

**Primary path — MCP tools.** Use whatever tools the harness exposes for these
capabilities (the plugin's `.mcp.json` wires the official PubMed connector at
`https://pubmed.mcp.claude.com/mcp` and
`@cyanheads/clinicaltrialsgov-mcp-server`):

- *PubMed search*: search by query string, retrieve title/abstract/authors/
  journal/year/DOI/PMID per record.
- *ClinicalTrials.gov search*: search by query/condition/intervention,
  retrieve NCT ID, brief title, status, conditions, interventions, brief
  summary, study type, phase, enrollment.

Ask the tool for a total hit count where supported — the PRISMA diagram needs
"records identified", not just "records fetched".

**Fallback path — REST via `curl`** (harnesses without those tools). Exact
endpoints as used by the source app:

PubMed (NCBI E-utilities; ≤3 requests/second without an API key — add
`&api_key=$NCBI_API_KEY` if available):

```bash
# 1. Search → total count + PMIDs (retmax = fetch limit, retstart = offset)
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<URL-ENCODED-QUERY>&sort=relevance&retmode=json&retmax=50&retstart=0"
#    → .esearchresult.count (total identified), .esearchresult.idlist

# 2. Fetch details for the PMIDs (XML with abstracts)
curl -s "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=<PMID1,PMID2,...>&retmode=xml&rettype=abstract"
#    Parse per article: PMID, ArticleTitle, AuthorList (LastName+Initials),
#    Journal ISOAbbreviation/Title, PubDate Year, ELocationID[@EIdType=doi],
#    Abstract/AbstractText (may be multiple labeled sections — join them).
```

ClinicalTrials.gov v2:

```bash
# 1. Count-only probe (cheap; drives tier adaptation)
curl -s "https://clinicaltrials.gov/api/v2/studies?query.term=<URL-ENCODED-QUERY>&countTotal=true&pageSize=1&format=json"
#    → .totalCount

# 2. Fetch records (pageSize ≤ 100; paginate with &pageToken=<nextPageToken>)
curl -s "https://clinicaltrials.gov/api/v2/studies?query.term=<URL-ENCODED-QUERY>&fields=NCTId,BriefTitle,Condition,InterventionName,OverallStatus,BriefSummary,ResponsibleParty,LeadSponsor,StudyType,Phase,EnrollmentCount&pageSize=50&format=json"
#    → .studies[].protocolSection.{identificationModule,descriptionModule,
#      statusModule,designModule,conditionsModule,armsInterventionsModule,
#      sponsorCollaboratorsModule}, .nextPageToken

# 3. Optional per-study detail (protocol documents, full description)
curl -s "https://clinicaltrials.gov/api/v2/studies/<NCTID>"
```

## Adaptive tier strategy (runtime thresholds from source)

Start with the **narrow** (default) query from `queries.yaml`. Fetch limit
defaults to 50 records per database (user-adjustable).

- **Too many results** (total > 2× fetch limit): try the narrow tier (if you
  started broader). Keep the narrower result set only if it still returns
  ≥5 (PubMed) / ≥3 (ClinicalTrials.gov) results; otherwise revert.
- **Too few results**: if total < 5 (PubMed) or < 3 (ClinicalTrials.gov),
  promote to the **balanced** tier, then **broad** if still under threshold.
- **ClinicalTrials.gov zero-result fallback** (carried over verbatim in
  spirit): if even broad returns 0, strip the structured syntax and retry a
  basic term search — remove all `AREA[...]` wrappers, boolean operators, and
  parentheses, collapse whitespace; if nothing remains, use
  `"<intervention text> <population text>"` from the PICO. Record in the
  search log that results come from a broad fallback search.
- Record every executed query, its tier, and its total in the `searches`
  block (below) — including abandoned attempts is fine; mark the ones whose
  records you kept with `"used": true`.

## Mandatory references

For each user-supplied mandatory reference (title, DOI, or PMID, one per
line): look it up (PubMed by PMID/DOI, or a title search) and add it as a
record with `isMandatory: true` and `source: "mandatory"`. Mandatory records
bypass exclusion at screening (they may be flagged, but the user decides).
User-uploaded "related publication" documents in `documents/` are injected the
same way with `source: "manual"`.

## Deduplication

Deduplicate across databases before screening. Key priority (first available
wins): DOI (lowercased) → PMID → NCT ID → `source:id` → normalized title
(lowercase, non-alphanumerics collapsed to spaces). Count removed duplicates —
the PRISMA diagram reports them. The same logic is implemented in
`scripts/prisma-counts.ts`; keep the stored `duplicatesRemoved` consistent
with it.

## Relevance ordering (optional, carried over)

Preserve PubMed's native relevance order. For ClinicalTrials.gov, the source
app scored studies for triage (higher = fetch/inspect first):

- Status: completed +100; recruiting +80; active-not-recruiting +70; not yet
  recruiting +60; terminated +30; suspended +20; withdrawn +10; unknown +50.
- Phase: 4 +50; 3 +40; 2 +30; 1 +20; early 1 +15; unknown +25.
- Enrollment: ≥1000 +30; ≥100 +20; ≥10 +10.
- Type: interventional +25; observational +15; expanded access +10.
- Randomized allocation +20 (other stated allocation +5); any masking +15.
- Primary purpose: treatment +15; prevention +12; diagnostic +10.

Use this only to prioritize retrieval/reading order — every unique record
still gets screened.

Very long ClinicalTrials.gov records (>~5,000 chars of protocol text): keep
the brief summary as the screening `abstract`; summarize the full record only
when it is needed later for synthesis, and label the summary as AI-generated.

## OpenAlex citation enrichment (optional, recommended)

The source app enriched every PubMed record with citation-count data from
[OpenAlex](https://openalex.org) — a free, open scholarly metadata API. This
helps with screening triage (highly cited studies are likely seminal) and
provides open-access PDF/HTML links for full-text retrieval.

**When to do it:** after deduplication, before screening. Iterate over the
`records` array and add `citationCount`, `openAlexUrl`, and optionally
`oaPdfUrl` to each PubMed record that has a DOI or title.

**API endpoints** (no API key needed; be polite — 1 request per 400ms max):

```bash
# By DOI (preferred — exact match):
curl -s "https://api.openalex.org/works/https://doi.org/<DOI>" | jq '{cited_by_count, id, best_oa_location: .best_oa_location.url_for_pdf}'

# By title (less reliable — first result):
curl -s "https://api.openalex.org/works?filter=title.search:<URL-ENCODED-TITLE>" | jq '.results[0] | {cited_by_count, id, best_oa_location: .best_oa_location.url_for_pdf}'
```

**Extracted fields:**

| Field | JSON path | Purpose |
|---|---|---|
| Citation count | `.cited_by_count` | Screening triage — highly cited studies are likely seminal |
| OpenAlex URL | `.id` (e.g. `https://openalex.org/W123`) | Permanent link for reference lists |
| OA PDF URL | `.best_oa_location.url_for_pdf` | Full-text retrieval for included studies |
| OA HTML URL | `.best_oa_location.url` | Fallback full-text source |

**Enriched record shape** (add to `search-results.json` records):

```json
{
  "id": "38123456",
  "source": "pubmed",
  "title": "...",
  "doi": "10.1000/xyz",
  "citationCount": 42,
  "openAlexUrl": "https://openalex.org/W123456",
  "oaPdfUrl": "https://..."
}
```

**Rate limiting:** OpenAlex asks for max ~10 requests/second. Add a 400ms
delay between requests (the source app used a simple serial queue with
`OPENALEX_MIN_SPACING_MS = 400`). If a request fails or returns non-200,
skip enrichment for that record — it is optional, not blocking.

**Do NOT use OpenAlex for ClinicalTrials.gov records** — they rarely have
DOIs and the metadata is already complete from the CT API.

## Output: `prisma/search-results.json` (machine-owned — regenerate, never hand-edit)

```json
{
  "searches": [
    {
      "database": "pubmed",
      "tier": "narrow",
      "query": "...",
      "totalAvailable": 132,
      "retrieved": 50,
      "used": true,
      "timestamp": "2026-07-15T12:00:00Z",
      "error": null
    },
    { "database": "clinicaltrials", "tier": "balanced", "query": "...", "totalAvailable": 8, "retrieved": 8, "used": true },
    { "database": "mandatory", "query": "user-provided list", "totalAvailable": 2, "retrieved": 2, "used": true }
  ],
  "duplicatesRemoved": 4,
  "records": [
    {
      "id": "38123456",
      "source": "pubmed",
      "title": "...",
      "abstract": "...",
      "year": 2024,
      "authors": "Smith J, Doe A",
      "url": "https://pubmed.ncbi.nlm.nih.gov/38123456/",
      "journal": "...",
      "doi": "10.1000/xyz",
      "pmid": "38123456"
    },
    {
      "id": "NCT01234567",
      "source": "clinicaltrials",
      "title": "...",
      "abstract": "<brief summary>",
      "year": 2023,
      "url": "https://clinicaltrials.gov/study/NCT01234567",
      "nctId": "NCT01234567",
      "status": "COMPLETED",
      "conditions": ["..."],
      "interventions": ["..."]
    },
    { "id": "doi-10-1000-abc", "source": "mandatory", "title": "...", "isMandatory": true }
  ]
}
```

`records` holds the **deduplicated** set. `source` values: `pubmed`,
`clinicaltrials`, `mandatory`, `manual`. `scripts/prisma-counts.ts` also
accepts a bare array of records (it then derives identification counts from
the records alone), but the object form above yields a correct "records
identified" figure — always prefer it.

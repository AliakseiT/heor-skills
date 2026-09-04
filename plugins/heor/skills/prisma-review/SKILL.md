---
name: prisma-review
description: >-
  Run a PRISMA 2020 systematic literature review for an HTA/HEOR dossier:
  extract a PICO from the dossier and its documents, generate tiered PubMed and
  ClinicalTrials.gov search queries, execute the literature search, screen
  abstracts against PICO criteria (include/exclude/maybe with reasons), build
  the PRISMA 2020 flow diagram, and write a cited narrative synthesis chapter.
  Use for: systematic review, literature review, literature search, PRISMA,
  PICO, evidence synthesis, abstract screening, PubMed search,
  ClinicalTrials.gov search, study selection.
metadata:
  jurisdiction: global
  languages: [en]
  last-verified: 2026-07-15
  version: "1.0.0"
---

# PRISMA Systematic Literature Review

Runs a six-step PRISMA 2020 review inside a dossier directory (see the plugin's
`DOSSIER_FORMAT.md`). Every step reads/writes files under `<dossier>/prisma/`;
missing files never break a step — create them as you go.

Act as a systematic review analyst specializing in Health Technology
Assessment. Two hard rules apply throughout:

1. **Human-in-the-loop.** PICO, queries, and screening decisions are drafts
   until the user confirms them. Never silently finalize.
2. **No mental arithmetic for the diagram.** All PRISMA counts come from
   `scripts/prisma-counts.ts` — never compute or adjust them yourself.

## Inputs

- `dossier.yaml` — intervention, comparator, jurisdictions, `notes` (global
  instructions that apply to every step).
- `documents/` — user-supplied sources (IFU, device description, protocols,
  reports). Read them; they drive PICO inference.
- Optional user-provided: inclusion/exclusion criteria, mandatory references
  (titles/DOIs/PMIDs that MUST end up included), excluded references, a
  "modelling focus" flag (steers PICO/queries/screening toward economic-model
  parameter sources).

## Workflow

### 1. PICO extraction → `prisma/pico.yaml`

Follow `references/pico-extraction.md` (carries the source prompt verbatim,
including the inference rule: never leave an element empty). Present the
proposed PICO to the user and wait for confirmation or edits before moving on.

### 2. Query generation → `prisma/queries.yaml`

Follow `references/query-strategies.md`: build narrow/balanced/broad tiers for
PubMed (MeSH + [tiab] concept blocks) and ClinicalTrials.gov (AREA[] fields),
plus a separate RCT/economic hedge. Precision first: the narrow tier is the
default query. Show the user the queries; confirm or edit.

### 3. Search execution → `prisma/search-results.json`

Follow `references/search-execution.md`.

- **Primary path:** use the available PubMed search tool and
  ClinicalTrials.gov search tool (the plugin wires the official PubMed MCP
  connector and `@cyanheads/clinicaltrialsgov-mcp-server`).
- **Fallback path (no such tools in the harness):** NCBI E-utilities and the
  ClinicalTrials.gov v2 REST API via `curl` — exact endpoints are in the
  reference.

Apply the adaptive tier strategy (escalate/de-escalate on result counts),
resolve mandatory references (look them up by PMID/DOI/title and mark
`isMandatory: true`), deduplicate by DOI → PMID → NCT → source:id →
normalized title, and record per-query totals in the `searches` block — the
counts script needs them.

### 4. Abstract screening → `prisma/screening.json`

Follow `references/screening-rules.md` (carries the screener prompt's decision
rules: sensitivity over specificity, include protocols/pilots, restrict
`maybe`). Screen every unique record against the confirmed PICO; record
`include` / `exclude` / `maybe` with a 1–2 sentence PICO-referencing reason
and `screenedBy: ai`.

**Mandatory user-review checkpoint:** present the screening summary (counts,
all `maybe` records, a sample of excludes) and wait for the user to resolve
`maybe` decisions and confirm before finalizing. Human overrides get
`screenedBy: human`. Do not proceed to step 5 with unresolved `maybe`
decisions.

### 5. PRISMA 2020 diagram → `prisma/prisma-diagram.md`

Run:

```bash
npx tsx scripts/prisma-counts.ts <dossier-dir>
```

(script lives in this skill's `scripts/` directory; it reads the prisma JSON
files, prints the counts, a mermaid diagram, and a table). Paste the script's
mermaid + table output into `prisma/prisma-diagram.md` unchanged, adding a
short methods paragraph (databases, date, tiers used). If the script warns
about pending `maybe`/unscreened records, go back to step 4.

### 6. Narrative synthesis → literature chapter

Follow `references/narrative-synthesis.md`: write
`prisma/included-studies.json` (final set with extraction fields), rank the
included studies (seminal first), then synthesize a narrative in which **every
claim carries a numbered citation** to an included study — no external
knowledge. Write the chapter to `chapters/05-literature-research.<lang>.md`
(language from `dossier.yaml`), including the PRISMA numbers from step 5 and
the inclusion/exclusion criteria.

End the chapter — and your final message — with the standard disclaimer:
*"Draft generated with AI assistance. Expert review by a qualified systematic
reviewer / HEOR professional is required before submission or publication."*

## Scale guidance for screening

- Screen in batches of ~20–25 abstracts per pass; write decisions to
  `prisma/screening.json` after each batch so progress survives interruption.
- Keep the confirmed PICO + criteria in front of every batch; do not paraphrase
  them differently between batches.
- Re-check the first batch after finishing: early decisions drift.
- **Optional, Claude-specific enhancement (skip on other harnesses):** for
  >100 records, dispatch parallel subagents (e.g., the Task/Agent tool), each
  screening one batch with the identical PICO/criteria block and returning
  screening.json fragments; merge and spot-check 10% of each agent's decisions
  before the user checkpoint.

## Failure handling

- A database search that errors → record the error in the `searches` entry,
  continue with the other database, tell the user.
- Record with no abstract → screen as `maybe` with reason "abstract missing;
  full text required" (never silently exclude).
- Full text unavailable at synthesis → fall back to the abstract and flag it
  in `included-studies.json` (`fullTextRetrieved: false`).

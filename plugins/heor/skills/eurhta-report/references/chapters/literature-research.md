# Literature Research

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Literature Research"). If the `prisma-review` skill already produced
`chapters/05-literature-research.<lang>.md`, reuse/refresh that chapter
instead of drafting from scratch.

## Goal (from source)

Describe the search strategy and results.

## Instructions (from source)

- Summarize the PRISMA flow.

  **CRITICAL: Use the EXACT numbers from `prisma/prisma-diagram.md` for the
  PRISMA flow description. Do not invent databases.**
  - Databases searched: PubMed, ClinicalTrials.gov (only what was actually
    searched per the `searches` log in `prisma/search-results.json`)
  - Records identified (total)
  - Duplicates removed
  - Records screened
  - Excluded at screening
  - Reports assessed for eligibility
  - Studies included

  If the diagram file is missing or stale, regenerate it with the
  `prisma-review` skill's `scripts/prisma-counts.ts` — never recount by hand.

- Describe the inclusion/exclusion criteria (from `prisma/queries.yaml`
  `criteria` and the PICO).
- List the included studies (from `prisma/included-studies.json`: author,
  year, design, sample size, key outcomes — a table works well).
- Provide a brief overview of the quality of evidence (designs represented,
  risk-of-bias considerations, limitations).

## Additional content

- Reproduce the search queries actually used (database, tier, date) and the
  mermaid PRISMA diagram from `prisma/prisma-diagram.md`.
- Establish the reference numbering [1]..[n] used by all later chapters
  (rank order from `included-studies.json`).

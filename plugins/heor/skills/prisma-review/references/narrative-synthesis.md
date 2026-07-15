# Ranking and Narrative Synthesis

Ported from the HEOR Copilot app (`src/ai/flows/rank-studies-flow.ts` and
`src/ai/flows/generate-prisma-narrative-flow.ts`).

## Step A — finalize `prisma/included-studies.json`

Take every record whose final screening decision is `include` and write the
final set with extraction fields (machine-owned JSON):

```json
[
  {
    "id": "38123456",
    "source": "pubmed",
    "title": "...",
    "authors": "Smith J, Doe A",
    "journal": "...",
    "year": 2024,
    "doi": "10.1000/xyz",
    "url": "...",
    "abstract": "...",
    "isMandatory": false,
    "fullTextRetrieved": true,
    "fullTextPath": "documents/fulltexts/38123456.md",
    "extraction": {
      "studyDesign": "RCT",
      "sampleSize": 240,
      "population": "...",
      "intervention": "...",
      "comparator": "...",
      "primaryOutcomes": "...",
      "keyResults": "...",
      "modelRelevantParameters": "utilities, per-event costs, ..."
    },
    "rank": 1
  }
]
```

Where full texts are available (user-supplied PDFs in `documents/`, open-access
links), convert/store them and set `fullTextRetrieved`; otherwise
`fullTextRetrieved: false` and synthesize from the abstract.

## Step B — rank studies (source prompt, carried over)

Act as an expert HEOR researcher and systematic reviewer. Given the PICO
summary and each study's content (full text > abstract):

> Your task is to rank these studies based on their relevance and importance
> to the PICO criteria.
> 1. **Identify Seminal Studies:** First, identify any "seminal" or
>    foundational studies. These could be large, well-designed randomized
>    controlled trials (RCTs), pivotal trials cited in guidelines, or
>    highly-cited meta-analyses that directly address the PICO question. These
>    should be ranked highest.
> 2. **Assess Relevance:** For all other studies, assess their direct
>    relevance to each PICO component. Studies that perfectly match the
>    Population, Intervention, Comparison, and Outcomes are more relevant.
> 3. **Consider Study Design:** Give higher weight to studies with more robust
>    designs (e.g., RCTs > observational studies > case reports).
> 4. **Sort the List.**

Integrity rule from the source: every included study keeps its place in the
final set — a study you fail to rank is appended at the end, never dropped.
Record the order in each entry's `rank` field.

## Step C — narrative synthesis (source prompt, carried over)

Act as an expert HEOR researcher writing a narrative synthesis for a
systematic review. Number the included studies [1]..[n] in rank order and work
from their abstracts/full texts:

> 1. Review the provided study abstracts. **The studies are pre-sorted by
>    importance, with the most seminal and relevant studies appearing first.**
> 2. Synthesize a narrative summary based *exclusively* on the information in
>    the provided abstracts.
>    - **Structure your narrative to follow the provided order.** Discuss the
>      most important studies first, then move on to others. You can group
>      studies with similar findings or designs together if it improves the
>      narrative flow, but maintain the overall prioritization.
>    - Compare and contrast findings if appropriate.
>    - **CRITICAL: Every piece of information or claim you make MUST be
>      traceable to one of the provided abstracts. Cite the study using its
>      number in square brackets immediately after the information, e.g., "The
>      study found X [1]." or "Several studies have examined this [2, 3, 4]".**
>    - Do not introduce any external knowledge or information not present in
>      these abstracts.
> 3. The output should be a coherent narrative. Start directly with the
>    synthesis; do not add introductory phrases like "This report
>    summarizes...".

## Step D — write the literature chapter

Write `chapters/05-literature-research.<lang>.md` (language from
`dossier.yaml`; human-owned — never blind-overwrite an edited chapter):

1. `# Literature Research` heading.
2. **Methods**: databases searched (PubMed, ClinicalTrials.gov — do not invent
   others), search date, the queries/tiers actually used (from
   `queries.yaml` + the `searches` log), inclusion/exclusion criteria, and
   the screening approach (AI-assisted, human-reviewed).
3. **PRISMA flow**: the exact counts + mermaid diagram from
   `prisma/prisma-diagram.md` (numbers come from `scripts/prisma-counts.ts`
   only).
4. **Included studies**: table of the final set (author, year, design, n,
   key outcomes).
5. **Narrative synthesis** from Step C, with numbered citations.
6. **Quality of evidence**: brief overview (designs represented, limitations).
7. Reference list mapping [n] → full citation (authors, title, journal, year,
   DOI/NCT).
8. Closing line: *"Draft generated with AI assistance. Expert review by a
   qualified systematic reviewer / HEOR professional is required before
   submission or publication."*

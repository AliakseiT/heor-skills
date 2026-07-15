# Clinical Effectiveness

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Clinical Effectiveness").

## Goal (from source)

Analyze the clinical benefits of the technology.

## Instructions (from source)

- Synthesize evidence from the included clinical studies
  (`prisma/included-studies.json`; use full texts where retrieved, otherwise
  abstracts).
- Compare the technology to the comparator.
- Report on primary and secondary outcomes.
- Assess the certainty of the evidence.

## PRISMA note for the clinical section (from source)

When the review distinguishes clinical vs. economic study subsets, state the
clinical numbers explicitly: the count of clinical studies included in
synthesis and the number of records screened — exact values from
`prisma/prisma-diagram.md` / `included-studies.json` (filter by
`extraction.studyDesign` / model-parameter-only studies).

## Quality bar

- Every effect estimate carries its numbered citation, e.g. "reduced event
  rate by 23% [3]".
- Distinguish statistically significant from non-significant findings; report
  effect sizes with uncertainty where the studies provide them (as reported —
  do not derive new statistics).
- The clinical parameters highlighted here feed the Economic Evaluation
  chapter — flag the values that were used as model inputs
  (`models/inputs/*.json` `source` fields point back to studies).
- Note evidence gaps honestly (small samples, no head-to-head trials,
  surrogate endpoints).

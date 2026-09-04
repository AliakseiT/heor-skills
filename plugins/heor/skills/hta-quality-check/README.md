# hta-quality-check

Scores and consistency-checks a drafted application or report before
submission. The agent acts as the evaluator: reads the draft, applies
rubric criteria, justifies every score with evidence.

## When to use

- "Quality-check the MiGeL draft"
- "Score the application"
- "Check consistency across chapters"
- "Find issues before submission"

## What it produces

A structured review report written as `<name>.review.md` next to the
reviewed document. Includes: per-section scores (0-10), missing fields,
cross-section consistency findings (comparator naming, PRISMA counts, ICER
figures vs. `models/runs/`), and recommendations.

## Rubrics

| Rubric | What it scores |
|---|---|
| ch-migel | MiGeL application, 7 modules scored 0-10 against BAG criteria |
| ch-analysenliste | Analysenliste form, 26 sections |
| ch-antrag-neue-leistung | KLV full application |
| ch-meldung-neue-leistung | KLV notification |
| ch-umstrittenheit | Dispute form |
| consistency | Cross-section: comparator, population, PRISMA counts, economic figures, terminology |

Rubric files live in `references/rubrics/`.

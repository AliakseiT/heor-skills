# Discussion and Conclusions

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Discussion and Conclusions"). Draft after all evidence and economics
chapters.

## Instructions (from source)

- Synthesize the findings from all previous chapters. Discuss the clinical
  effectiveness, safety, and economic value of the intervention.
- Discuss the economic implications based on the CEA results: name the model
  used and the ICER (exact value from the latest run in `models/runs/`).
- Discuss the budget impact: target market and total net budget impact (exact
  values from the latest BIA run), when BIA is in scope.
- Address any limitations in the evidence or the economic models.
- Provide a final concluding statement on the overall value of the
  intervention.

## Quality bar

- No new evidence appears here — only synthesis of what earlier chapters
  established (with their citation numbers where a specific finding is
  invoked).
- Limitations must be concrete: evidence gaps found during PRISMA (small n,
  missing comparators, abstract-only studies), model assumptions from
  `models/inputs/*.json`, parameter uncertainty highlighted by the PSA.
- The conclusion must follow from the report; if the evidence is equivocal,
  the conclusion says so.

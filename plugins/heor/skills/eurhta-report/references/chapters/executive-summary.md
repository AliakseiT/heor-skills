# Executive Summary

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Executive Summary"). Draft this chapter **last** — it depends on every other
chapter.

## Goal (from source)

Provide a high-level overview of the entire HTA report.

## Instructions (from source)

- Summarize the key findings from all other chapters.
- Be concise and impactful.
- Highlight the clinical effectiveness, safety, and economic value.
- Mention the budget impact if applicable.
- If a cost-effectiveness model was run, briefly summarize the economic model
  results (model type, ICER / incremental cost and effect — exact values from
  the latest CEA run in `models/runs/`).
- If a budget impact analysis was run, briefly summarize the budget impact
  (target market, total net budget impact over the analysis horizon — exact
  values from the latest BIA run in `models/runs/`).

## Data sources

- All drafted chapters `chapters/02-*` … `chapters/13-*` (primary input).
- `models/runs/` latest CEA / BIA / PSA outputs for the headline numbers.
- `prisma/prisma-diagram.md` for the evidence-base size (n studies included).

## Quality bar

- One to two pages; a decision-maker should get the whole picture without
  reading further.
- No claims that do not appear in a body chapter.
- End with the expert-review disclaimer (see SKILL.md Step 3).

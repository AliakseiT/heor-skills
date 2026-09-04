# eurhta-report

Drafts a EUnetHTA Core Model HTA report, chapter by chapter, for an HEOR
dossier. 13 chapters from executive summary to discussion and conclusions.

## When to use

- "Draft the HTA report"
- "Write EUnetHTA chapters"
- "Generate the clinical effectiveness chapter"
- "European HTA dossier"

## What it produces

`chapters/<nn>-<slug>.<lang>.md` — one file per chapter. Drafting order
differs from numbering: Literature Research first, Executive Summary last.
Each chapter reads PRISMA counts, economic model results, and included
studies from the dossier.

## Chapters

01 Executive Summary, 02 Introduction, 03 Technology Description, 04 Health
Problem, 05 Literature Research, 06 Clinical Effectiveness, 07 Safety, 08
Economic Evaluation, 09 Ethical Aspects, 10 Organisational Aspects, 11
Social Aspects, 12 Legal Aspects, 13 Discussion and Conclusions.

Instruction files live in `references/chapters/`.

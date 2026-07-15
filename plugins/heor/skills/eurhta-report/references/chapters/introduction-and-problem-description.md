# Introduction and Problem Description

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Introduction and Problem Description").

## Goal (from source)

Define the health problem and the technology.

## Instructions (from source)

- Describe the condition/disease.
- Describe the technology and its mechanism of action.
- Explain the current standard of care.
- State the objective of this assessment.

## Data sources

- `dossier.yaml` — `intervention` (name, description, device class,
  categories) and `comparator` (standard of care).
- `documents/` — device description, IFU, clinical background documents.
- `prisma/pico.yaml` — the population and comparator definitions must be
  consistent with this chapter.

## Quality bar

- The comparator described here is the base-case comparator used in the
  Economic Evaluation chapter — use identical wording.
- Epidemiological or clinical background claims need a source (included study
  or supporting document); do not import unreferenced figures.

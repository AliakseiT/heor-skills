---
name: eurhta-report
description: >-
  Draft a EUnetHTA Core Model HTA report chapter by chapter for an HEOR
  dossier: Executive Summary, Introduction, Technology Description, Health
  Problem, Literature Research, Clinical Effectiveness, Safety, Economic
  Evaluation (CEA/BIA), Ethical/Organisational/Social/Legal aspects, and
  Discussion. Injects PRISMA literature-review numbers and deterministic
  economic-model results, and cites only included studies. Use for: HTA
  dossier, HTA report, EUnetHTA, Core Model, health technology assessment,
  European HTA, joint clinical assessment, dossier chapter drafting.
metadata:
  jurisdiction: eu
  languages: [en]
  last-verified: 2026-07-15
---

# EUnetHTA Core Model Report Drafting

Drafts a full HTA report in a dossier directory (see the plugin's
`DOSSIER_FORMAT.md`), one chapter file at a time. Act as an expert HEOR
researcher generating chapters of an HTA report according to EUnetHTA
guidelines.

## Chapter set and file naming

Files go to `chapters/<nn>-<slug>.<lang>.md` (language from
`dossier.yaml` `languages`, default `en`). Numbering follows the report's
presentation order:

| nn | Chapter | Instruction file (references/chapters/) |
|----|---------|------------------------------------------|
| 01 | Executive Summary | `executive-summary.md` |
| 02 | Introduction and Problem Description | `introduction-and-problem-description.md` |
| 03 | Technology Description | `technology-description.md` |
| 04 | Health Problem and Current Use | `health-problem-and-current-use.md` |
| 05 | Literature Research | `literature-research.md` |
| 06 | Clinical Effectiveness | `clinical-effectiveness.md` |
| 07 | Safety | `safety.md` |
| 08 | Economic Evaluation | `economic-evaluation.md` |
| 09 | Ethical Aspects | `ethical-aspects.md` |
| 10 | Organisational Aspects | `organisational-aspects.md` |
| 11 | Social Aspects | `social-aspects.md` |
| 12 | Legal Aspects | `legal-aspects.md` |
| 13 | Discussion and Conclusions | `discussion-and-conclusions.md` |

**Drafting (dependency) order differs from numbering:** draft Literature
Research (05) first, then 02, 03, 04, 06, 07, 08, 09, 10, 11, 12, 13, and the
Executive Summary (01) **last** — it summarizes everything else. The user may
select a subset of chapters; keep this relative order.

## Step 1 — read the dossier state

- `dossier.yaml` — intervention, comparator, jurisdictions, languages, and
  `notes` (global context/instructions: currency, style, terminology — they
  apply to every chapter).
- `documents/` — supporting documents (IFU, device description, protocols,
  reports); primary evidence alongside the literature.
- `prisma/` — `pico.yaml`, `prisma-diagram.md`, `included-studies.json`,
  `screening.json`. If PRISMA is absent, tell the user the Literature
  Research and evidence chapters will be weak and offer to run the
  `prisma-review` skill first.
- `models/inputs/*.json` and `models/runs/*.json` — economic model inputs and
  engine outputs (CEA, BIA, PSA, scenarios). The latest run per model is the
  one to report.
- Existing `chapters/*.md` — human-owned; when regenerating, preserve manual
  edits (write alongside or show a diff, never blind-overwrite).

## Step 2 — draft each chapter

For every chapter, load its instruction file from `references/chapters/` and
apply these cross-cutting rules (ported from the source app's shared prompt
preamble):

1. **Global context first.** Apply `dossier.yaml` `notes` to the entire
   chapter content, especially currency, style, and terminology.
2. **Regeneration instruction is law.** If the user asks to regenerate a
   chapter with a specific instruction, you MUST follow it.
3. **Structure.** Start the file with `# <Chapter Title>` (adaptation: in the
   source app the title was added by the system; in a dossier each file
   carries its own H1). Then the body — do not repeat the title as another
   heading.
4. **Coherence, no repetition.** Read the already-drafted chapters and avoid
   redundant explanations; refer to other chapters instead (e.g., "as detailed
   in the Literature Research chapter").
5. **Citation discipline.** Cite **only** studies present in
   `prisma/included-studies.json` (plus user-supplied documents). Mandatory
   references MUST be included and discussed; excluded references must NOT
   appear. Use the same reference numbering as the Literature Research
   chapter.
6. **Numbers are read, never computed.** PRISMA counts come from
   `prisma/prisma-diagram.md` (regenerate via the `prisma-review` skill's
   `scripts/prisma-counts.ts` if stale). Economic results come verbatim from
   `models/runs/*.json` (produced by `packages/heor-engine` via `npx tsx`).
   Never calculate, extrapolate, or round-trip model results yourself; if a
   needed run is missing, say so and stop rather than inventing values.
7. **No external knowledge as evidence.** Background framing is fine; every
   evidential claim traces to an included study, a supporting document, or an
   engine result.

## Step 3 — final review pass

After all chapters are drafted:

- Cross-check consistency: comparator named identically everywhere; PRISMA
  numbers in chapters 05/06 match `prisma-diagram.md`; ICER/BIA figures in
  chapters 01, 08, 13 match the latest `models/runs/` files.
- List any gaps (missing evidence, assumptions used in the models) for the
  user.
- Append to the Executive Summary and to your final message the disclaimer:
  *"This HTA report draft was generated with AI assistance. Expert review by
  qualified HEOR/regulatory professionals is required before submission."*

## Optional Claude-specific enhancement (skip on other harnesses)

Independent chapters within the same dependency stage (03, 04, 09–12) may be
drafted by parallel subagents, each given the dossier paths, the shared rules
above, and its single chapter instruction file. Merge, then run Step 3
yourself.

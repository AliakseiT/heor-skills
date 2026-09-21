---
name: jev-screen
description: >-
  Screen PRISMA title/abstract records with Jev, TypeSafe AI's decision model:
  one atomic yes/no judgment per PICO dimension (P, I, C, O, optional T/S),
  composed in code to include/exclude/maybe with calibrated uncertainty routed
  to a human reviewer. Deterministic engine for prisma-review step 4; reads
  prisma/pico.yaml and prisma/search-results.json, writes prisma/screening.json
  plus a probabilities sidecar. Use for: abstract screening, PICO screening,
  study selection, Jev screening, decision-model screening, title-abstract
  screen.
metadata:
  jurisdiction: global
  languages: [en]
  last-verified: 2026-09-21
  version: "0.1.0"
---

# Jev Abstract Screening

Deterministic screening engine for `prisma-review` step 4. The agent never
screens by hand and the model never writes prose: Jev answers one atomic
`noul` (yes/no with probability) per filled PICO dimension, and
`scripts/jev-screen.ts` composes the answers into dossier decisions.

Two hard rules apply throughout:

1. **Human-in-the-loop.** `maybe` records and the screening summary are drafts
   until the user resolves them. Never silently finalize. Screening output
   carries `screenedBy: ai` until a human overrides it.
2. **No hand screening, no mental arithmetic.** All judgments come from the
   script's Jev calls; all PRISMA counts come from
   `prisma-review/scripts/prisma-counts.ts`. The agent reads, runs, and
   reviews — never decides records itself.

## Inputs

- `prisma/pico.yaml` — confirmed PICO (from `prisma-review` step 1). The
  script reads population, intervention, comparison, and outcomes text.
  Optional dimensions come from flags, never from guessing:
  `--timing "..."` (T) and `--study-type "..."` (S). Empty optionals are
  skipped, never judged.
- `prisma/search-results.json` — records with `id`, `title`, `abstract`
  (dossier schema; a bare record array is also accepted).
- `TYPESAFE_API_KEY` in the environment (create one at
  https://console.typesafe.ai/). The key stays server-side in scripts and
  never enters prompts, files, or chat.

## Workflow

### 1. Preview the battery → confirm

```bash
npx tsx scripts/jev-screen.ts --dossier <dossier-dir> --dry-run
```

(dry-run builds the questions from `pico.yaml` and makes no API calls.)
Show the user the PICO texts the script understood plus the question list
(see `references/jev-questions.md` for what each question means and the
comparison rule). Confirm or edit PICO / `--timing` / `--study-type` first —
question wording is the whole method.

### 2. Screen → `prisma/screening.json`

```bash
npx tsx scripts/jev-screen.ts --dossier <dossier-dir> [--low 0.4 --high 0.6] [--lean sensitive] [--limit 25]
```

- One request per record, five-way parallel questions inside it; batches of 5
  with retry on 429/529. Progress survives interruption: decisions append to
  `screening.json` after every batch, and re-running skips screened ids
  (resume is the default; `--no-resume` starts over).
- `--limit N` screens the first N unscreened records — use it for a pilot
  batch, review, then run the rest.
- `--lean sensitive` mirrors the review convention "when in doubt, include":
  borderline dimensions count as met, so only confident mismatches (and the
  protocol flag) exclude. Default `balanced` sends borderline cases to
  `maybe`. Use sensitive for recall-critical reviews, balanced when the
  reviewer wants the model to triage hard.
- `--modelling-focus` adds an economic-relevance question (evaluation results,
  ICER, utilities, costs, adherence, transition probabilities). Records
  reporting usable numbers are included for model relevance even with a loose
  clinical PICO fit — the deterministic form of the `prisma-review`
  modelling-focus rules. Use it when the review feeds an economic model.
- Per-question probabilities land in `prisma/screening-probs.json`
  (machine-owned sidecar: probs, thresholds, model per id).
- Convention mapping, enforced by the script: Jev INCLUDE → `include`,
  EXCLUDE → `exclude`, NEEDS_HUMAN → `maybe`. Missing abstract → `maybe`
  ("abstract missing; full text required"), decided locally with no API call
  — never an auto-exclude. `isMandatory` records that Jev would exclude
  become `maybe` ("mandatory record: user decides").

### 3. Mandatory user-review checkpoint

Present the screening summary (counts, the full `maybe` list with reasons,
a sample of ~10 excludes with their probabilities from
`screening-probs.json`). Ask the user to resolve every `maybe` and to
veto/confirm the rest. Human overrides get `"screenedBy": "human"` (keep the
AI reason, append the human rationale). Do not hand off to the PRISMA diagram
with unresolved `maybe` decisions.

### 4. Hand off

`prisma-review` step 5 consumes `screening.json` unchanged
(`prisma-counts.ts` reads `include`/`exclude`/`maybe`).

End your final message with the standard disclaimer:
*"Draft generated with AI assistance. Expert review by a qualified systematic
reviewer / HEOR professional is required before submission or publication."*

## Failure handling

- Missing `TYPESAFE_API_KEY` → stop with setup instructions, do not fall
  back to hand screening.
- API errors after retries → keep decisions screened so far, report the
  failing record ids, tell the user.
- No network in this environment → say so; the `--self-test` and `--dry-run`
  paths still validate everything except the live judgments.

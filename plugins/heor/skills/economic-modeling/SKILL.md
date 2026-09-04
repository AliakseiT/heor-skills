---
name: economic-modeling
description: >-
  Build and run health-economic models for an HTA/HEOR dossier using the
  deterministic @heor/engine: select a cost-effectiveness model type (Decision
  Tree, Markov Chain, Partitioned Survival, State Transition, DES) or Budget
  Impact Assessment, populate parameters from included studies and documents
  with mandatory per-parameter source tracking, run baseline computations,
  probabilistic sensitivity analysis (Monte Carlo PSA with CEAC and tornado
  diagram), and scenario comparisons. Use for: cost-effectiveness, CEA, BIA,
  budget impact, Markov, decision tree, ICER, QALY, PSA, sensitivity analysis,
  economic evaluation, economic model, health economics.
metadata:
  jurisdiction: global
  languages: [en]
  last-verified: 2026-07-15
  version: "1.0.0"
---

# Economic Modeling (CEA / BIA / PSA / Scenarios)

Builds economic models inside a dossier directory (see the plugin's
`DOSSIER_FORMAT.md`) and runs them through the deterministic
`@heor/engine` CLIs. Act as an expert HEOR analyst specializing in
cost-effectiveness modeling.

Three hard rules apply throughout:

1. **Never compute model results yourself.** Every number — expected costs,
   ICERs, QALYs, budget impact, PSA statistics, CEAC points, tornado ranges —
   comes from an engine CLI run. No mental arithmetic, no spreadsheet-style
   estimation, no "adjusting" engine output. If a run fails, fix the inputs
   and re-run.
2. **Every parameter value carries a source.** A model input without a
   tracked source (study + location, document, expert statement, or clearly
   flagged default/assumption) is not done. See
   `references/parameter-extraction.md`.
3. **Human-in-the-loop.** Model choice and the populated parameter set are
   drafts until the user confirms them. Never run the baseline on an
   unconfirmed parameter set.

## Locating the engine

The engine is the `@heor/engine` package. Resolve its directory once and
reuse it:

```bash
# From this skill's own directory, the monorepo engine lives four levels up:
ENGINE="${HEOR_ENGINE_DIR:-<this-skill-dir>/../../../../packages/heor-engine}"
```

- `HEOR_ENGINE_DIR` (environment variable) always wins when set.
- In the `heor-skills` monorepo the relative path above resolves to
  `heor-skills/packages/heor-engine`. Verify with
  `ls "$ENGINE/src/cli/run-model.ts"` before the first run.
- **Bare-skill caveat:** if this skill was installed standalone (without the
  monorepo), the relative path will not exist. Install the engine from npm
  once published (`npm install @heor/engine`) and point `HEOR_ENGINE_DIR` at
  the installed package directory (e.g. `node_modules/@heor/engine`). Until
  then, ask the user for a checkout of `heor-skills` and use its
  `packages/heor-engine`.

All CLIs are invoked as `npx tsx "$ENGINE/src/cli/<name>.ts" <file.json>`,
print JSON to stdout, log debug output to stderr, and exit non-zero with a
message on stderr for invalid input.

## Inputs

- `dossier.yaml` — intervention, `deviceClass`, `categories`, comparator,
  jurisdictions, `notes` (global context, e.g. "all costs in CHF" — apply to
  every value you populate).
- `documents/` — user-supplied sources (IFU, CER, device description,
  protocols). Primary extraction source after direct expert input.
- `prisma/included-studies.json` and full texts/abstracts from a prior
  `prisma-review` run — the literature evidence base for parameters.
- Optional user-provided: expert parameter values (highest priority), a
  preferred model type, willingness-to-pay threshold, target market,
  permission to use ungrounded plausible values.

## Workflow

### 1. Model selection

Follow `references/model-selection.md`. Recommend **one** model type from:
Decision Tree, Markov Chain, Partitioned Survival Model, Discrete Event
Simulation, State Transition Model — plus, when payer budget questions are in
scope, a **separate, complementary** Budget Impact Assessment. Give a 2–3
sentence justification tied to the intervention's care pathway and time
horizon, and state the engine's support tier (full calculator vs. partial
support; PSA availability). Present the recommendation and wait for the user to
confirm or override before populating parameters.

### 2. Parameter population → `models/inputs/<model>.json`

The critical step. Follow `references/parameter-extraction.md` (source
priority ladder, per-model parameter catalogs, consistency rules) and write
the file in the exact engine format documented in
`references/input-format.md`.

- Extract values from `prisma/included-studies.json` (and retrieved full
  texts/abstracts) and `documents/`, in the documented priority order.
- **User/expert-provided values always take precedence** over anything
  extracted from literature.
- Device-class defaults from the engine's defaults library are the **last
  resort only**, and every defaulted parameter must be flagged as such in its
  source entry and in your summary to the user.
- Record a `sources` block with one entry per populated parameter: value
  provenance (study/document + exact location), confidence, extraction
  method, rationale. No exceptions.
- CEA and BIA parameters must never mix in one file (`models/inputs/bia.json`
  is its own file with its own sources).

Present the populated set — values, sources, gaps, defaulted/assumed
parameters — and wait for user confirmation. Unresolvable gaps for required
parameters block the run: ask the user rather than inventing values silently.

### 3. Baseline run → `models/runs/<date>-<model>.json`

```bash
npx tsx "$ENGINE/src/cli/run-model.ts" models/inputs/<model>.json \
  > models/runs/$(date +%F)-<model>.json
```

On non-zero exit, read stderr, fix `models/inputs/<model>.json`, re-run.
Never edit files in `models/runs/` — they are machine-owned; regenerate
instead. Report the run's key results verbatim (see step 6).

### 4. Probabilistic sensitivity analysis → `models/runs/<date>-<model>-psa.json`

PSA is supported for `decision-tree`, `markov-chain`, and `budget-impact`
only. Add a `psa` block to the same inputs file (format and parameter-name
rules in `references/input-format.md`; range-building rules in
`references/parameter-extraction.md`), then:

```bash
npx tsx "$ENGINE/src/cli/run-psa.ts" models/inputs/<model>.json \
  > models/runs/$(date +%F)-<model>-psa.json
```

Always set a `seed` so runs are reproducible. Interpret the output —
ICER distribution, CEAC, tornado diagram — strictly per
`references/psa-interpretation.md`; quote statistics verbatim from the run
file.

### 5. Scenario comparison → `models/runs/<date>-<model>-scenario.json`

For structural/what-if questions (high cost, low prevalence, slow uptake…),
write a scenarios file (format in `references/input-format.md`) and run:

```bash
npx tsx "$ENGINE/src/cli/run-scenarios.ts" models/inputs/<model>-scenarios.json \
  > models/runs/$(date +%F)-<model>-scenario.json
```

Scenario runs merge inputs over device-class defaults with priority
AI-suggested > expert-provided > caller baseline > defaults; `overrides`
always win. Name each scenario after the question it answers and interpret
per-scenario results plus the aggregated metrics (`averageICER`,
`icer_range`) from the output only.

### 6. Results narration

Summarize for the user and for downstream skills (`eurhta-report`'s
Economic Evaluation chapter, `ch-migel-application` and other application
skills read `models/inputs/` and `models/runs/` directly):

- **Baseline:** exact values from the latest run — per-arm expected
  cost/utility, incremental cost/utility and ICER (Decision Tree); total
  discounted cost and QALYs (Markov); net budget impact per year and total
  (BIA). Interpret for a decision-maker ("for each additional QALY gained,
  the additional cost is …"), never just restate numbers.
- **Uncertainty:** mean/median ICER with the p5–p95 interval, probability
  cost-effective at the relevant willingness-to-pay threshold from the CEAC,
  and the top tornado parameters driving uncertainty.
- **Provenance:** which parameters came from literature (with citations),
  which from experts, which from defaults/assumptions — flag the latter as
  limitations.
- Do not write the dossier chapter itself here — that is `eurhta-report`'s
  job; point it at the inputs and runs files.

End your final message with the standard disclaimer: *"Draft economic model
generated with AI assistance. Review by a qualified health economist is
required before use in any submission or decision-making."*

## Failure handling

- Engine CLI exits non-zero → quote the stderr message, fix the named
  problem in the inputs file, re-run. Do not hand-write a "results" file.
- Run file contains an `error` field → treat the run as failed; diagnose
  from the inputs (e.g. Markov transition rows not summing to 1) and re-run.
- PSA requested for a model without PSA support (state-transition,
  partitioned-survival, discrete-event-simulation) → explain it is
  unsupported and offer scenario comparison or a PSA-supported model instead.
- A required parameter has no defensible value and the user is unavailable →
  stop after step 2 and report the gap; do not run on invented numbers.

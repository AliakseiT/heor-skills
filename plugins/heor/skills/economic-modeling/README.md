# economic-modeling

Builds and runs cost-effectiveness and budget-impact models through the
deterministic `@heor/engine`. Six model types, PSA, scenario comparison,
Excel export.

## When to use

- "Build a cost-effectiveness model"
- "Run a Markov model"
- "Add a PSA (probabilistic sensitivity analysis)"
- "Compare scenarios with different cost assumptions"
- "Calculate the ICER"

## What it produces

`models/inputs/<model>.json` (engine-ready inputs with per-parameter source
tracking) and `models/runs/<date>-<model>.json` (engine output, never
hand-edited).

## Engine CLI

```bash
npx tsx packages/heor-engine/src/cli/run-model.ts <inputs.json>
npx tsx packages/heor-engine/src/cli/run-psa.ts <inputs.json>
npx tsx packages/heor-engine/src/cli/run-scenarios.ts <inputs.json>
npx tsx packages/heor-engine/src/cli/export-excel.ts <run.json> --output <path>
npx tsx packages/heor-engine/src/cli/compare-runs.ts <run1.json> <run2.json>
```

The LLM never computes model results. Every number comes from an engine CLI
run.

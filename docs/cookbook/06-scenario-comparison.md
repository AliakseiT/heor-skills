# Recipe 06: Scenario comparison

Run multiple economic model scenarios with different parameter sets,
compare results, and export the analysis.

## Scenario

You want to test how sensitive your ICER is to key assumptions: high cost,
low prevalence, and slow market uptake.

## Steps

### 1. Prepare the scenarios file

Create `models/inputs/decision-tree-scenarios.json`:

```json
{
  "deviceClass": "digital-therapy",
  "model": "decision-tree",
  "baselineInputs": {},
  "scenarios": [
    { "id": "baseline", "name": "Baseline (device-class defaults)" },
    { "id": "high-cost", "name": "High intervention cost", "overrides": { "costInterventionTest": 150 } },
    { "id": "low-prev", "name": "Low disease prevalence", "overrides": { "prevalenceDisease": 0.08 } },
    { "id": "high-sensitivity", "name": "High sensitivity", "overrides": { "sensitivityInterventionTest": 0.95 } }
  ],
  "runPSA": false,
  "psa": { "numIterations": 500, "seed": 42 }
}
```

### 2. Run the batch

```bash
npx tsx packages/heor-engine/src/cli/run-scenarios.ts models/inputs/decision-tree-scenarios.json \
  > models/runs/$(date +%F)-decision-tree-scenarios.json
```

Output includes per-scenario results and aggregated metrics:
`averageICER`, `icer_range`, `averageIncrementalCost`,
`averageIncrementalUtility`.

### 3. Compare individual runs

If you have separate run files (e.g., from `run-model.ts`), compare them:

```bash
npx tsx packages/heor-engine/src/cli/compare-runs.ts \
  models/runs/baseline.json \
  models/runs/high-cost.json \
  models/runs/low-prev.json \
  --baseline models/runs/baseline.json
```

Output: parameter differences (with impact rating), result variations
(with percentage changes), and recommendations (e.g., "ICER shows high
sensitivity. Consider PSA.").

### 4. Export to Excel

```bash
npx tsx packages/heor-engine/src/cli/export-excel.ts \
  models/runs/2026-01-15-decision-tree-scenarios.json \
  --output scenario-comparison.xlsx
```

The workbook includes Scenario_Inputs (side-by-side parameters) and
Scenario_Results (side-by-side outcomes with aggregated metrics).

### 5. Export individual runs

```bash
npx tsx packages/heor-engine/src/cli/export-excel.ts \
  models/runs/baseline.json \
  models/runs/high-cost.json \
  models/runs/low-prev.json \
  --output multi-run-comparison.xlsx
```

Each run gets its own set of sheets (inputs, calculation with live
formulas, engine results).

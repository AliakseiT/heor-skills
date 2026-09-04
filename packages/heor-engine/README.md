# @heor/engine

Pure-TypeScript health-economic modeling engine with **zero runtime dependencies**. Ported from the HEOR Copilot app as a characterization port: the numerical behavior of every calculator is identical to the source and pinned by tests.

Contents:

- **Six model calculators** (`src/ce-models.ts`): Decision Tree, Markov Chain, Budget Impact Assessment, State Transition Model, Partitioned Survival Model (stub), Discrete Event Simulation (stub).
- **Probabilistic sensitivity analysis** (`src/probabilistic-sensitivity-analysis.ts`): Monte Carlo simulation with summary statistics, CEAC curve, and tornado diagram. Supports Decision Tree, Markov Chain, and Budget Impact models. Deterministic via `seed` or an injectable `rng: () => number`.
- **Batch scenario execution** (`src/batch-scenario-executor.ts`): baseline vs. alternative scenario comparison with device-class defaults, input merging, caching, and aggregated metrics.
- **Device-class default parameter sets** (`src/economic-model-defaults.ts`) and **input merging/name mapping** utilities.

```bash
pnpm --filter @heor/engine test        # characterization tests
pnpm --filter @heor/engine typecheck   # strict tsc --noEmit
```

## CLI usage

Skills and agents must never compute model results themselves — they shell out to these entrypoints (see `CONVENTIONS.md`). Each CLI reads a single JSON file (the dossier's `models/inputs/<model>.json`), prints a JSON run record to **stdout** (suitable for saving as `models/runs/<date>-<model>.json`), and exits non-zero with a message on **stderr** for invalid input. Engine debug logging goes to stderr, never stdout.

```bash
npx tsx src/cli/run-model.ts examples/markov-chain.json           # deterministic single run
npx tsx src/cli/run-psa.ts examples/psa-markov-chain.json         # Monte Carlo PSA
npx tsx src/cli/run-scenarios.ts examples/scenarios-decision-tree.json   # scenario comparison
```

Model identifiers (accepted as kebab-case slug or display name):

| Slug | Display name | PSA support |
|---|---|---|
| `decision-tree` | Decision Tree | yes |
| `markov-chain` | Markov Chain | yes |
| `budget-impact` | Budget Impact Assessment | yes |
| `state-transition` | State Transition Model | no |
| `partitioned-survival` | Partitioned Survival Model | no (stub calculator) |
| `discrete-event-simulation` | Discrete Event Simulation | no (stub calculator) |

## `run-model.ts` input format

```json
{ "model": "<slug>", "inputs": { ...model parameters... } }
```

The `inputs` object uses each calculator's native parameter shape, shown in full below (all examples are runnable copies of the files in `examples/`).

### Decision Tree (`decision-tree`) — camelCase keys

Two-arm diagnostic test tree. All probabilities/utilities in [0, 1].

```json
{
  "model": "decision-tree",
  "inputs": {
    "costInterventionTest": 50,
    "sensitivityInterventionTest": 0.85,
    "specificityInterventionTest": 0.9,
    "costComparatorTest": 40,
    "sensitivityComparatorTest": 0.75,
    "specificityComparatorTest": 0.8,
    "prevalenceDisease": 0.15,
    "costTreatmentCorrectPositive": 2000,
    "utilityTreatmentCorrectPositive": 0.8,
    "costFalsePositiveManagement": 500,
    "utilityFalsePositiveState": 0.6,
    "costFalseNegativeConsequence": 5000,
    "utilityFalseNegativeState": 0.3,
    "costCorrectNegativeManagement": 100,
    "utilityCorrectNegativeState": 1.0
  }
}
```

Results: per-arm expected cost/utility, `incrementalCost`, `incrementalUtility`, `icer` (number, or `"Dominated"` / `"No difference"` / `"Not calculable (zero utility gain)"`).

### Markov Chain (`markov-chain`) — display-name keys

Three-state (Healthy/Disease/Dead) single-arm cohort model. Transition probabilities out of each living state must sum to 1; initial cohort percentages are on the 0–100 scale.

```json
{
  "model": "markov-chain",
  "inputs": {
    "Prob Healthy to Healthy": 0.85,
    "Prob Healthy to Disease": 0.1,
    "Prob Healthy to Dead": 0.05,
    "Prob Disease to Healthy": 0.2,
    "Prob Disease to Disease": 0.7,
    "Prob Disease to Dead": 0.1,
    "Cost Healthy State": 500,
    "Cost Disease State": 3000,
    "Cost Dead State": 0,
    "Utility Healthy State": 1.0,
    "Utility Disease State": 0.7,
    "Utility Dead State": 0.0,
    "Number of Cycles": 20,
    "Annual Discount Rate": 0.03,
    "Initial Cohort % Healthy": 70,
    "Initial Cohort % Disease": 30
  }
}
```

Results: `totalDiscountedCost`, `totalDiscountedQALYs`, per-cycle `stateTrace`.

### Budget Impact Assessment (`budget-impact`) — camelCase keys

Market shares are percentages (0–100); assessment horizon is 1–5 years (years beyond 3 reuse the year-3 shares).

```json
{
  "model": "budget-impact",
  "inputs": {
    "targetMarket": "Switzerland",
    "targetPopulationSize": 100000,
    "marketShareInterventionY1": 5,
    "marketShareInterventionY2": 15,
    "marketShareInterventionY3": 25,
    "marketShareComparatorY1": 95,
    "marketShareComparatorY2": 85,
    "marketShareComparatorY3": 75,
    "annualCostInterventionPerPatient": 120,
    "annualCostComparatorPerPatient": 80,
    "numberOfYearsAssessment": 3
  }
}
```

Results: `netBudgetImpactPerYear` (impact + patient counts per year), `totalNetBudgetImpact`.

### State Transition Model (`state-transition`)

Arbitrary n-state cohort propagation with transition matrix. Applies half-cycle correction (averages start- and end-of-cycle occupancy for cost/QALY accumulation).

```json
{
  "model": "state-transition",
  "inputs": {
    "transitionMatrix": [[0.8, 0.15, 0.05], [0.1, 0.8, 0.1], [0, 0, 1]],
    "initialStateDistribution": [0.7, 0.3, 0],
    "stateCosts": [100, 2000, 0],
    "stateUtilities": [0.9, 0.6, 0],
    "numCycles": 10,
    "discountRate": 0.03
  }
}
```

### Partitioned Survival Model (`partitioned-survival`) — stub

Cycles are split 50/50 pre/post-progression; the survival-curve parameters are accepted but not yet used by the stub.

```json
{
  "model": "partitioned-survival",
  "inputs": {
    "survivalCurveParam1": 12,
    "survivalCurveParam2": 1.4,
    "costPerCyclePre": 5000,
    "costPerCyclePost": 2000,
    "utilityPre": 0.75,
    "utilityPost": 0.5,
    "numCycles": 24,
    "discountRate": 0.035
  }
}
```

### Discrete Event Simulation (`discrete-event-simulation`) — stub

Deterministic patient-volume approximation (`floor(arrivalRate × duration)` patients).

```json
{
  "model": "discrete-event-simulation",
  "inputs": {
    "eventRateAlpha": 5,
    "resourceCostBeta": 250,
    "patientArrivalRate": 2,
    "queueCapacity": 10,
    "simulationDuration": 30
  }
}
```

## `run-psa.ts` input format

The same `model` + `inputs` envelope, plus a `psa` block. Distributions: `uniform`, `triangular` (uses `mode`), `normal` and `lognormal` (use `mean`/`stdDev`, clamped to [min, max]).

```json
{
  "model": "markov-chain",
  "inputs": { "...": "baseline parameters exactly as for run-model.ts" },
  "psa": {
    "numIterations": 500,
    "seed": 42,
    "parameterRanges": {
      "Cost Healthy State": { "min": 400, "max": 800, "distribution": "lognormal", "mean": 500, "stdDev": 200 },
      "Cost Disease State": { "min": 2000, "max": 4500, "distribution": "lognormal", "mean": 3000, "stdDev": 1000 },
      "Utility Disease State": { "min": 0.6, "max": 0.8, "distribution": "triangular", "mode": 0.7 }
    },
    "fixedParameters": [],
    "parameterRangeOverrides": {}
  }
}
```

`parameterRanges` keys must match the baseline input keys (for Markov models) or template/display names (for decision-tree and budget-impact models — see `src/parameter-name-mapper.ts`). Passing `seed` makes runs fully reproducible. Output: baseline result, per-iteration results, statistics (mean/median/stdDev/p5/p25/p75/p95), CEAC curve, tornado diagram.

For a Markov PSA the ICER statistics represent single-arm **cost per QALY**; for budget impact they represent total net budget impact.

## `run-scenarios.ts` input format

Compares a baseline against alternative parameter sets, layered on device-class defaults (`digital-therapy`, `monitoring-device`, `therapeutic-device`, `software-as-medical-device`, `diagnostic-device`).

```json
{
  "deviceClass": "digital-therapy",
  "model": "decision-tree",
  "baselineInputs": {},
  "scenarios": [
    { "id": "baseline", "name": "Baseline (device-class defaults)" },
    { "id": "high-intervention-cost", "name": "High intervention cost", "overrides": { "costInterventionTest": 150 } },
    { "id": "low-prevalence", "name": "Low disease prevalence", "overrides": { "prevalenceDisease": 0.08 } }
  ],
  "runPSA": false,
  "psa": { "numIterations": 500, "seed": 42 },
  "parallelExecutions": 4
}
```

Per scenario you may also set `inputs` (merged over the shared `baselineInputs`), `aiSuggestedInputs`, `expertProvidedInputs`, `runPSA`, and `psa`. Merge priority is AI-suggested > expert-provided > caller baseline > device-class defaults; `overrides` always win. Note (source behavior): caller `baselineInputs` only replace defaults that have no documented literature source in the defaults library. Output includes per-scenario results plus aggregated metrics (`averageICER`, `icer_range`, average incrementals).

## `export-excel.ts` — Excel export

Exports one or more run-record JSON files to a multi-sheet `.xlsx` workbook. Each model produces an Inputs sheet, a Calculation sheet with **live Excel formulas** referencing the Inputs sheet (so stakeholders can tweak parameters and see recalculation), and an Engine Results sheet for verification.

```bash
# Single model run
npx tsx src/cli/export-excel.ts models/runs/2026-01-markov.json --output markov.xlsx

# Multiple runs (creates sheets for each)
npx tsx src/cli/export-excel.ts models/runs/baseline.json models/runs/high-cost.json --output comparison.xlsx

# PSA run (adds statistics, CEAC, and tornado sheets)
npx tsx src/cli/export-excel.ts models/runs/psa-markov.json --output psa.xlsx

# Scenario batch (adds scenario comparison sheets)
npx tsx src/cli/export-excel.ts models/runs/scenarios.json --output scenarios.xlsx
```

Live formulas are generated for Decision Tree (PPV/NPV/expected cost/utility per arm), Markov Chain (per-cycle state propagation with discounting), and Budget Impact (per-year patient counts and costs). Stub models export inputs and results as values.

## `compare-runs.ts` — structured run comparison

Compares two or more model run records and produces a structured analysis: parameter differences with impact assessment, result variations with percentage changes, and recommendations for further analysis.

```bash
npx tsx src/cli/compare-runs.ts models/runs/baseline.json models/runs/high-cost.json models/runs/low-prevalence.json
npx tsx src/cli/compare-runs.ts run-a.json run-b.json --baseline run-a.json
```

Output: a JSON object with `keyDifferences` (parameters that changed, rated low/medium/high impact), `resultVariations` (metrics that changed, with % delta per alternative run), and `recommendations` (e.g. "ICER shows high sensitivity — consider PSA").

## Determinism

- All six calculators are pure and deterministic.
- The PSA engine draws randomness from a single source: `PSAConfiguration.rng` if provided, else a built-in LCG seeded with `PSAConfiguration.seed` (or `Date.now()` when neither is given). Always pass `seed` (CLI) or `rng` (API) when reproducibility matters.

## Provenance

Ported from the HEOR Copilot app (`src/services/ce-models.ts`, `src/services/probabilistic-sensitivity-analysis.ts`, `src/services/batch-scenario-executor.ts`, `src/lib/economic-model-defaults.ts`, `src/lib/parameter-name-mapper.ts`, `src/lib/economic-input-merger.ts`, and the model types/constants from `src/types/copilot.ts`). Per `CONVENTIONS.md`, behavior changes require a characterization-test change in the same commit.

# Engine Input File Formats

Derived from `@heor/engine`'s README, `examples/`, and CLI sources
(`src/cli/run-model.ts`, `run-psa.ts`, `run-scenarios.ts`). Do not invent
keys — everything the engine accepts is documented here or in the engine
README (which is authoritative if they ever disagree).

## General envelope — `models/inputs/<model>.json`

```json
{
  "model": "<slug>",
  "inputs": { "...": "model parameters, native shape per model below" },
  "psa": { "...": "optional PSA block, see below" },
  "sources": { "...": "per-parameter source tracking, see parameter-extraction.md" }
}
```

- `model` accepts the kebab-case slug or the display name
  (case-insensitive): `decision-tree` / "Decision Tree", `markov-chain` /
  "Markov Chain", `budget-impact` / "Budget Impact Assessment",
  `state-transition` / "State Transition Model", `partitioned-survival` /
  "Partitioned Survival Model", `discrete-event-simulation` / "Discrete
  Event Simulation". Use the slug in file names (`models/inputs/<slug>.json`,
  though `bia.json` is the conventional name for the budget-impact file).
- `run-model.ts` reads only `model` + `inputs`; `run-psa.ts` additionally
  reads `psa`. Extra keys such as `sources` are ignored by the CLIs, so one
  file serves deterministic run, PSA, and provenance.
- CLIs print the run record to stdout (save verbatim to
  `models/runs/<date>-<model>[-psa|-scenario].json`) and errors to stderr
  with a non-zero exit.
- Run-record envelopes (verified against the CLIs):
  - `run-model.ts` → `{ engine, kind: "model-run", model, modelType,
    generatedAt, inputs, results }` — model results under `results`.
  - `run-psa.ts` → `{ engine, kind: "psa-run", model, modelType,
    generatedAt, inputs, psaConfig, result }` — PSA payload
    (`baselineResult`, `iterations`, `statistics`, `ceacCurve`,
    `tornadoDiagram`, `metadata`) under `result`.
  - `run-scenarios.ts` → `{ engine, kind: "scenario-batch-run", model,
    deviceClass, generatedAt, result }` — batch payload (per-scenario
    `results`, `aggregatedMetrics`) under `result`.

## Decision Tree (`decision-tree`) — camelCase keys

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

Results: per-arm `expectedCost`/`expectedUtility`, `incrementalCost`,
`incrementalUtility`, `icer` (a number, or the strings `"Dominated"` /
`"No difference"` / `"Not calculable (zero utility gain)"`).

Display-name ↔ camelCase mapping (needed for PSA ranges, see below):
"Cost of Intervention Test" ↔ `costInterventionTest`, "Sensitivity of
Intervention Test" ↔ `sensitivityInterventionTest`, "Specificity of
Intervention Test" ↔ `specificityInterventionTest`, "Cost of Comparator
Test" ↔ `costComparatorTest`, "Sensitivity of Comparator Test" ↔
`sensitivityComparatorTest`, "Specificity of Comparator Test" ↔
`specificityComparatorTest`, "Prevalence of Disease/Condition" ↔
`prevalenceDisease`, "Cost of Treatment (Correct Positive)" ↔
`costTreatmentCorrectPositive`, "Utility of Treatment (Correct Positive)" ↔
`utilityTreatmentCorrectPositive`, "Cost of False Positive Management" ↔
`costFalsePositiveManagement`, "Utility of False Positive State" ↔
`utilityFalsePositiveState`, "Cost of False Negative Consequence" ↔
`costFalseNegativeConsequence`, "Utility of False Negative State" ↔
`utilityFalseNegativeState`, "Cost of Correct Negative Management" ↔
`costCorrectNegativeManagement`, "Utility of Correct Negative State" ↔
`utilityCorrectNegativeState`.

## Markov Chain (`markov-chain`) — display-name keys

Three-state (Healthy/Disease/Dead) single-arm cohort model. Outgoing
probabilities per living state must sum to 1; initial cohort percentages are
on the 0–100 scale; discount rate is a decimal.

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

Results: `totalDiscountedCost`, `totalDiscountedQALYs`, per-cycle
`stateTrace`.

## Budget Impact Assessment (`budget-impact`) — camelCase keys

Market shares are percentages (0–100); horizon 1–5 years (years beyond 3
reuse the year-3 shares). `targetMarket` is the only string parameter.

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

Results: `netBudgetImpactPerYear` (per-year impact + intervention/comparator
patient counts), `totalNetBudgetImpact`, `totalEligiblePopulation`,
`numYears`, `targetMarket`.

Display-name ↔ camelCase mapping: "Target Market (e.g., Country Name)" ↔
`targetMarket`, "Target Population Size (Total Eligible)" ↔
`targetPopulationSize`, "Intervention Market Share Year N (%)" ↔
`marketShareInterventionYN`, "Comparator Market Share Year N (%)" ↔
`marketShareComparatorYN`, "Annual Cost of Intervention per Patient" ↔
`annualCostInterventionPerPatient`, "Annual Cost of Comparator per Patient"
↔ `annualCostComparatorPerPatient`, "Number of Years for BIA Assessment
(1-5)" ↔ `numberOfYearsAssessment`.

## State Transition Model (`state-transition`) — STUB

Arbitrary n-state vector propagation (`stateVec × transitionMatrix` per
cycle). Each matrix row sums to 1; array lengths must match.

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

## Partitioned Survival Model (`partitioned-survival`)

Weibull survival curve: `survivalCurveParam1` = scale (λ), `survivalCurveParam2` = shape (k).
S(t) = exp(-(t/λ)^k) partitions the cohort into pre-progression and post-progression per cycle.
Half-cycle correction applied.

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

## Discrete Event Simulation (`discrete-event-simulation`)

Deterministic M/M/c queueing model. Patients arrive at regular intervals
(mean inter-arrival = 1/patientArrivalRate), each occupies a treatment
slot for mean service time 1/eventRateAlpha. Tracks wait times, cost per
treatment, and QALYs (proportional to treatment time, reduced by waiting).

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

## PSA block (`run-psa.ts`) — decision-tree, markov-chain, budget-impact only

Same `model` + `inputs` envelope plus a `psa` block:

```json
{
  "model": "markov-chain",
  "inputs": { "...": "baseline parameters exactly as for run-model.ts" },
  "psa": {
    "numIterations": 1000,
    "seed": 42,
    "parameterRanges": {
      "Cost Healthy State": { "min": 400, "max": 800, "distribution": "lognormal", "mean": 500, "stdDev": 200 },
      "Utility Disease State": { "min": 0.6, "max": 0.8, "distribution": "triangular", "mode": 0.7 }
    },
    "fixedParameters": [],
    "parameterRangeOverrides": {}
  }
}
```

- Distributions: `uniform` (min/max), `triangular` (uses `mode`), `normal`
  and `lognormal` (use `mean`/`stdDev`; samples are clamped to
  [`min`, `max`]).
- `numIterations` defaults to 1000; **always pass `seed`** for
  reproducibility.
- **Parameter-name rule:** `parameterRanges` keys must match the baseline
  input keys for Markov models (display names). For decision-tree and
  budget-impact, ranges use the **display names** from the mapping tables
  above (the engine's parameter-name mapper converts them; camelCase
  baseline `inputs` remain valid as-is).
- `fixedParameters` (array of names) hold parameters at baseline;
  `parameterRangeOverrides` patch individual ranges without editing
  `parameterRanges`.

Output: baseline result, per-iteration results, `statistics`
(mean/median/stdDev/p5/p25/p75/p95 for ICER and incrementals), `ceacCurve`,
`tornadoDiagram`, `metadata`. Interpretation rules:
`psa-interpretation.md`.

## Scenarios file (`run-scenarios.ts`) — `models/inputs/<model>-scenarios.json`

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

- `deviceClass` (required): `digital-therapy`, `monitoring-device`,
  `therapeutic-device`, `software-as-medical-device`, `diagnostic-device`.
  Its defaults fill any gaps in the inputs.
- `model` is optional (defaults to the device class's model type) but set it
  explicitly.
- Per scenario you may also set `inputs` (merged over shared
  `baselineInputs`), `aiSuggestedInputs`, `expertProvidedInputs`, `runPSA`,
  and `psa`. Merge priority: AI-suggested > expert-provided > caller
  baseline > device-class defaults; `overrides` always win. Source-behavior
  note: caller `baselineInputs` only replace defaults that have no
  documented literature source in the defaults library — use `overrides`
  when a value must stick.
- Output: per-scenario results plus `aggregatedMetrics` (`averageICER`,
  `icer_range`, average incrementals). The CLI exits non-zero if any
  scenario failed (after printing the batch result).

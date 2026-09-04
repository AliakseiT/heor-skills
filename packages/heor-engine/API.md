# @heor/engine API reference

Structured reference for programmatic use and LLM consumption. For CLI
usage and examples, see [README.md](./README.md).

## Exports

### Model calculators (`src/ce-models.ts`)

```
calculateDecisionTreeModel(inputs: DecisionTreeInputParameters): DecisionTreeResults
calculateMarkovModel(inputs: MarkovChainInputParameters): MarkovChainResults
calculateBudgetImpactModel(inputs: BudgetImpactInputParameters): BudgetImpactResults
calculateStateTransitionModel(inputs: StateTransitionModelInputParameters): StateTransitionModelResults
calculatePartitionedSurvivalModel(inputs: PartitionedSurvivalModelInputParameters): PartitionedSurvivalModelResults
calculateDiscreteEventSimulationModel(inputs: DiscreteEventSimulationInputParameters): DiscreteEventSimulationResults
```

| Model | Slug | PSA | Status |
|---|---|---|---|
| Decision Tree | `decision-tree` | yes | full |
| Markov Chain | `markov-chain` | yes | full |
| Budget Impact | `budget-impact` | yes | full |
| State Transition | `state-transition` | no | full |
| Partitioned Survival | `partitioned-survival` | no | full |
| Discrete Event Simulation | `discrete-event-simulation` | no | full |

### PSA (`src/probabilistic-sensitivity-analysis.ts`)

```
runProbabilisticSensitivityAnalysis(config: PSAConfiguration): Promise<PSAResult>
generatePSASummary(result: PSAResult): string
```

PSAConfiguration:
- `modelType`: "Decision Tree" | "Markov Chain" | "Budget Impact Assessment"
- `baselineInputs`: Record<string, number | string>
- `parameterRanges`: Record<string, ParameterRangeInfo>
- `numIterations`: number (default 1000)
- `seed`: number (optional, for reproducibility)
- `fixedParameters`: string[] (optional)
- `rng`: () => number (optional, injectable)

Distributions: `uniform`, `triangular` (uses `mode`), `normal` (uses
`mean`/`stdDev`), `lognormal` (uses `mean`/`stdDev`, clamped to [min, max]).

PSAResult:
- `baselineResult`: deterministic baseline
- `iterations`: per-iteration parameter values and results
- `statistics`: mean, median, stdDev, p5, p25, p75, p95 for ICER, incremental cost, incremental utility
- `ceacCurve`: CEAC points at WTP thresholds 0/10k/20k/30k/50k/75k/100k/150k/200k
- `tornadoDiagram`: one-way sensitivity analysis ranked by impact

### Batch scenarios (`src/batch-scenario-executor.ts`)

```
executeScenario(config: ScenarioExecutionConfig, useCache?, cacheKeyPrefix?): Promise<ScenarioExecutionResult>
executeBatch(config: BatchExecutionConfig): Promise<BatchExecutionResult>
generateSensitivityScenarios(baseline, ranges): ScenarioExecutionConfig[]
clearCache(): void
getCacheStats(): { size, maxSize }
```

Merge priority: AI-suggested > expert-provided > caller baseline > device-class
defaults. `overrides` always win.

### Device-class defaults (`src/economic-model-defaults.ts`)

```
getDefaultsForDeviceClass(deviceClass: DeviceClass): DefaultModelInputSet[]
listAvailableDeviceClasses(): DeviceClass[]
listAllDefaults(): { id, deviceClass, modelType, baselineInputs, parameterRanges, assumptions, sources }[]
```

Device classes: `digital-therapy`, `monitoring-device`, `therapeutic-device`,
`software-as-medical-device`, `diagnostic-device`.

### Parameter name mapping (`src/parameter-name-mapper.ts`)

```
findDefaultsParameterName(name: string): string | undefined
findTemplateParameterName(name: string): string | undefined
isDefaultsParameter(name: string): boolean
isTemplateParameter(name: string): boolean
getMappingStats(): { totalMappings, defaultsNames, templateNames }
```

Maps between defaults-library names (camelCase), template/display names, and
model input block names. Uses exact matching first, then fuzzy matching via
Levenshtein distance (threshold > 0.6).

### Input merging (`src/economic-input-merger.ts`)

```
mergeEconomicInputs(strategy: InputMergeStrategy): MergedInputResult
validateMergedInputs(inputs, expectedParams): ValidationResult
generateMergeReport(result: MergedInputResult): string
createMergeStrategyFromDeviceClass(deviceClass): InputMergeStrategy
compareInputs(a, b): InputComparison
```

## CLI entrypoints

All CLIs read a JSON file, print JSON to stdout, log to stderr, and exit
non-zero on error.

| Script | Input | Output |
|---|---|---|
| `run-model.ts` | `{ model, inputs }` | run record |
| `run-psa.ts` | `{ model, inputs, psa }` | PSA run record |
| `run-scenarios.ts` | `{ deviceClass, scenarios[], psa? }` | batch run record |
| `export-excel.ts` | one or more run records | .xlsx file |
| `compare-runs.ts` | two or more run records | comparison JSON |

## Types

All types are exported from `src/types.ts` and re-exported from
`src/index.ts`. Key interfaces: `DecisionTreeResults`, `MarkovChainResults`,
`BudgetImpactResults`, `StateTransitionModelResults`,
`PartitionedSurvivalModelResults`, `DiscreteEventSimulationResults`.

## Determinism

All six calculators are pure functions. The PSA engine uses a single RNG
source: `PSAConfiguration.rng` if provided, else a built-in LCG seeded with
`PSAConfiguration.seed` (or `Date.now()`). Pass `seed` (CLI) or `rng` (API)
for reproducible runs.

## Provenance

Ported from the HEOR Copilot app. Behavior changes require a
characterization-test change in the same commit.

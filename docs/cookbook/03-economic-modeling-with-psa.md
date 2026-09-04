# Recipe 03: Economic modeling with PSA

Build a Markov model, run the baseline, add probabilistic sensitivity
analysis, and export to Excel.

## Scenario

You need a cost-utility analysis for a digital therapeutic, with
uncertainty quantification.

## Steps

### 1. Prepare the model input

Create `models/inputs/markov-chain.json` with baseline parameters and a
`sources` block. See `packages/heor-engine/examples/markov-chain.json` for
the parameter format. The economic-modeling skill does this for you when you
prompt it, but you can also write the file directly.

### 2. Run the baseline

```bash
npx tsx packages/heor-engine/src/cli/run-model.ts models/inputs/markov-chain.json \
  > models/runs/$(date +%F)-markov-chain.json
```

The run record JSON prints to stdout. Save it to `models/runs/`. Key
results: `totalDiscountedCost`, `totalDiscountedQALYs`, `stateTrace`.

### 3. Add a PSA block

Add a `psa` block to the same inputs file:

```json
{
  "model": "markov-chain",
  "inputs": { "...": "same as baseline" },
  "psa": {
    "numIterations": 1000,
    "seed": 42,
    "parameterRanges": {
      "Cost Healthy State": { "min": 400, "max": 800, "distribution": "lognormal", "mean": 500, "stdDev": 200 },
      "Utility Disease State": { "min": 0.6, "max": 0.8, "distribution": "triangular", "mode": 0.7 }
    }
  }
}
```

### 4. Run the PSA

```bash
npx tsx packages/heor-engine/src/cli/run-psa.ts models/inputs/markov-chain.json \
  > models/runs/$(date +%F)-markov-chain-psa.json
```

Output includes: baseline result, per-iteration results, statistics (mean,
median, p5-p95), CEAC curve, tornado diagram.

### 5. Export to Excel

```bash
npx tsx packages/heor-engine/src/cli/export-excel.ts \
  models/runs/2026-01-15-markov-chain.json \
  models/runs/2026-01-15-markov-chain-psa.json \
  --output markov-analysis.xlsx
```

The workbook includes: Markov_Inputs (parameter values), Markov_Simulation
(per-cycle state traces with live formulas), Markov_EngineResults (engine
output for verification), PSA_Statistics, PSA_CEAC, PSA_Tornado.

### 6. Verify reproducibility

Rerun the PSA with the same seed. The output must be bit-identical.

```bash
npx tsx packages/heor-engine/src/cli/run-psa.ts models/inputs/markov-chain.json 2>/dev/null > /tmp/run2.json
diff models/runs/2026-01-15-markov-chain-psa.json /tmp/run2.json
```

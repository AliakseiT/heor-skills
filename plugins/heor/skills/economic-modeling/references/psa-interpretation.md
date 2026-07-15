# PSA Interpretation

How to read and narrate the output of `run-psa.ts`. Ported from the HEOR
Copilot's probabilistic modeling documentation
(`docs/probabilistic-economic-modeling.md`) and the engine README. Every
number you report comes verbatim from the PSA run file — never recompute or
adjust statistics.

## What the run file contains

The CLI wraps the PSA payload in a run-record envelope:
`{ engine, kind: "psa-run", model, modelType, generatedAt, inputs,
psaConfig, result }` — everything below lives under `result`:

- `baselineResult` — the deterministic point estimate (identical to a
  `run-model.ts` run on the same inputs).
- `iterations` — one entry per Monte Carlo draw with the sampled
  `parameterValues` and the resulting model output.
- `statistics` — for ICER, incremental cost, and incremental utility:
  `mean`, `median`, `stdDev`, and percentiles `p5`, `p25`, `p75`, `p95`.
- `ceacCurve` — cost-effectiveness acceptability curve points: probability
  the intervention is cost-effective at willingness-to-pay (WTP) thresholds
  0, 10k, 20k, 30k, 50k, 75k, 100k, 150k, 200k (currency units per QALY).
- `tornadoDiagram` — one-way sensitivity ranking: per parameter, the
  low/high result range and the percentage impact on the baseline metric,
  sorted by impact.
- `metadata` — `numIterations`, `modelType`, timing.

## Metric semantics per model (critical caveats)

- **Decision Tree:** ICER statistics are genuine incremental
  cost-effectiveness ratios (intervention vs. comparator arm). Report the
  ICER distribution and CEAC directly.
- **Markov Chain:** the engine's Markov model is **single-arm**; the "ICER"
  statistics represent the cohort's **cost per QALY** (total discounted cost
  / total discounted QALYs), *not* an incremental comparison against a
  comparator. Say "cost per QALY" in the narration, never "ICER vs.
  comparator", unless a comparator run is separately available.
- **Budget Impact Assessment:** the headline metric is the **total net
  budget impact**; "incremental cost" statistics carry that value and there
  is no utility dimension. CEAC-style probabilities are not meaningful for
  BIA — focus on the budget-impact distribution (mean, p5–p95) and tornado.

## Reporting rules

1. **ICER / cost per QALY distribution:** report the mean and median with
   the 95% central interval as p5–p95 (e.g. "mean ICER CHF 45,200
   (SD 8,500); 95% interval CHF 35,000–55,000"). Note skew when mean and
   median diverge. If iterations produce dominated/non-calculable results,
   report their share rather than averaging over them silently.
2. **CEAC:** state the probability of cost-effectiveness at the
   jurisdiction-relevant WTP threshold(s); ask the user for the threshold if
   unknown (do not assume one). Example: "At a threshold of 20,000/QALY the
   intervention is cost-effective in 78% of iterations; at 30,000/QALY,
   92%." Describe the curve's shape only qualitatively (where it crosses
   50%, where it plateaus).
3. **Tornado diagram:** name the top 3–5 parameters by percentage impact
   with their result ranges (e.g. "Cost of Intervention: 35% impact,
   ICER range X–Y"). These are the key drivers of uncertainty — link each
   back to its evidence source and confidence from the `sources` block:
   a high-impact parameter with a low-confidence source is the first
   candidate for better evidence, and must be called out as a limitation.
4. **Robustness statement:** conclude whether the baseline conclusion holds
   across the distribution (e.g. "the intervention remains below the
   threshold in ≥95% of iterations" vs. "the decision flips within the
   plausible range of parameter X").
5. **Reproducibility & methods sentence:** always report the number of
   iterations and the seed, e.g. "Probabilistic sensitivity analysis:
   1,000 Monte Carlo iterations, seed 42." Runs without a seed are not
   reproducible — re-run with one.

## Report skeleton (from the source app's chapter integration)

```markdown
### Probabilistic Sensitivity Analysis
- <N> Monte Carlo iterations (seed <s>)
- Mean ICER: <statistics.icer.mean> (SD: <stdDev>)
- 95% interval: <p5> – <p95>

### Cost-Effectiveness Acceptability
- At <WTP1>/QALY threshold: <p>% probability cost-effective
- At <WTP2>/QALY threshold: <p>% probability cost-effective

### Key Sensitive Parameters (Tornado)
1. <param>: <impact>% impact (range <low>–<high>) — source: <citation, confidence>
2. ...
```

## Quality checks before narrating

- `metadata.numIterations` matches what was requested (default 1000; use
  more only if the user asks — iterations are stored in the run file, which
  grows accordingly).
- Baseline in the PSA file matches the standalone baseline run; if not, the
  inputs changed between runs — re-run the baseline.
- Sampled ranges behaved: spot-check that `iterations[i].parameterValues`
  stay within each parameter's [min, max]. If a range was mis-keyed (wrong
  parameter name), the engine samples nothing for it — verify every
  `parameterRanges` key appears in the iterations' `parameterValues`.

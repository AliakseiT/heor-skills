/**
 * Characterization tests for the PSA engine, run with an injected seeded LCG
 * rng so all Monte Carlo outputs are fully deterministic.
 *
 * The tornado values are hand-verifiable: with a 2-cycle undiscounted Markov
 * cohort starting at (0.6 healthy, 0.4 disease), the healthy-state occupancy
 * weight is 0.6 + 0.58 = 1.18 and the disease weight is 0.4 + 0.368 = 0.768,
 * so totalCost = 1.18 * costH + 0.768 * costD and cost/QALY = totalCost / 1.5818.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generatePSASummary,
  runProbabilisticSensitivityAnalysis,
  type PSAConfiguration,
} from '../src/index';

/** Small deterministic LCG (numerical recipes constants), values in [0, 1). */
function makeLcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const markovBaseline: Record<string, number> = {
  'Prob Healthy to Healthy': 0.9,
  'Prob Healthy to Disease': 0.08,
  'Prob Healthy to Dead': 0.02,
  'Prob Disease to Healthy': 0.1,
  'Prob Disease to Disease': 0.8,
  'Prob Disease to Dead': 0.1,
  'Cost Healthy State': 100,
  'Cost Disease State': 1000,
  'Cost Dead State': 0,
  'Utility Healthy State': 0.95,
  'Utility Disease State': 0.6,
  'Utility Dead State': 0,
  'Number of Cycles': 2,
  'Annual Discount Rate': 0,
  'Initial Cohort % Healthy': 60,
  'Initial Cohort % Disease': 40,
};

const markovRanges = {
  'Cost Healthy State': { min: 80, max: 120, distribution: 'uniform' as const },
  'Cost Disease State': { min: 800, max: 1200, distribution: 'uniform' as const },
};

function markovConfig(overrides: Partial<PSAConfiguration> = {}): PSAConfiguration {
  return {
    modelType: 'Markov Chain',
    baselineInputs: { ...markovBaseline },
    parameterRanges: { ...markovRanges },
    numIterations: 200,
    ...overrides,
  };
}

describe('runProbabilisticSensitivityAnalysis (Markov Chain, injected LCG rng)', () => {
  beforeEach(() => {
    // Keep the engine's debug logging out of test output.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('runs the requested number of iterations and samples only the ranged parameters', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));

    expect(result.iterations).toHaveLength(200);
    expect(result.metadata.numIterations).toBe(200);
    expect(result.metadata.modelType).toBe('Markov Chain');
    for (const iteration of [result.iterations[0], result.iterations[199]]) {
      expect(Object.keys(iteration.parameterValues).sort()).toEqual([
        'Cost Disease State',
        'Cost Healthy State',
      ]);
      expect(iteration.results.error).toBeUndefined();
    }
    // First sampled draws from LCG(42) — fully deterministic
    expect(result.iterations[0].parameterValues['Cost Healthy State']).toBeCloseTo(90.0938, 4);
    expect(result.iterations[0].parameterValues['Cost Disease State']).toBeCloseTo(835.25, 2);
    expect(result.iterations[0].results.totalDiscountedCost).toBeCloseTo(747.78, 2);
  });

  it('reports the baseline cost/QALY metric on the enhanced baseline result', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));
    // Baseline: totalCost 886 / totalQALYs 1.5818 = 560.1214
    expect(result.baselineResult.totalDiscountedCost).toBe(886);
    expect(result.baselineResult.totalDiscountedQALYs).toBeCloseTo(1.5818, 4);
    expect(result.baselineResult.icer).toBeCloseTo(560.1214, 3);
    expect(result.baselineResult.costEffectivenessMetric).toBeCloseTo(560.1214, 3);
  });

  it('produces stable summary statistics for the seeded rng', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));
    const { icer, incrementalCost, incrementalUtility } = result.statistics;

    expect(icer.mean).toBeCloseTo(561.7039, 3);
    expect(icer.median).toBeCloseTo(557.9245, 3);
    expect(icer.stdDev).toBeCloseTo(58.5258, 3);
    expect(icer.p5).toBeCloseTo(472.6776, 3);
    expect(icer.p25).toBeCloseTo(511.0428, 3);
    expect(icer.p75).toBeCloseTo(612.225, 3);
    expect(icer.p95).toBeCloseTo(648.9335, 3);

    expect(incrementalCost.mean).toBeCloseTo(888.5032, 3);
    expect(incrementalCost.median).toBeCloseTo(882.525, 3);
    expect(incrementalCost.stdDev).toBeCloseTo(92.5761, 3);
    expect(incrementalCost.p5).toBeCloseTo(747.6815, 3);
    expect(incrementalCost.p95).toBeCloseTo(1026.483, 3);

    // QALYs are unaffected by the sampled cost parameters
    expect(incrementalUtility.mean).toBeCloseTo(1.5818, 4);
    expect(incrementalUtility.stdDev).toBeCloseTo(0, 10);
  });

  it('is reproducible: identical rng seeds give identical statistics, different seeds differ', async () => {
    const a = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(7) }));
    const b = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(7) }));
    const c = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(8) }));
    expect(a.statistics).toEqual(b.statistics);
    expect(a.statistics.icer.mean).not.toBe(c.statistics.icer.mean);
  });

  it('is reproducible via the built-in seeded generator when only `seed` is given', async () => {
    const a = await runProbabilisticSensitivityAnalysis(markovConfig({ seed: 12345 }));
    const b = await runProbabilisticSensitivityAnalysis(markovConfig({ seed: 12345 }));
    expect(a.statistics).toEqual(b.statistics);
  });

  it('generates the CEAC curve over the fixed threshold grid', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));
    expect(result.ceacCurve.map(p => p.threshold)).toEqual([
      0, 10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000,
    ]);
    // Cost/QALY is ~460-660 in every iteration: never below 0, always below 10k
    expect(result.ceacCurve[0].probability).toBe(0);
    for (const point of result.ceacCurve.slice(1)) {
      expect(point.probability).toBe(1);
    }
  });

  it('generates a tornado diagram sorted by one-way impact', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));
    expect(result.tornadoDiagram).toHaveLength(2);

    const [first, second] = result.tornadoDiagram;
    // Disease-state cost dominates: (1.18*100 + 0.768*800)/1.5818 = 463.02 low,
    // (1.18*100 + 0.768*1200)/1.5818 = 657.23 high
    expect(first.parameterName).toBe('Cost Disease State');
    expect(first.baselineValue).toBe(1000);
    expect(first.lowValue).toBe(800);
    expect(first.highValue).toBe(1200);
    expect(first.icer_low).toBeCloseTo(463.0168, 3);
    expect(first.icer_high).toBeCloseTo(657.2259, 3);
    expect(first.impact).toBeCloseTo(194.2091, 3);

    // Healthy-state cost: (1.18*80 + 0.768*1000)/1.5818 = 545.20 low, 575.04 high
    expect(second.parameterName).toBe('Cost Healthy State');
    expect(second.icer_low).toBeCloseTo(545.2017, 3);
    expect(second.icer_high).toBeCloseTo(575.0411, 3);
    expect(second.impact).toBeCloseTo(29.8394, 3);

    expect(first.impact).toBeGreaterThan(second.impact);
  });

  it('honors fixedParameters passed as an array (Firestore-style serialization)', async () => {
    const result = await runProbabilisticSensitivityAnalysis(
      markovConfig({ rng: makeLcg(42), fixedParameters: ['Cost Healthy State'] })
    );
    // The fixed parameter is not sampled; the Markov constraint pass re-adds it
    // pinned to its baseline value in every iteration (source behavior).
    for (const iteration of [result.iterations[0], result.iterations[199]]) {
      expect(iteration.parameterValues['Cost Healthy State']).toBe(100);
    }
    expect(result.tornadoDiagram).toHaveLength(1);
    expect(result.tornadoDiagram[0].parameterName).toBe('Cost Disease State');
    expect(result.metadata.fixedParameters).toEqual(['Cost Healthy State']);
  });

  it('rejects when the baseline calculation fails', async () => {
    const badBaseline = { ...markovBaseline, 'Prob Healthy to Healthy': 0.5 };
    await expect(
      runProbabilisticSensitivityAnalysis(markovConfig({ baselineInputs: badBaseline, rng: makeLcg(1) }))
    ).rejects.toThrow('Baseline model calculation failed: Probabilities from Healthy state must sum to 1.');
  });

  it('renders a textual summary with statistics and top tornado parameters', async () => {
    const result = await runProbabilisticSensitivityAnalysis(markovConfig({ rng: makeLcg(42) }));
    const summary = generatePSASummary(result);
    expect(summary).toContain('Iterations: 200');
    expect(summary).toContain('Model Type: Markov Chain');
    expect(summary).toContain('Mean: $561.70');
    expect(summary).toContain('1. Cost Disease State');
  });
});

describe('runProbabilisticSensitivityAnalysis (Decision Tree, injected LCG rng)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('runs decision-tree PSA over template-named baseline inputs', async () => {
    // Template (display) names; the engine maps them to internal camelCase names.
    const baselineInputs: Record<string, number> = {
      'Cost of Intervention Test': 50,
      'Sensitivity of Intervention Test': 0.85,
      'Specificity of Intervention Test': 0.9,
      'Cost of Comparator Test': 40,
      'Sensitivity of Comparator Test': 0.75,
      'Specificity of Comparator Test': 0.8,
      'Prevalence of Disease/Condition': 0.15,
      'Cost of Treatment (Correct Positive)': 2000,
      'Utility of Treatment (Correct Positive)': 0.8,
      'Cost of False Positive Management': 500,
      'Utility of False Positive State': 0.6,
      'Cost of False Negative Consequence': 5000,
      'Utility of False Negative State': 0.3,
      'Cost of Correct Negative Management': 100,
      'Utility of Correct Negative State': 1.0,
    };
    const result = await runProbabilisticSensitivityAnalysis({
      modelType: 'Decision Tree',
      baselineInputs,
      parameterRanges: {
        'Cost of Intervention Test': { min: 25, max: 100, distribution: 'uniform' },
      },
      numIterations: 50,
      rng: makeLcg(99),
    });

    expect(result.iterations).toHaveLength(50);
    // Baseline reproduces the deterministic decision-tree run (dominant → icer -1662.65)
    expect(result.baselineResult.incrementalCost).toBeCloseTo(-69, 6);
    expect(result.baselineResult.icer).toBeCloseTo(-1662.65, 1);
    // Each iteration shifts only the intervention test cost:
    // incrementalCost_i = costInterventionTest_i - 50 - 69
    const it0 = result.iterations[0];
    const sampledCost = it0.parameterValues['Cost of Intervention Test'];
    expect(it0.results.incrementalCost).toBeCloseTo(sampledCost - 50 - 69, 1);
  });
});

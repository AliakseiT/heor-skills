/**
 * Characterization tests for the batch scenario executor.
 *
 * Uses the digital-therapy device class (Decision Tree). Its defaults are the
 * same values as the hand-verified decision-tree test: baseline ICER -1662.65
 * (dominant). The alternative scenario raises the intervention test cost by
 * 100, so incrementalCost moves from -69 to +31 and the ICER to
 * 31 / 0.0415 = 746.99.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCache,
  executeBatch,
  executeScenario,
  generateSensitivityScenarios,
  getCacheStats,
  type ScenarioExecutionConfig,
} from '../src/index';

function baselineConfig(): ScenarioExecutionConfig {
  return {
    scenarioId: 'baseline',
    scenarioName: 'Baseline',
    deviceClass: 'digital-therapy',
    baselineInputs: {},
  };
}

function highCostConfig(): ScenarioExecutionConfig {
  return {
    scenarioId: 'high-cost',
    scenarioName: 'High intervention cost',
    deviceClass: 'digital-therapy',
    baselineInputs: {},
    parameterOverrides: { costInterventionTest: 150 },
  };
}

describe('executeScenario', () => {
  beforeEach(() => {
    clearCache();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('fills gaps with device-class defaults and computes the baseline model', async () => {
    const result = await executeScenario(baselineConfig());
    expect(result.status).toBe('success');
    expect(result.error).toBeUndefined();
    // All 15 decision-tree parameters come from the digital-therapy defaults
    expect(Object.keys(result.mergedInputs)).toHaveLength(15);
    expect(result.mergedInputs.costInterventionTest).toBe(50);
    expect(result.mergeLog!.every(l => l.source === 'device-class-default')).toBe(true);
    // Deterministic decision-tree outputs (same numbers as the ce-models test)
    expect(result.baselineResult.interventionArm.expectedCost).toBeCloseTo(536.5, 6);
    expect(result.baselineResult.comparatorArm.expectedCost).toBeCloseTo(605.5, 6);
    expect(result.baselineResult.incrementalCost).toBeCloseTo(-69, 6);
    expect(result.baselineResult.icer).toBeCloseTo(-1662.65, 1);
  });

  it('applies parameterOverrides with highest priority', async () => {
    const result = await executeScenario(highCostConfig());
    expect(result.status).toBe('success');
    expect(result.mergedInputs.costInterventionTest).toBe(150);
    // Intervention arm cost rises by exactly 100 → incremental +31, ICER 746.99
    expect(result.baselineResult.interventionArm.expectedCost).toBeCloseTo(636.5, 6);
    expect(result.baselineResult.incrementalCost).toBeCloseTo(31, 6);
    expect(result.baselineResult.icer).toBeCloseTo(746.99, 1);
  });

  it('lets caller baseline inputs (display names) override only undocumented defaults', async () => {
    const result = await executeScenario({
      ...baselineConfig(),
      scenarioId: 'display-name-baseline',
      baselineInputs: {
        // Has a literature source in the defaults library → NOT overridden (source behavior)
        'Cost of Intervention Test': 150,
        // No documented source → merge source is 'Device class default' → overridden
        'Cost of Treatment (Correct Positive)': 2500,
      },
    });
    expect(result.status).toBe('success');
    expect(result.mergedInputs.costInterventionTest).toBe(50);
    expect(result.mergedInputs.costTreatmentCorrectPositive).toBe(2500);
    // Treatment cost +500 in both arms: intervention +0.1275*500, comparator +0.1125*500
    expect(result.baselineResult.incrementalCost).toBeCloseTo(-61.5, 6);
  });

  it('gives AI-suggested inputs priority over caller baseline inputs', async () => {
    const result = await executeScenario({
      ...baselineConfig(),
      scenarioId: 'ai-priority',
      baselineInputs: { 'Cost of Intervention Test': 150 },
      aiSuggestedInputs: { costInterventionTest: 60 },
    });
    expect(result.status).toBe('success');
    expect(result.mergedInputs.costInterventionTest).toBe(60);
  });

  it('serves repeated identical configurations from the cache', async () => {
    const first = await executeScenario(baselineConfig());
    expect(first.cacheHit).toBe(false);
    const second = await executeScenario(baselineConfig());
    expect(second.status).toBe('cached');
    expect(second.cacheHit).toBe(true);
    expect(second.baselineResult.icer).toBe(first.baselineResult.icer);
    expect(getCacheStats().size).toBeGreaterThan(0);
  });

  it('fails gracefully for an unknown device class', async () => {
    const result = await executeScenario({ ...baselineConfig(), deviceClass: 'custom' });
    expect(result.status).toBe('failed');
    expect(result.error).toBe('Unknown device class: custom');
  });
});

describe('executeBatch (baseline vs alternative scenario)', () => {
  beforeEach(() => {
    clearCache();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('runs both scenarios and aggregates comparative metrics', async () => {
    const batch = await executeBatch({ scenarios: [baselineConfig(), highCostConfig()] });

    expect(batch.totalScenarios).toBe(2);
    expect(batch.successfulScenarios).toBe(2);
    expect(batch.failedScenarios).toBe(0);
    expect(batch.cachedScenarios).toBe(0);

    const [base, alt] = batch.results;
    expect(base.scenarioId).toBe('baseline');
    expect(alt.scenarioId).toBe('high-cost');

    // Comparative deltas between the two scenarios
    const deltaCost = alt.baselineResult.incrementalCost - base.baselineResult.incrementalCost;
    const deltaIcer = (alt.baselineResult.icer as number) - (base.baselineResult.icer as number);
    expect(deltaCost).toBeCloseTo(100, 6); // +100 intervention test cost flows through 1:1
    expect(deltaIcer).toBeCloseTo(2409.64, 1); // 746.99 - (-1662.65)

    // Aggregated metrics across both scenarios
    expect(batch.aggregatedMetrics).toBeDefined();
    expect(batch.aggregatedMetrics!.averageICER).toBeCloseTo((-1662.65 + 746.99) / 2, 1);
    expect(batch.aggregatedMetrics!.icer_range!.min).toBeCloseTo(-1662.65, 1);
    expect(batch.aggregatedMetrics!.icer_range!.max).toBeCloseTo(746.99, 1);
    expect(batch.aggregatedMetrics!.averageIncrementalCost).toBeCloseTo((-69 + 31) / 2, 6);
    expect(batch.aggregatedMetrics!.averageIncrementalUtility).toBeCloseTo(0.041, 6);
  });

  it('counts failed scenarios without aborting the batch', async () => {
    const batch = await executeBatch({
      scenarios: [baselineConfig(), { ...highCostConfig(), deviceClass: 'custom' }],
    });
    expect(batch.successfulScenarios).toBe(1);
    expect(batch.failedScenarios).toBe(1);
  });
});

describe('generateSensitivityScenarios', () => {
  it('creates a baseline plus evenly spaced one-way scenarios', () => {
    const scenarios = generateSensitivityScenarios(baselineConfig(), {
      prevalenceDisease: { min: 0.1, max: 0.2, steps: 3 },
    });
    expect(scenarios).toHaveLength(4);
    expect(scenarios[0].scenarioId).toBe('baseline_baseline');
    expect(scenarios[1].parameterOverrides!.prevalenceDisease).toBeCloseTo(0.1, 10);
    expect(scenarios[2].parameterOverrides!.prevalenceDisease).toBeCloseTo(0.15, 10);
    expect(scenarios[3].parameterOverrides!.prevalenceDisease).toBeCloseTo(0.2, 10);
  });
});

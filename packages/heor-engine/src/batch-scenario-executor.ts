/**
 * Batch Scenario Executor Service
 *
 * Manages execution of multiple economic modeling scenarios with caching,
 * parallel processing, and result aggregation for sensitivity analysis.
 *
 * Ported from HEOR Copilot src/services/batch-scenario-executor.ts
 * (characterization port — logic unchanged; imports rewired).
 */

import { mergeEconomicInputs, validateMergedInputs } from './economic-input-merger';
import { getDefaultsForDeviceClass, type DeviceClass } from './economic-model-defaults';
import { findDefaultsParameterName } from './parameter-name-mapper';
import { calculateBudgetImpactModel, calculateDecisionTreeModel, calculateMarkovModel } from './ce-models';
import { PSAConfiguration, runProbabilisticSensitivityAnalysis, PSAResult } from './probabilistic-sensitivity-analysis';

export interface ScenarioExecutionConfig {
  scenarioId: string;
  scenarioName: string;
  deviceClass: DeviceClass;
  baselineInputs: Record<string, number | string>;
  aiSuggestedInputs?: Record<string, number | string>;
  expertProvidedInputs?: Record<string, number | string>;
  parameterOverrides?: Record<string, number | string>;
  psaConfig?: Partial<PSAConfiguration>;
  runPSA?: boolean;
}

export interface ScenarioExecutionResult {
  scenarioId: string;
  scenarioName: string;
  status: 'success' | 'failed' | 'cached';
  mergedInputs: Record<string, number | string>;
  baselineResult?: any;
  psaResult?: PSAResult;
  executionTimeMs: number;
  cacheHit?: boolean;
  error?: string;
  mergeLog?: Array<{
    parameter: string;
    source: 'ai-suggested' | 'expert-provided' | 'device-class-default';
    value: number | string;
  }>;
}

export interface BatchExecutionConfig {
  scenarios: ScenarioExecutionConfig[];
  parallelExecutions?: number;
  enableCaching?: boolean;
  cacheKeyPrefix?: string;
}

export interface BatchExecutionResult {
  batchId: string;
  totalScenarios: number;
  successfulScenarios: number;
  failedScenarios: number;
  cachedScenarios: number;
  results: ScenarioExecutionResult[];
  totalExecutionTimeMs: number;
  aggregatedMetrics?: {
    averageICER?: number;
    icer_range?: { min: number; max: number };
    averageIncrementalCost?: number;
    averageIncrementalUtility?: number;
  };
}

/**
 * In-memory cache for scenario results
 * In production, this should be replaced with Redis or similar
 */
class ScenarioCache {
  private cache: Map<string, ScenarioExecutionResult> = new Map();
  private maxSize: number = 1000;

  set(key: string, value: ScenarioExecutionResult): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value as string;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  get(key: string): ScenarioExecutionResult | undefined {
    return this.cache.get(key);
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const globalCache = new ScenarioCache();

/**
 * Generate cache key from scenario configuration
 * Includes all input sources and PSA settings to ensure different configurations produce different keys
 */
function generateCacheKey(config: ScenarioExecutionConfig, prefix: string = 'scenario'): string {
  const inputsHash = JSON.stringify({
    deviceClass: config.deviceClass,
    baselineInputs: config.baselineInputs,
    aiSuggestedInputs: config.aiSuggestedInputs,
    expertProvidedInputs: config.expertProvidedInputs,
    parameterOverrides: config.parameterOverrides,
    runPSA: config.runPSA,
    psaConfig: config.psaConfig ? {
      numIterations: config.psaConfig.numIterations,
      seed: config.psaConfig.seed,
      fixedParameters: config.psaConfig.fixedParameters ? Array.from(config.psaConfig.fixedParameters).sort() : undefined,
      modelType: config.psaConfig.modelType,
    } : undefined,
  });

  // Simple hash function for consistent cache keys
  let hash = 0;
  for (let i = 0; i < inputsHash.length; i++) {
    const char = inputsHash.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `${prefix}:${config.deviceClass}:${Math.abs(hash)}`;
}

/**
 * Execute a single scenario with optional PSA
 */
export async function executeScenario(
  config: ScenarioExecutionConfig,
  useCache: boolean = true,
  cacheKeyPrefix: string = 'scenario'
): Promise<ScenarioExecutionResult> {
  const startTime = Date.now();
  const cacheKey = generateCacheKey(config, cacheKeyPrefix);

  // Check cache
  if (useCache && globalCache.has(cacheKey)) {
    const cached = globalCache.get(cacheKey)!;
    return {
      ...cached,
      cacheHit: true,
      status: 'cached',
    };
  }

  try {
    // Get device class defaults
    const defaults = getDefaultsForDeviceClass(config.deviceClass);
    if (!defaults || defaults.length === 0) {
      throw new Error(`Unknown device class: ${config.deviceClass}`);
    }

    // Create merge strategy with proper priority:
    // AI suggestions > Expert inputs > Baseline inputs > Device class defaults
    const mergeStrategy = {
      aiSuggestedInputs: config.aiSuggestedInputs,
      expertProvidedInputs: config.expertProvidedInputs,
      deviceClassDefaults: defaults[0],
    };

    // Merge inputs: AI suggestions > Expert inputs > Device class defaults
    const mergeResult = mergeEconomicInputs(mergeStrategy);

    // Apply caller-provided baseline inputs with correct priority:
    // AI/Expert > Baseline > Defaults
    // Start with defaults, then apply baseline, then apply AI/Expert, then overrides
    const baselineWithDefaults: Record<string, number | string> = {};

    // First, add device class defaults as the base layer
    Object.assign(baselineWithDefaults, mergeResult.mergedInputs);

    // Then, apply caller-provided baseline inputs (overrides defaults but not AI/Expert)
    // Only override if the value came from defaults, not from AI/Expert suggestions
    // Map baseline keys from display names to internal parameter names
    Object.entries(config.baselineInputs).forEach(([key, value]) => {
      // Convert baseline key to internal parameter name (e.g., "Cost of Intervention Test" -> "costInterventionTest")
      const internalParamName = findDefaultsParameterName(key) || key;
      const parameterSource = mergeResult.sources[internalParamName];
      // Only apply baseline if this parameter wasn't set by AI or Expert
      if (!parameterSource || parameterSource === 'Device class default') {
        baselineWithDefaults[internalParamName] = value;
      }
    });

    // Apply parameter overrides (highest priority)
    const finalInputs = {
      ...baselineWithDefaults,
      ...config.parameterOverrides,
    };

    // Validate merged inputs - get expected parameters from defaults
    const expectedParams = Object.keys(defaults[0].baselineInputs);
    const validation = validateMergedInputs(finalInputs, expectedParams);
    if (!validation.isValid) {
      throw new Error(`Input validation failed: ${validation.invalidParameters.map(p => p.reason).join(', ')}`);
    }

    // Execute baseline computation using the actual model
    // Determine model type: use caller's config, then device class default, then fallback
    let modelType = config.psaConfig?.modelType as any;
    if (!modelType && defaults[0].modelType) {
      modelType = defaults[0].modelType;
    }
    if (!modelType) {
      modelType = 'Decision Tree'; // Final fallback
    }

    // Convert final inputs to the format expected by the model functions
    const normalizedFinalInputs: Record<string, number | string> = {};
    Object.entries(finalInputs).forEach(([key, value]) => {
      // Convert string numbers to actual numbers
      if (typeof value === 'string' && !isNaN(Number(value))) {
        normalizedFinalInputs[key] = Number(value);
      } else {
        normalizedFinalInputs[key] = value;
      }
    });

    // Calculate baseline using the appropriate model
    let baselineResult;
    if (modelType === 'Decision Tree') {
      baselineResult = calculateDecisionTreeModel(normalizedFinalInputs as any);
    } else if (modelType === 'Markov Chain') {
      baselineResult = calculateMarkovModel(normalizedFinalInputs as any);
    } else if (modelType === 'Budget Impact Assessment') {
      baselineResult = calculateBudgetImpactModel(normalizedFinalInputs as any);
    } else {
      throw new Error(`Unknown model type: ${modelType}`);
    }

    // Check if baseline calculation failed
    if (baselineResult.error) {
      throw new Error(`Baseline model calculation failed: ${baselineResult.error}`);
    }

    // Run PSA if requested
    let psaResult: PSAResult | undefined;
    if (config.runPSA) {
      // Determine model type: use caller's config, then device class default, then fallback
      let modelType = config.psaConfig?.modelType as any;
      if (!modelType && defaults[0].modelType) {
        modelType = defaults[0].modelType;
      }
      if (!modelType) {
        modelType = 'Decision Tree'; // Final fallback
      }

      const psaConfig: PSAConfiguration = {
        baselineInputs: finalInputs,
        parameterRanges: mergeResult.parameterRanges,
        numIterations: config.psaConfig?.numIterations || 1000,
        fixedParameters: config.psaConfig?.fixedParameters,
        seed: config.psaConfig?.seed,
        rng: config.psaConfig?.rng,
        modelType,
      };

      psaResult = await runProbabilisticSensitivityAnalysis(psaConfig);
    }

    const executionTimeMs = Date.now() - startTime;
    const result: ScenarioExecutionResult = {
      scenarioId: config.scenarioId,
      scenarioName: config.scenarioName,
      status: 'success',
      mergedInputs: finalInputs,
      baselineResult,
      psaResult,
      executionTimeMs,
      cacheHit: false,
      mergeLog: mergeResult.mergeLog,
    };

    // Cache result
    if (useCache) {
      globalCache.set(cacheKey, result);
    }

    return result;
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    return {
      scenarioId: config.scenarioId,
      scenarioName: config.scenarioName,
      status: 'failed',
      mergedInputs: {},
      executionTimeMs,
      cacheHit: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute multiple scenarios in batch with optional parallelization
 */
export async function executeBatch(
  batchConfig: BatchExecutionConfig
): Promise<BatchExecutionResult> {
  const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  const parallelExecutions = batchConfig.parallelExecutions || 4;
  const enableCaching = batchConfig.enableCaching !== false;
  const cacheKeyPrefix = batchConfig.cacheKeyPrefix || 'scenario';

  const results: ScenarioExecutionResult[] = [];

  // Execute scenarios in parallel batches
  for (let i = 0; i < batchConfig.scenarios.length; i += parallelExecutions) {
    const batch = batchConfig.scenarios.slice(i, i + parallelExecutions);
    const batchPromises = batch.map((scenario) =>
      executeScenario(scenario, enableCaching, cacheKeyPrefix)
    );

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  const totalExecutionTimeMs = Date.now() - startTime;

  // Calculate aggregated metrics
  const successfulResults = results.filter((r) => r.status === 'success' || r.status === 'cached');
  // Filter for numeric ICERs only to handle string values like "Dominated"
  const numericIcerResults = successfulResults.filter(r =>
    typeof r.baselineResult?.icer === 'number'
  );
  const aggregatedMetrics = successfulResults.length > 0 ? {
    averageICER: numericIcerResults.length > 0 ?
      numericIcerResults.reduce((sum, r) => sum + r.baselineResult!.icer!, 0) / numericIcerResults.length : 0,
    icer_range: numericIcerResults.length > 0 ? {
      min: Math.min(...numericIcerResults.map((r) => r.baselineResult!.icer!)),
      max: Math.max(...numericIcerResults.map((r) => r.baselineResult!.icer!)),
    } : { min: 0, max: 0 },
    averageIncrementalCost: successfulResults.reduce((sum, r) => {
      const cost = typeof r.baselineResult?.incrementalCost === 'number' ? r.baselineResult.incrementalCost : 0;
      return sum + cost;
    }, 0) / successfulResults.length,
    averageIncrementalUtility: successfulResults.reduce((sum, r) => {
      const utility = typeof r.baselineResult?.incrementalUtility === 'number' ? r.baselineResult.incrementalUtility : 0;
      return sum + utility;
    }, 0) / successfulResults.length,
  } : undefined;

  return {
    batchId,
    totalScenarios: batchConfig.scenarios.length,
    successfulScenarios: results.filter((r) => r.status === 'success').length,
    failedScenarios: results.filter((r) => r.status === 'failed').length,
    cachedScenarios: results.filter((r) => r.status === 'cached').length,
    results,
    totalExecutionTimeMs,
    aggregatedMetrics,
  };
}

/**
 * Create scenarios from parameter ranges for sensitivity analysis
 */
export function generateSensitivityScenarios(
  baselineConfig: ScenarioExecutionConfig,
  parameterRanges: Record<string, { min: number; max: number; steps: number }>
): ScenarioExecutionConfig[] {
  const scenarios: ScenarioExecutionConfig[] = [];

  // Add baseline scenario
  scenarios.push({
    ...baselineConfig,
    scenarioId: `${baselineConfig.scenarioId}_baseline`,
    scenarioName: `${baselineConfig.scenarioName} (Baseline)`,
  });

  // Generate one-way sensitivity scenarios
  Object.entries(parameterRanges).forEach(([paramName, range]) => {
    for (let i = 0; i < range.steps; i++) {
      const value = range.min + ((range.max - range.min) / (range.steps - 1)) * i;
      scenarios.push({
        ...baselineConfig,
        scenarioId: `${baselineConfig.scenarioId}_${paramName}_${i}`,
        scenarioName: `${baselineConfig.scenarioName} (${paramName}: ${value.toFixed(2)})`,
        parameterOverrides: {
          ...baselineConfig.parameterOverrides,
          [paramName]: value,
        },
      });
    }
  });

  return scenarios;
}

/**
 * Clear the global cache
 */
export function clearCache(): void {
  globalCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: globalCache.size(),
    maxSize: 1000,
  };
}

export default {
  executeScenario,
  executeBatch,
  generateSensitivityScenarios,
  clearCache,
  getCacheStats,
};

/**
 * Probabilistic Sensitivity Analysis (PSA) Service
 * Implements Monte Carlo simulation for economic models
 * Generates tornado diagrams and CEAC curves
 *
 * Ported from HEOR Copilot src/services/probabilistic-sensitivity-analysis.ts
 * (characterization port — logic unchanged, with one permitted behavioral
 * touch: an injectable `rng: () => number` can be supplied via
 * `PSAConfiguration.rng` for deterministic runs; when omitted, behavior is
 * identical to the original seeded-LCG implementation).
 */

import type { ParameterDistribution } from './economic-model-defaults';
import { findDefaultsParameterName, findTemplateParameterName } from './parameter-name-mapper';
import { calculateBudgetImpactModel, calculateDecisionTreeModel, calculateMarkovModel } from './ce-models';

export interface PSAConfiguration {
  baselineInputs: Record<string, number | string>;
  parameterRanges: Record<string, ParameterDistribution>;
  numIterations: number;
  fixedParameters?: Set<string> | string[];
  seed?: number;
  /**
   * Optional injectable random source returning values in [0, 1).
   * Defaults to the built-in seeded LCG (seeded with `seed`, or Date.now()).
   */
  rng?: () => number;
  modelType: 'Decision Tree' | 'Markov Chain' | 'Budget Impact Assessment';
  // New fields for enhanced sensitivity analysis
  baselineRunId?: string; // Reference to saved CEA run
  parameterRangeOverrides?: Record<string, { min: number; max: number }>; // Custom ranges per parameter
}

export interface ParameterRangeInfo {
  parameterName: string;
  baselineValue: number;
  defaultMin: number;
  defaultMax: number;
  customMin?: number;
  customMax: number;
  isFixed: boolean;
  distribution: string;
}

export interface PSAIteration {
  iterationId: number;
  parameterValues: Record<string, number>;
  results: any;
}

export interface PSAStatistics {
  icer: {
    mean: number;
    median: number;
    stdDev: number;
    p5: number;
    p25: number;
    p75: number;
    p95: number;
  };
  incrementalCost: {
    mean: number;
    median: number;
    stdDev: number;
    p5: number;
    p95: number;
  };
  incrementalUtility: {
    mean: number;
    median: number;
    stdDev: number;
    p5: number;
    p95: number;
  };
}

export interface CEACPoint {
  threshold: number;
  probability: number;
}

export interface TornadoParameter {
  parameterName: string;
  baselineValue: number;
  lowValue: number;
  highValue: number;
  icer_low: number;
  icer_high: number;
  value_low: number;
  value_high: number;
  impact: number;
  percentageImpact: number;
}

export interface PSAResult {
  baselineResult: any;
  iterations: PSAIteration[];
  statistics: PSAStatistics;
  ceacCurve: CEACPoint[];
  tornadoDiagram: TornadoParameter[];
  metadata: {
    numIterations: number;
    modelType: string;
    generatedAt: number;
    executionTimeMs: number;
    fixedParameters?: Set<string> | string[];
    iterationsDataId?: string;
    iterationsStoredExternally?: boolean;
    iterationsTruncated?: boolean;
    originalIterationCount?: number;
  };
}

/**
 * Seeded random number generator for reproducibility
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Sample from various probability distributions
 */
function sampleFromDistribution(distribution: ParameterDistribution, rng: () => number): number {
  const u = rng();

  switch (distribution.distribution) {
    case 'uniform':
      return distribution.min + u * (distribution.max - distribution.min);

    case 'triangular': {
      const a = distribution.min;
      const b = distribution.max;
      const c = distribution.mode || (a + b) / 2;
      const fc = (c - a) / (b - a);

      if (u < fc) {
        return a + Math.sqrt(u * (b - a) * (c - a));
      } else {
        return b - Math.sqrt((1 - u) * (b - a) * (b - c));
      }
    }

    case 'normal': {
      const mean = distribution.mean || (distribution.min + distribution.max) / 2;
      const stdDev = distribution.stdDev || (distribution.max - distribution.min) / 4;
      // Box-Muller transform
      const u1 = rng();
      const u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const value = mean + z * stdDev;
      // Clamp to range
      return Math.max(distribution.min, Math.min(distribution.max, value));
    }

    case 'lognormal': {
      const mean = distribution.mean || (distribution.min + distribution.max) / 2;
      const stdDev = distribution.stdDev || (distribution.max - distribution.min) / 4;
      const mu = Math.log(mean / Math.sqrt(1 + (stdDev / mean) ** 2));
      const sigma = Math.sqrt(Math.log(1 + (stdDev / mean) ** 2));
      const u1 = rng();
      const u2 = rng();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const value = Math.exp(mu + sigma * z);
      // Clamp to range
      return Math.max(distribution.min, Math.min(distribution.max, value));
    }

    default:
      return distribution.min + u * (distribution.max - distribution.min);
  }
}

/**
 * Sample parameter values from distributions
 */
function sampleParameters(
  parameterRanges: Record<string, ParameterDistribution>,
  fixedParameters: Set<string> | undefined,
  rng: () => number,
  rangeOverrides?: Record<string, { min: number; max: number }>,
  modelType?: string,
  baselineInputs?: Record<string, number | string>
): Record<string, number> {
  const sampledParams: Record<string, number> = {};

  Object.entries(parameterRanges).forEach(([param, range]) => {
    if (!fixedParameters?.has(param)) {
      // Apply custom range overrides if provided
      let effectiveRange = range;
      if (rangeOverrides?.[param]) {
        const override = rangeOverrides[param];
        effectiveRange = {
          ...range,
          min: override.min,
          max: override.max,
        };
      }
      sampledParams[param] = sampleFromDistribution(effectiveRange, rng);
    }
  });

  // Apply constrained sampling for Markov Chain models to ensure probability sums = 1.0
  if (modelType === 'Markov Chain') {
    return applyMarkovChainConstraints(sampledParams, parameterRanges, fixedParameters, baselineInputs);
  }

  return sampledParams;
}

/**
 * Apply Markov Chain probability constraints to ensure valid transition probabilities
 */
function applyMarkovChainConstraints(
  sampledParams: Record<string, number>,
  parameterRanges: Record<string, ParameterDistribution>,
  fixedParameters: Set<string> | undefined,
  baselineInputs?: Record<string, number | string>
): Record<string, number> {
  try {
    const constrainedParams = { ...sampledParams };

    // Seed constrainedParams with baseline values for fixed parameters
    if (baselineInputs && fixedParameters) {
      fixedParameters.forEach(param => {
        const baselineValue = baselineInputs[param];
        if (typeof baselineValue === 'number' || (typeof baselineValue === 'string' && !isNaN(Number(baselineValue)))) {
          constrainedParams[param] = Number(baselineValue);
        }
      });
    }

    // Group transition probabilities by source state
    const healthyProbs = ['Prob Healthy to Healthy', 'Prob Healthy to Disease', 'Prob Healthy to Dead'];
    const diseaseProbs = ['Prob Disease to Healthy', 'Prob Disease to Disease', 'Prob Disease to Dead'];

    // Apply constraints for Healthy state transitions
    const healthySum = healthyProbs.reduce((sum, prob) => sum + (constrainedParams[prob] || 0), 0);

    if (healthySum > 0 && Math.abs(healthySum - 1.0) > 1e-6) {
      // Normalize to sum to 1.0, but keep fixed parameters unchanged
      let variableHealthySum = 0;
      const variableHealthyProbs: string[] = [];

      healthyProbs.forEach(prob => {
        if (!fixedParameters?.has(prob)) {
          const value = constrainedParams[prob] || 0;
          variableHealthySum += value;
          if (value > 0) {
            variableHealthyProbs.push(prob);
          }
        }
      });

      if (variableHealthySum > 0) {
        const fixedHealthySum = healthyProbs.reduce((sum, prob) => {
          return sum + (fixedParameters?.has(prob) ? (constrainedParams[prob] || 0) : 0);
        }, 0);

        const targetSum = Math.max(0, 1.0 - fixedHealthySum);

        if (targetSum > 0) {
          // Scale variable probabilities to meet the target sum
          const scale = targetSum / variableHealthySum;
          variableHealthyProbs.forEach(prob => {
            const currentValue = constrainedParams[prob] || 0;
            const newValue = Math.max(0, Math.min(1, currentValue * scale));
            constrainedParams[prob] = newValue;
          });
        }
      }
    }

    // Apply constraints for Disease state transitions
    const diseaseSum = diseaseProbs.reduce((sum, prob) => sum + (constrainedParams[prob] || 0), 0);

    if (diseaseSum > 0 && Math.abs(diseaseSum - 1.0) > 1e-6) {
      // Normalize to sum to 1.0, but keep fixed parameters unchanged
      let variableDiseaseSum = 0;
      const variableDiseaseProbs: string[] = [];

      diseaseProbs.forEach(prob => {
        if (!fixedParameters?.has(prob)) {
          const value = constrainedParams[prob] || 0;
          variableDiseaseSum += value;
          if (value > 0) {
            variableDiseaseProbs.push(prob);
          }
        }
      });

      if (variableDiseaseSum > 0) {
        const fixedDiseaseSum = diseaseProbs.reduce((sum, prob) => {
          return sum + (fixedParameters?.has(prob) ? (constrainedParams[prob] || 0) : 0);
        }, 0);

        const targetSum = Math.max(0, 1.0 - fixedDiseaseSum);

        if (targetSum > 0) {
          // Scale variable probabilities to meet the target sum
          const scale = targetSum / variableDiseaseSum;
          variableDiseaseProbs.forEach(prob => {
            const currentValue = constrainedParams[prob] || 0;
            const newValue = Math.max(0, Math.min(1, currentValue * scale));
            constrainedParams[prob] = newValue;
          });
        }
      }
    }

    return constrainedParams;
  } catch (error) {
    console.error('Error in applyMarkovChainConstraints:', error);
    return sampledParams;
  }
}

/**
 * Normalize baseline inputs by converting string numbers to actual numbers
 */
function normalizeBaselineInputs(inputs: Record<string, number | string>): Record<string, number | string> {
  const normalized: Record<string, number | string> = {};
  Object.entries(inputs).forEach(([key, value]) => {
    if (typeof value === 'string' && !isNaN(Number(value))) {
      normalized[key] = Number(value);
    } else {
      normalized[key] = value;
    }
  });
  return normalized;
}

/**
 * Convert baseline inputs from display names to internal names
 * Handles cases where baseline inputs use display names as keys
 */
function convertBaselineInputsToInternalNames(inputs: Record<string, number | string>): Record<string, number | string> {
  const converted: Record<string, number | string> = {};

  Object.entries(inputs).forEach(([key, value]) => {
    // Try to find the internal name for this key
    const internalName = findDefaultsParameterName(key);

    if (internalName) {
      // Key is a display name, convert to internal name
      converted[internalName] = value;
    } else {
      // Key is already an internal name or unknown, keep as is
      converted[key] = value;
    }
  });

  return converted;
}

/**
 * Convert internal parameter names to display names for user-friendly output
 */
function getDisplayName(paramName: string): string {
  const displayName = findTemplateParameterName(paramName);
  if (!displayName) {
    console.warn(`WARNING: No display name found for internal parameter: ${paramName}`);
  }
  return displayName || paramName;
}

/**
 * Calculate model based on type
 */
function calculateModel(inputs: Record<string, number | string>, modelType: string): any {
  if (modelType === 'Decision Tree') {
    return calculateDecisionTreeModel(inputs as any);
  } else if (modelType === 'Markov Chain') {
    return calculateMarkovModel(inputs as any);
  } else if (modelType === 'Budget Impact Assessment') {
    // The BIA model expects camelCase keys, but the inputs may have "defaults library names".
    // We need to convert them before calling the calculation function.
    const camelCaseInputs: Record<string, number | string> = {};
    const keyMap: Record<string, string> = {
      // Standard/Short names
      'Target Market': 'targetMarket',
      'Target Population Size': 'targetPopulationSize',
      'Market Share Intervention Y1': 'marketShareInterventionY1',
      'Market Share Intervention Y2': 'marketShareInterventionY2',
      'Market Share Intervention Y3': 'marketShareInterventionY3',
      'Market Share Comparator Y1': 'marketShareComparatorY1',
      'Market Share Comparator Y2': 'marketShareComparatorY2',
      'Market Share Comparator Y3': 'marketShareComparatorY3',
      'Annual Cost Intervention Per Patient': 'annualCostInterventionPerPatient',
      'Annual Cost Comparator Per Patient': 'annualCostComparatorPerPatient',
      'Number of Years Assessment': 'numberOfYearsAssessment',

      // Verbose/AI-generated names
      'Target Market (e.g., Country Name)': 'targetMarket',
      'Target Population Size (Total Eligible)': 'targetPopulationSize',
      'Intervention Market Share Year 1 (%)': 'marketShareInterventionY1',
      'Intervention Market Share Year 2 (%)': 'marketShareInterventionY2',
      'Intervention Market Share Year 3 (%)': 'marketShareInterventionY3',
      'Comparator Market Share Year 1 (%)': 'marketShareComparatorY1',
      'Comparator Market Share Year 2 (%)': 'marketShareComparatorY2',
      'Comparator Market Share Year 3 (%)': 'marketShareComparatorY3',
      'Annual Cost of Intervention per Patient': 'annualCostInterventionPerPatient',
      'Annual Cost of Comparator per Patient': 'annualCostComparatorPerPatient',
      'Number of Years for BIA Assessment (1-5)': 'numberOfYearsAssessment',
    };

    for (const [key, value] of Object.entries(inputs)) {
      if (keyMap[key]) {
        camelCaseInputs[keyMap[key]] = value;
      } else {
        camelCaseInputs[key] = value; // Keep other params as is
      }
    }
    return calculateBudgetImpactModel(camelCaseInputs as any);
  }
  throw new Error(`Unknown model type: ${modelType}`);
}

/**
 * Extract cost-effectiveness metric from model results
 * Note: ICER requires comparison between two interventions, but our models are single-arm.
 * This function extracts the most appropriate cost-effectiveness metric available.
 */
function extractCostEffectivenessMetric(results: any, modelType?: string): number | null {
  if (results.error) {
    return null;
  }

  // For Decision Tree models, icer might be directly available (if it's a comparative model)
  if (typeof results.icer === 'number' && Number.isFinite(results.icer)) {
    return results.icer;
  }

  // For Markov Chain and other single-arm models, use cost per QALY as the metric
  if (results.totalDiscountedCost !== undefined && results.totalDiscountedQALYs !== undefined) {
    const cost = results.totalDiscountedCost;
    const qalys = results.totalDiscountedQALYs;

    if (qalys > 0) {
      return cost / qalys; // Cost per QALY
    } else if (qalys === 0) {
      // No QALYs gained, return the cost as the metric
      return cost;
    } else {
      // Negative QALYs (health loss), return cost per negative QALY
      return cost / qalys;
    }
  }

  // For Budget Impact models, use total net budget impact as the metric
  if (results.totalNetBudgetImpact !== undefined) {
    return results.totalNetBudgetImpact;
  }

  // Fallback: try to find any cost metric
  if (typeof results.totalCost === 'number') {
    return results.totalCost;
  }

  return null;
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;

  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * Calculate mean
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, val) => sum + (val - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Run Probabilistic Sensitivity Analysis
 */
export async function runProbabilisticSensitivityAnalysis(config: PSAConfiguration): Promise<PSAResult> {
  // Handle fixedParameters that might be serialized as array
  let fixedParameters: Set<string> | undefined;
  if (config.fixedParameters) {
    if (Array.isArray(config.fixedParameters)) {
      fixedParameters = new Set(config.fixedParameters);
    } else if (config.fixedParameters instanceof Set) {
      fixedParameters = config.fixedParameters;
    }
  }

  const startTime = Date.now();
  const seededRandom = new SeededRandom(config.seed);
  const rng: () => number = config.rng ?? (() => seededRandom.next());

  // Check if baselineInputs is empty or undefined, and provide emergency fallback values
  let baselineInputsToConvert = config.baselineInputs;

  if (!baselineInputsToConvert || Object.keys(baselineInputsToConvert).length === 0) {
    console.warn('Using emergency fallback values for model type:', config.modelType);
    baselineInputsToConvert = getEmergencyFallbackParameters(config.modelType);
  }

  // Normalize baseline inputs to ensure all numeric strings are converted to numbers
  // Keep template names (not converting to internal names) since parameter ranges use template names
  const normalizedBaselineInputs = normalizeBaselineInputs(baselineInputsToConvert);

  // Calculate baseline - convert template names to defaults names for model calculation

  // 🔧 FIX: Markov Chain models use template parameter names directly, not internal names
  let convertedBaselineInputsForModel: Record<string, any>;
  if (config.modelType === 'Markov Chain') {
    convertedBaselineInputsForModel = normalizedBaselineInputs;
  } else {
    convertedBaselineInputsForModel = convertBaselineInputsToInternalNames(normalizedBaselineInputs);
  }

  const baselineResult = calculateModel(convertedBaselineInputsForModel, config.modelType);

  // Check if baseline calculation failed
  if (baselineResult.error) {
    console.error('Baseline calculation error:', baselineResult.error);
    console.error('Baseline inputs:', config.baselineInputs);
    throw new Error(`Baseline model calculation failed: ${baselineResult.error}`);
  }

  const baselineCostEffectiveness = extractCostEffectivenessMetric(baselineResult, config.modelType);

  // Add the cost-effectiveness metric to the baseline result for UI consumption
  console.log('=== BASELINE RESULT DEBUGGING ===');
  console.log('Baseline result before enhancement:', baselineResult);
  console.log('Baseline result keys:', Object.keys(baselineResult));
  console.log('totalDiscountedCost:', baselineResult.totalDiscountedCost);
  console.log('totalDiscountedQALYs:', baselineResult.totalDiscountedQALYs);
  console.log('Extracted baseline cost-effectiveness:', baselineCostEffectiveness);
  console.log('Model type:', config.modelType);
  console.log('=== END BASELINE DEBUGGING ===');

  const enhancedBaselineResult = {
    ...baselineResult,
    icer: baselineCostEffectiveness, // Add ICER for tornado chart baseline display
    costEffectivenessMetric: baselineCostEffectiveness // Alternative field name
  };

  console.log('Enhanced baseline result:', enhancedBaselineResult);

  // Run Monte Carlo iterations
  const iterations: PSAIteration[] = [];
  const icers: number[] = [];
  const incrementalCosts: number[] = [];
  const incrementalUtilities: number[] = [];
  let errorCount = 0;

  for (let i = 0; i < config.numIterations; i++) {
    const sampledParams = sampleParameters(config.parameterRanges, fixedParameters, rng, config.parameterRangeOverrides, config.modelType, config.baselineInputs);
    const mergedParams = { ...normalizedBaselineInputs, ...sampledParams };

    // All params should already be numeric, but normalize just in case
    const numericParams = normalizeBaselineInputs(mergedParams);

    // Convert template names to defaults names for model calculation
    // 🔧 FIX: Markov Chain models use template parameter names directly, not internal names
    const convertedParams = config.modelType === 'Markov Chain'
      ? numericParams
      : convertBaselineInputsToInternalNames(numericParams);

    const results = calculateModel(convertedParams, config.modelType);

    // Track errors first
    if (results.error) {
      errorCount++;
      if (errorCount === 1) {
        console.warn('First model calculation error:', results.error);
        console.warn('Parameters:', numericParams);
      }
      // Skip this iteration - don't add failed iterations to the results
      continue;
    }

    // DEBUG: Log first few successful iterations
    if (i < 3) {
      console.log('Debug iteration', i, {
        sampledParams,
        convertedParams,
        results,
        costEffectivenessMetric: extractCostEffectivenessMetric(results, config.modelType)
      });
    }

    // Only add successful iterations
    iterations.push({
      iterationId: i,
      parameterValues: sampledParams,
      results,
    });

    // Extract metrics - only from successful calculations
    if (!results.error) {
      const costEffectivenessMetric = extractCostEffectivenessMetric(results, config.modelType);

      // DEBUG: Log metric extraction
      if (i < 3) {
        console.log('Metric extraction', i, {
          costEffectivenessMetric,
          isNull: costEffectivenessMetric === null,
          isFinite: Number.isFinite(costEffectivenessMetric),
          icersLength: icers.length
        });
      }

      if (costEffectivenessMetric !== null && Number.isFinite(costEffectivenessMetric)) {
        icers.push(costEffectivenessMetric);
      }

      // Extract incremental cost based on model type
      let incrementalCost: number | null = null;
      if (typeof results.incrementalCost === 'number') {
        // Decision Tree model
        incrementalCost = results.incrementalCost;
      } else if (typeof results.totalDiscountedCost === 'number') {
        // Markov Chain model
        incrementalCost = results.totalDiscountedCost;
      } else if (typeof results.totalNetBudgetImpact === 'number') {
        // Budget Impact model
        incrementalCost = results.totalNetBudgetImpact;
      }

      if (incrementalCost !== null && Number.isFinite(incrementalCost)) {
        incrementalCosts.push(incrementalCost);
      }

      // Extract incremental utility based on model type
      let incrementalUtility: number | null = null;
      if (typeof results.incrementalUtility === 'number') {
        // Decision Tree model
        incrementalUtility = results.incrementalUtility;
      } else if (typeof results.totalDiscountedQALYs === 'number') {
        // Markov Chain model
        incrementalUtility = results.totalDiscountedQALYs;
      }
      // Budget Impact model doesn't have utility/QALYs

      if (incrementalUtility !== null && Number.isFinite(incrementalUtility)) {
        incrementalUtilities.push(incrementalUtility);
      }
    }
  }

  // Log warning if many errors occurred
  if (errorCount > config.numIterations * 0.1) {
    console.warn(`PSA: ${errorCount}/${config.numIterations} iterations failed (${(errorCount / config.numIterations * 100).toFixed(1)}%)`);
  }

  // Sort for percentile calculations
  icers.sort((a, b) => a - b);
  incrementalCosts.sort((a, b) => a - b);
  incrementalUtilities.sort((a, b) => a - b);

  // Calculate statistics
  const statistics: PSAStatistics = {
    icer: {
      mean: mean(icers),
      median: percentile(icers, 50),
      stdDev: stdDev(icers),
      p5: percentile(icers, 5),
      p25: percentile(icers, 25),
      p75: percentile(icers, 75),
      p95: percentile(icers, 95),
    },
    incrementalCost: {
      mean: mean(incrementalCosts),
      median: percentile(incrementalCosts, 50),
      stdDev: stdDev(incrementalCosts),
      p5: percentile(incrementalCosts, 5),
      p95: percentile(incrementalCosts, 95),
    },
    incrementalUtility: {
      mean: mean(incrementalUtilities),
      median: percentile(incrementalUtilities, 50),
      stdDev: stdDev(incrementalUtilities),
      p5: percentile(incrementalUtilities, 5),
      p95: percentile(incrementalUtilities, 95),
    },
  };

  // DEBUG: Log final statistics
  const successfulIterations = icers.length;
  console.log('PSA final statistics:', {
    totalIterations: config.numIterations,
    errorCount,
    successfulIterations,
    successRate: `${((successfulIterations / config.numIterations) * 100).toFixed(1)}%`,
    icersSample: icers.slice(0, 5),
    icerStats: {
      mean: icers.length > 0 ? mean(icers) : 'N/A',
      median: icers.length > 0 ? percentile(icers, 50) : 'N/A',
      min: icers.length > 0 ? Math.min(...icers) : 'N/A',
      max: icers.length > 0 ? Math.max(...icers) : 'N/A'
    }
  });

  // Check if we have enough successful iterations
  if (successfulIterations === 0) {
    throw new Error(`All PSA iterations failed. First error: ${iterations[0]?.results?.error || 'Unknown error'}`);
  }

  if (successfulIterations < config.numIterations * 0.5) {
    console.warn(`Warning: Only ${successfulIterations} out of ${config.numIterations} PSA iterations succeeded (${((successfulIterations / config.numIterations) * 100).toFixed(1)}%)`);
  }

  // Generate CEAC curve
  const ceacCurve = generateCEACCurve(iterations, config.modelType);

  // Generate tornado diagram
  // Create a copy of config with converted fixedParameters for tornado diagram generation
  const configForTornado = {
    ...config,
    fixedParameters: fixedParameters,
    baselineInputs: normalizedBaselineInputs // Include the baseline inputs (fallback or original) for tornado analysis
  };
  const tornadoDiagram = await generateTornadoDiagram(configForTornado, config.modelType, baselineCostEffectiveness || 0, config.parameterRangeOverrides);

  const executionTimeMs = Date.now() - startTime;

  return {
    baselineResult: enhancedBaselineResult,
    iterations,
    statistics,
    ceacCurve,
    tornadoDiagram,
    metadata: {
      numIterations: config.numIterations,
      modelType: config.modelType,
      generatedAt: Date.now(),
      executionTimeMs,
      fixedParameters: fixedParameters ? Array.from(fixedParameters) : undefined,
    },
  };
}

/**
 * Generate Cost-Effectiveness Acceptability Curve (CEAC)
 */
function generateCEACCurve(iterations: PSAIteration[], modelType: string): CEACPoint[] {
  const thresholds = [0, 10000, 20000, 30000, 50000, 75000, 100000, 150000, 200000];
  const ceacPoints: CEACPoint[] = [];

  thresholds.forEach(threshold => {
    let costEffectiveCount = 0;
    let successfulIterations = 0;

    iterations.forEach(iteration => {
      const results = iteration.results;
      if (results.error) return;

      successfulIterations++;

      // Extract cost and utility based on model type
      let incrementalCost = 0;
      let incrementalUtility = 0;

      if (modelType === 'Decision Tree') {
        incrementalCost = results.incrementalCost || 0;
        incrementalUtility = results.incrementalUtility || 0;
      } else if (modelType === 'Markov Chain') {
        incrementalCost = results.totalDiscountedCost || 0;
        incrementalUtility = results.totalDiscountedQALYs || 0;
      } else if (modelType === 'Budget Impact Assessment') {
        incrementalCost = results.totalNetBudgetImpact || 0;
        incrementalUtility = 0; // BIA doesn't have utility/QALYs
      }

      // Intervention is cost-effective if ICER < threshold
      if (incrementalUtility > 0) {
        // Positive utility: standard ICER comparison
        const icer = incrementalCost / incrementalUtility;
        if (icer < threshold) {
          costEffectiveCount++;
        }
      } else if (incrementalUtility < 0) {
        // Negative utility: intervention reduces health
        // Only cost-effective if it's cheaper AND the absolute ICER is below threshold
        // (i.e., the cost savings justify the health loss)
        if (incrementalCost < 0) {
          // Cheaper but less effective (south-west quadrant)
          // Check if absolute ICER justifies the health loss
          const absoluteICER = Math.abs(incrementalCost) / Math.abs(incrementalUtility);
          if (absoluteICER < threshold) {
            costEffectiveCount++;
          }
        } else if (incrementalCost > 0) {
          // Costs more and reduces utility: never cost-effective
          // (dominated by comparator)
        }
        // If incrementalCost == 0, intervention is neutral cost but reduces utility: not cost-effective
      } else {
        // incrementalUtility == 0: no health difference
        if (incrementalCost < 0) {
          // Cheaper with no health difference: cost-effective
          costEffectiveCount++;
        }
        // If incrementalCost >= 0: same or higher cost with no health benefit: not cost-effective
      }
    });

    // Only calculate probability if we have successful iterations
    const probability = successfulIterations > 0 ? costEffectiveCount / successfulIterations : 0;
    ceacPoints.push({ threshold, probability });
  });

  return ceacPoints;
}

/**
 * Generate Tornado Diagram (one-way sensitivity analysis)
 */
async function generateTornadoDiagram(
  config: PSAConfiguration,
  modelType: string,
  baselineCostEffectiveness: number,
  rangeOverrides?: Record<string, { min: number; max: number }>
): Promise<TornadoParameter[]> {
  const results: TornadoParameter[] = [];
  const fixedParameters = config.fixedParameters instanceof Set ? config.fixedParameters : undefined;
  console.log('=== STARTING TORNADO DIAGRAM GENERATION ===');
  console.log('Tornado analysis inputs:', {
    modelType,
    baselineCostEffectiveness,
    parameterRangesCount: Object.keys(config.parameterRanges).length,
    fixedParametersCount: fixedParameters?.size || 0,
    parameterRanges: Object.keys(config.parameterRanges)
  });

  // 🔧 FIX: Markov Chain models use template parameter names directly, not internal names
  let normalizedBaselineInputs: Record<string, number | string>;
  if (modelType === 'Markov Chain') {
    normalizedBaselineInputs = normalizeBaselineInputs(config.baselineInputs);
  } else {
    const convertedBaselineInputs = convertBaselineInputsToInternalNames(config.baselineInputs);
    normalizedBaselineInputs = normalizeBaselineInputs(convertedBaselineInputs);
  }

  for (const [paramName, range] of Object.entries(config.parameterRanges)) {
    if (fixedParameters?.has(paramName)) continue;

    // Apply custom range overrides if provided
    const effectiveRange = rangeOverrides?.[paramName] ? {
      ...range,
      min: rangeOverrides[paramName].min,
      max: rangeOverrides[paramName].max,
    } : range;

    // 🔧 FIX: Markov Chain models use template parameter names directly
    let convertedLowParams: Record<string, number | string>;
    if (modelType === 'Markov Chain') {
      // For Markov Chain, just normalize without converting to internal names

      const lowParamsRaw = { ...normalizedBaselineInputs, [paramName]: effectiveRange.min };

      // 🔧 FIX: For Markov Chain, skip normalization to avoid filtering cost/utility parameters
      const lowParams = lowParamsRaw;
      convertedLowParams = lowParams;
    } else {
      // For other models, convert to internal names
      const lowParams = normalizeBaselineInputs({ ...normalizedBaselineInputs, [paramName]: effectiveRange.min });
      convertedLowParams = convertBaselineInputsToInternalNames(lowParams);
    }
    const lowResult = calculateModel(convertedLowParams, modelType);
    const icer_low = extractCostEffectivenessMetric(lowResult, modelType) ?? baselineCostEffectiveness;

    // 🔧 FIX: Markov Chain models use template parameter names directly
    let convertedHighParams: Record<string, number | string>;
    if (modelType === 'Markov Chain') {
      // For Markov Chain, skip normalization to avoid filtering cost/utility parameters
      const highParamsRaw = { ...normalizedBaselineInputs, [paramName]: effectiveRange.max };
      convertedHighParams = highParamsRaw;
    } else {
      // For other models, convert to internal names
      const highParams = normalizeBaselineInputs({ ...normalizedBaselineInputs, [paramName]: effectiveRange.max });
      convertedHighParams = convertBaselineInputsToInternalNames(highParams);
    }
    const highResult = calculateModel(convertedHighParams, modelType);
    const icer_high = extractCostEffectivenessMetric(highResult, modelType) ?? baselineCostEffectiveness;

    const impact = Math.abs(icer_high - icer_low);
    const percentageImpact = baselineCostEffectiveness > 0 ? (impact / baselineCostEffectiveness) * 100 : 0;

    // Get display name for the parameter
    // First check if paramName is already a template name (exists in baseline inputs)
    let displayName = paramName;
    if (!config.baselineInputs[paramName]) {
      // If not found in baseline inputs, try to convert from defaults name to template name
      displayName = getDisplayName(paramName);
    }

    // Get baseline value
    let baselineValue: number | undefined = undefined;

    // Try direct lookup with the display name (use original baselineInputs, not converted)
    if (typeof config.baselineInputs[displayName] === 'number') {
      baselineValue = config.baselineInputs[displayName] as number;
    } else if (typeof config.baselineInputs[paramName] === 'number') {
      // Try direct lookup with the internal name (in case baseline uses internal names)
      baselineValue = config.baselineInputs[paramName] as number;
    } else {
      // Try fuzzy matching if neither direct lookup works
      const matchingKey = Object.keys(config.baselineInputs).find(key =>
        key.toLowerCase().replace(/\s+/g, '') === displayName.toLowerCase().replace(/\s+/g, '') ||
        key.toLowerCase().replace(/\s+/g, '') === paramName.toLowerCase().replace(/\s+/g, '')
      );
      if (matchingKey && typeof config.baselineInputs[matchingKey] === 'number') {
        baselineValue = config.baselineInputs[matchingKey] as number;
      }
    }

    results.push({
      parameterName: displayName,
      baselineValue: baselineValue ?? 0,
      lowValue: effectiveRange.min,
      highValue: effectiveRange.max,
      value_low: Math.min(icer_low, icer_high),
      value_high: Math.max(icer_low, icer_high),
      icer_low,
      icer_high,
      impact,
      percentageImpact,
    });
  }

  // Sort by impact (descending)
  return results.sort((a, b) => b.impact - a.impact);
}

/**
 * Generate summary statistics for PSA results
 */
export function generatePSASummary(psaResult: PSAResult): string {
  const lines: string[] = [];

  lines.push('=== PROBABILISTIC SENSITIVITY ANALYSIS SUMMARY ===\n');

  lines.push(`Iterations: ${psaResult.metadata.numIterations}`);
  lines.push(`Model Type: ${psaResult.metadata.modelType}`);
  lines.push(`Execution Time: ${psaResult.metadata.executionTimeMs}ms\n`);

  lines.push('ICER STATISTICS:');
  lines.push(`  Mean: $${psaResult.statistics.icer.mean.toFixed(2)}`);
  lines.push(`  Median: $${psaResult.statistics.icer.median.toFixed(2)}`);
  lines.push(`  Std Dev: $${psaResult.statistics.icer.stdDev.toFixed(2)}`);
  lines.push(`  95% CI: $${psaResult.statistics.icer.p5.toFixed(2)} - $${psaResult.statistics.icer.p95.toFixed(2)}\n`);

  lines.push('INCREMENTAL COST STATISTICS:');
  lines.push(`  Mean: $${psaResult.statistics.incrementalCost.mean.toFixed(2)}`);
  lines.push(`  95% CI: $${psaResult.statistics.incrementalCost.p5.toFixed(2)} - $${psaResult.statistics.incrementalCost.p95.toFixed(2)}\n`);

  lines.push('INCREMENTAL UTILITY STATISTICS:');
  lines.push(`  Mean: ${psaResult.statistics.incrementalUtility.mean.toFixed(4)}`);
  lines.push(`  95% CI: ${psaResult.statistics.incrementalUtility.p5.toFixed(4)} - ${psaResult.statistics.incrementalUtility.p95.toFixed(4)}\n`);

  lines.push('TOP 5 SENSITIVE PARAMETERS (Tornado):');
  psaResult.tornadoDiagram.slice(0, 5).forEach((param, index) => {
    lines.push(`  ${index + 1}. ${param.parameterName}: ${param.percentageImpact.toFixed(1)}% impact`);
  });

  return lines.join('\n');
}

/**
 * Get emergency fallback parameters when no baseline inputs are available
 */
function getEmergencyFallbackParameters(modelType: string): Record<string, number | string> {
  if (modelType === 'Decision Tree') {
    return {
      'Cost of Intervention Test': 100,
      'Sensitivity of Intervention Test': 0.85,
      'Specificity of Intervention Test': 0.90,
      'Cost of Comparator Test': 50,
      'Sensitivity of Comparator Test': 0.80,
      'Specificity of Comparator Test': 0.85,
      'Prevalence of Disease/Condition': 0.1,
      'Cost of Treatment (Correct Positive)': 500,
      'Utility of Treatment (Correct Positive)': 0.8,
      'Cost of False Positive Management': 200,
      'Utility of False Positive State': 0.7,
      'Cost of False Negative Consequence': 1000,
      'Utility of False Negative State': 0.6,
      'Cost of Correct Negative Management': 50,
      'Utility of Correct Negative State': 0.9
    };
  } else if (modelType === 'Markov Chain') {
    return {
      'Prob Healthy to Healthy': 0.9,
      'Prob Healthy to Disease': 0.1,
      'Prob Healthy to Dead': 0.0,
      'Prob Disease to Healthy': 0.2,
      'Prob Disease to Disease': 0.7,
      'Prob Disease to Dead': 0.1,
      'Cost Healthy State': 100,
      'Cost Disease State': 500,
      'Cost Dead State': 0,
      'Utility Healthy State': 0.9,
      'Utility Disease State': 0.7,
      'Utility Dead State': 0.0,
      'Number of Cycles': 10,
      'Annual Discount Rate': 0.03
    };
  } else if (modelType === 'Budget Impact Assessment') {
    return {
      'Target Market': 'Switzerland',
      'Target Population Size': 1000000,
      'Market Share Intervention Y1': 0.05,
      'Market Share Comparator Y1': 0.95,
      'Cost Intervention Y1': 10000,
      'Cost Comparator Y1': 5000,
      'Cost Intervention Y2': 12000,
      'Cost Comparator Y2': 6000,
      'Cost Intervention Y3': 15000,
      'Cost Comparator Y3': 8000
    };
  } else {
    // Generic fallback
    return {
      'Cost': 100,
      'Utility': 0.8,
      'Probability': 0.5,
      'Number of Cycles': 10
    };
  }
}

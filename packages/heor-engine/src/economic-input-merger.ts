// Ported from HEOR Copilot src/lib/economic-input-merger.ts (characterization port — unchanged).
/**
 * Economic Input Merger
 * Intelligently combines AI-suggested inputs with device class defaults
 * Priority: AI suggestions > Expert inputs > Device class defaults
 */

import type { DefaultModelInputSet, ParameterDistribution } from './economic-model-defaults';
import { getDefaultsForDeviceClass, type DeviceClass } from './economic-model-defaults';

export interface InputMergeStrategy {
  aiSuggestedInputs?: Record<string, number | string>;
  expertProvidedInputs?: Record<string, number | string>;
  deviceClassDefaults?: DefaultModelInputSet;
  fixedParameters?: Set<string>; // Parameters that should not be overridden
}

export interface MergedInputResult {
  mergedInputs: Record<string, number | string>;
  parameterRanges: Record<string, ParameterDistribution>;
  sources: Record<string, string>; // Track where each parameter came from
  assumptions: string[];
  mergeLog: Array<{
    parameter: string;
    source: 'ai-suggested' | 'expert-provided' | 'device-class-default';
    value: number | string;
    reason?: string;
  }>;
}

/**
 * Merge inputs from multiple sources with intelligent prioritization
 * Priority order: AI suggestions > Expert inputs > Device class defaults
 */
export function mergeEconomicInputs(strategy: InputMergeStrategy): MergedInputResult {
  const mergeLog: MergedInputResult['mergeLog'] = [];
  const mergedInputs: Record<string, number | string> = {};
  const sources: Record<string, string> = {};
  const parameterRanges: Record<string, ParameterDistribution> = {};
  let assumptions: string[] = [];

  // Start with device class defaults as baseline
  if (strategy.deviceClassDefaults) {
    Object.entries(strategy.deviceClassDefaults.baselineInputs).forEach(([param, value]) => {
      if (!strategy.fixedParameters?.has(param)) {
        mergedInputs[param] = value;
        sources[param] = strategy.deviceClassDefaults!.sources[param] || 'Device class default';
        mergeLog.push({
          parameter: param,
          source: 'device-class-default',
          value,
          reason: 'Using device class baseline',
        });
      }
    });

    // Copy parameter ranges from defaults
    Object.entries(strategy.deviceClassDefaults.parameterRanges).forEach(([param, range]) => {
      parameterRanges[param] = range;
    });

    assumptions = [...strategy.deviceClassDefaults.assumptions];
  }

  // Override with expert-provided inputs
  if (strategy.expertProvidedInputs) {
    Object.entries(strategy.expertProvidedInputs).forEach(([param, value]) => {
      if (!strategy.fixedParameters?.has(param) && value !== null && value !== undefined && value !== '') {
        const oldValue = mergedInputs[param];
        mergedInputs[param] = value;
        sources[param] = 'Expert-provided input';
        mergeLog.push({
          parameter: param,
          source: 'expert-provided',
          value,
          reason: `Overriding ${oldValue !== undefined ? `default value (${oldValue})` : 'missing value'}`,
        });
      }
    });
  }

  // Override with AI-suggested inputs (highest priority)
  if (strategy.aiSuggestedInputs) {
    Object.entries(strategy.aiSuggestedInputs).forEach(([param, value]) => {
      if (!strategy.fixedParameters?.has(param) && value !== null && value !== undefined && value !== '') {
        const oldValue = mergedInputs[param];
        mergedInputs[param] = value;
        sources[param] = 'AI-suggested (from literature/IFU)';
        mergeLog.push({
          parameter: param,
          source: 'ai-suggested',
          value,
          reason: `Overriding ${oldValue !== undefined ? `previous value (${oldValue})` : 'missing value'} with AI suggestion`,
        });
      }
    });
  }

  // Add merge metadata to assumptions
  const mergeMetadata = [
    `Input merge strategy applied: AI suggestions > Expert inputs > Device class defaults`,
    `Device class: ${strategy.deviceClassDefaults?.deviceClass || 'custom'}`,
    `Total parameters merged: ${Object.keys(mergedInputs).length}`,
    `Parameters from AI suggestions: ${mergeLog.filter(l => l.source === 'ai-suggested').length}`,
    `Parameters from expert inputs: ${mergeLog.filter(l => l.source === 'expert-provided').length}`,
    `Parameters from device class defaults: ${mergeLog.filter(l => l.source === 'device-class-default').length}`,
  ];

  return {
    mergedInputs,
    parameterRanges,
    sources,
    assumptions: [...assumptions, ...mergeMetadata],
    mergeLog,
  };
}

/**
 * Validate merged inputs for completeness and consistency
 */
export interface ValidationResult {
  isValid: boolean;
  missingParameters: string[];
  invalidParameters: Array<{ parameter: string; value: any; reason: string }>;
  warnings: string[];
}

export function validateMergedInputs(
  mergedInputs: Record<string, number | string>,
  expectedParameters: string[],
  parameterTypes?: Record<string, 'number' | 'string'>
): ValidationResult {
  const missingParameters: string[] = [];
  const invalidParameters: Array<{ parameter: string; value: any; reason: string }> = [];
  const warnings: string[] = [];

  // Check for missing parameters
  expectedParameters.forEach(param => {
    if (!(param in mergedInputs) || mergedInputs[param] === null || mergedInputs[param] === undefined || mergedInputs[param] === '') {
      missingParameters.push(param);
    }
  });

  // Check for invalid parameter types and values
  Object.entries(mergedInputs).forEach(([param, value]) => {
    if (parameterTypes && parameterTypes[param]) {
      const expectedType = parameterTypes[param];
      if (expectedType === 'number' && typeof value !== 'number') {
        invalidParameters.push({
          parameter: param,
          value,
          reason: `Expected number, got ${typeof value}`,
        });
      } else if (expectedType === 'number' && typeof value === 'number') {
        // Additional numeric validation
        if (Number.isNaN(value)) {
          invalidParameters.push({
            parameter: param,
            value,
            reason: 'Value is NaN',
          });
        } else if (!Number.isFinite(value)) {
          invalidParameters.push({
            parameter: param,
            value,
            reason: 'Value is not finite',
          });
        }
      }
    }
  });

  // Check for suspicious values (e.g., probabilities outside 0-1)
  Object.entries(mergedInputs).forEach(([param, value]) => {
    if (typeof value === 'number') {
      if (param.toLowerCase().includes('probability') || param.toLowerCase().includes('sensitivity') || param.toLowerCase().includes('specificity') || param.toLowerCase().includes('utility')) {
        if (value < 0 || value > 1) {
          warnings.push(`Parameter "${param}" appears to be a probability but has value ${value} (outside 0-1 range)`);
        }
      }
    }
  });

  return {
    isValid: missingParameters.length === 0 && invalidParameters.length === 0,
    missingParameters,
    invalidParameters,
    warnings,
  };
}

/**
 * Generate a human-readable merge report
 */
export function generateMergeReport(mergeResult: MergedInputResult): string {
  const lines: string[] = [];

  lines.push('=== ECONOMIC INPUT MERGE REPORT ===\n');

  lines.push('MERGE STRATEGY APPLIED:');
  lines.push('Priority: AI Suggestions > Expert Inputs > Device Class Defaults\n');

  lines.push('MERGE LOG:');
  const aiCount = mergeResult.mergeLog.filter(l => l.source === 'ai-suggested').length;
  const expertCount = mergeResult.mergeLog.filter(l => l.source === 'expert-provided').length;
  const defaultCount = mergeResult.mergeLog.filter(l => l.source === 'device-class-default').length;

  lines.push(`  • AI-suggested inputs: ${aiCount} parameters`);
  lines.push(`  • Expert-provided inputs: ${expertCount} parameters`);
  lines.push(`  • Device class defaults: ${defaultCount} parameters`);
  lines.push(`  • Total parameters: ${mergeResult.mergeLog.length}\n`);

  lines.push('PARAMETER SOURCES:');
  mergeResult.mergeLog.forEach(entry => {
    const sourceLabel = {
      'ai-suggested': '[AI]',
      'expert-provided': '[EXPERT]',
      'device-class-default': '[DEFAULT]',
    }[entry.source];
    lines.push(`  ${sourceLabel} ${entry.parameter}: ${entry.value}${entry.reason ? ` (${entry.reason})` : ''}`);
  });

  lines.push('\nASSUMPTIONS:');
  mergeResult.assumptions.forEach(assumption => {
    lines.push(`  • ${assumption}`);
  });

  return lines.join('\n');
}

/**
 * Create a merge strategy from a device class
 */
export function createMergeStrategyFromDeviceClass(
  deviceClass: DeviceClass,
  aiSuggestedInputs?: Record<string, number | string>,
  expertProvidedInputs?: Record<string, number | string>,
  fixedParameters?: Set<string>
): InputMergeStrategy {
  const defaults = getDefaultsForDeviceClass(deviceClass);
  const deviceClassDefault = defaults.length > 0 ? defaults[0] : undefined;

  return {
    aiSuggestedInputs,
    expertProvidedInputs,
    deviceClassDefaults: deviceClassDefault,
    fixedParameters,
  };
}

/**
 * Compare two input sets and highlight differences
 */
export interface InputComparison {
  parameter: string;
  original: number | string | undefined;
  merged: number | string | undefined;
  changed: boolean;
  changeType?: 'added' | 'modified' | 'removed';
}

export function compareInputs(
  original: Record<string, number | string>,
  merged: Record<string, number | string>
): InputComparison[] {
  const allParams = new Set([...Object.keys(original), ...Object.keys(merged)]);
  const comparisons: InputComparison[] = [];

  allParams.forEach(param => {
    const originalValue = original[param];
    const mergedValue = merged[param];
    const changed = originalValue !== mergedValue;

    let changeType: 'added' | 'modified' | 'removed' | undefined;
    if (originalValue === undefined && mergedValue !== undefined) {
      changeType = 'added';
    } else if (originalValue !== undefined && mergedValue === undefined) {
      changeType = 'removed';
    } else if (changed) {
      changeType = 'modified';
    }

    comparisons.push({
      parameter: param,
      original: originalValue,
      merged: mergedValue,
      changed,
      changeType,
    });
  });

  return comparisons.filter(c => c.changed);
}

/**
 * compare-runs — structured comparison of multiple model run records.
 *
 * Usage: npx tsx src/cli/compare-runs.ts <run1.json> <run2.json> [run3.json ...] [--baseline <file>]
 *
 * Reads two or more JSON run records (the output of run-model.ts or
 * run-scenarios.ts) and produces a structured comparison:
 *   - Parameter differences (which inputs changed between runs)
 *   - Result variations (how outputs changed, with percentage deltas)
 *   - Impact assessment (low/medium/high for each varying parameter)
 *   - Recommendations (sensitivity analysis suggestions)
 *
 * Ported from the HEOR Copilot app's EconomicModelingComparisonService
 * (src/services/economic-modeling-comparison.ts), adapted for the
 * file-based run-record format used by this engine's CLI.
 */
import { readFileSync } from 'node:fs';
import { fail, printJson } from './shared';

const usage = `Usage: npx tsx src/cli/compare-runs.ts <run1.json> <run2.json> [run3.json ...] [--baseline <file>]
Each input file is a JSON run record from run-model.ts (kind: "model-run").
--baseline <file>  Specify which run is the baseline (default: first file).
Output: a comparison JSON object on stdout.`;

interface RunRecord {
  engine?: string;
  kind?: string;
  model?: string;
  modelType?: string;
  generatedAt?: string;
  inputs?: Record<string, unknown>;
  results?: Record<string, unknown>;
}

interface ParameterDifference {
  parameter: string;
  baselineValue: unknown;
  alternativeValues: Record<string, unknown>;
  impact: 'low' | 'medium' | 'high';
}

interface ResultVariation {
  metric: string;
  baselineResult: number;
  alternativeResults: Record<string, number>;
  percentageChange: Record<string, number>;
}

interface ComparisonSummary {
  baselineRun: string;
  comparisonRuns: string[];
  modelType: string;
  keyDifferences: ParameterDifference[];
  resultVariations: ResultVariation[];
  recommendations: string[];
}

const HIGH_IMPACT_KEYWORDS = [
  'cost', 'utility', 'icer', 'discount', 'effectiveness',
  'probability', 'rate', 'prevalence', 'sensitivity', 'specificity',
];

function assessParameterImpact(
  paramName: string,
  baselineValue: unknown,
  alternativeValues: Record<string, unknown>,
): 'low' | 'medium' | 'high' {
  const paramLower = paramName.toLowerCase();
  if (HIGH_IMPACT_KEYWORDS.some(kw => paramLower.includes(kw))) {
    return 'high';
  }
  if (typeof baselineValue === 'number') {
    const variations = Object.values(alternativeValues)
      .filter((v): v is number => typeof v === 'number')
      .map(v => baselineValue !== 0 ? Math.abs((v - baselineValue) / baselineValue) : 0);
    const maxVariation = variations.length > 0 ? Math.max(...variations) : 0;
    if (maxVariation > 0.5) return 'high';
    if (maxVariation > 0.2) return 'medium';
    return 'low';
  }
  const hasVariation = Object.values(alternativeValues).some(v => v !== baselineValue);
  return hasVariation ? 'medium' : 'low';
}

function extractKeyResults(results: Record<string, unknown>): Record<string, number> {
  const keyResults: Record<string, number> = {};
  for (const [key, value] of Object.entries(results)) {
    if (typeof value === 'number') {
      keyResults[key] = value;
    } else if (value !== null && typeof value === 'object') {
      for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof subValue === 'number') {
          keyResults[`${key}.${subKey}`] = subValue;
        }
      }
    }
  }
  return keyResults;
}

function loadRun(path: string, label: string): RunRecord {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read ${label} file "${path}".\n${usage}`);
  }
  try {
    return JSON.parse(raw) as RunRecord;
  } catch (e) {
    fail(`${label} file "${path}" is not valid JSON: ${(e as Error).message}`);
  }
}

// --- CLI --------------------------------------------------------------------

const args = process.argv.slice(2);
const files: string[] = [];
let baselineFile: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--baseline') {
    baselineFile = args[i + 1];
    i++;
  } else {
    files.push(args[i]);
  }
}

if (files.length < 2) {
  fail('At least 2 run files are required for comparison.\n' + usage);
}

const runs = files.map((f, i) => {
  const run = loadRun(f, `run ${i + 1}`);
  return { file: f, label: f.split('/').pop() ?? f, run };
});

const baselineIdx = baselineFile
  ? runs.findIndex(r => r.file === baselineFile || r.label === baselineFile)
  : 0;

if (baselineIdx < 0) {
  fail(`Baseline file "${baselineFile}" not found among input files.`);
}

const baseline = runs[baselineIdx];
const comparisons = runs.filter((_, i) => i !== baselineIdx);

const baselineInputs = baseline.run.inputs ?? {};
const baselineResults = extractKeyResults(baseline.run.results ?? {});

const keyDifferences: ParameterDifference[] = [];
const resultVariations: ResultVariation[] = [];

// Compare parameters
for (const paramName of Object.keys(baselineInputs)) {
  const baselineValue = baselineInputs[paramName];
  const alternativeValues: Record<string, unknown> = {};
  let hasVariation = false;

  for (const comp of comparisons) {
    const altValue = comp.run.inputs?.[paramName];
    alternativeValues[comp.label] = altValue;
    if (altValue !== baselineValue) {
      hasVariation = true;
    }
  }

  if (hasVariation) {
    keyDifferences.push({
      parameter: paramName,
      baselineValue,
      alternativeValues,
      impact: assessParameterImpact(paramName, baselineValue, alternativeValues),
    });
  }
}

// Compare results
for (const [metric, baselineResult] of Object.entries(baselineResults)) {
  const alternativeResults: Record<string, number> = {};
  const percentageChange: Record<string, number> = {};

  for (const comp of comparisons) {
    const compResults = extractKeyResults(comp.run.results ?? {});
    const altResult = compResults[metric];
    if (typeof altResult === 'number') {
      alternativeResults[comp.label] = altResult;
      percentageChange[comp.label] = baselineResult !== 0
        ? ((altResult - baselineResult) / baselineResult) * 100
        : 0;
    }
  }

  if (Object.keys(alternativeResults).length > 0) {
    resultVariations.push({ metric, baselineResult, alternativeResults, percentageChange });
  }
}

// Generate recommendations
const recommendations: string[] = [];

const highImpact = keyDifferences.filter(d => d.impact === 'high');
if (highImpact.length > 0) {
  recommendations.push(
    `High-impact parameter variations detected in: ${highImpact.map(d => d.parameter).join(', ')}. Consider sensitivity analysis.`,
  );
}

const significantVariations = resultVariations.filter(v =>
  Object.values(v.percentageChange).some(change => Math.abs(change) > 20),
);
if (significantVariations.length > 0) {
  recommendations.push(
    `Significant result variations (>20%) observed in: ${significantVariations.map(v => v.metric).join(', ')}.`,
  );
}

const icerVariation = resultVariations.find(v => v.metric.toLowerCase().includes('icer'));
if (icerVariation) {
  const maxIcerChange = Math.max(...Object.values(icerVariation.percentageChange).map(Math.abs));
  if (maxIcerChange > 50) {
    recommendations.push(
      'ICER shows high sensitivity to parameter changes. Consider probabilistic sensitivity analysis.',
    );
  }
}

if (recommendations.length === 0) {
  recommendations.push('Model results show reasonable stability across scenarios. Consider documenting key assumptions.');
}

const summary: ComparisonSummary = {
  baselineRun: baseline.label,
  comparisonRuns: comparisons.map(c => c.label),
  modelType: baseline.run.modelType ?? baseline.run.model ?? 'unknown',
  keyDifferences,
  resultVariations,
  recommendations,
};

printJson({
  engine: '@heor/engine',
  kind: 'run-comparison',
  generatedAt: new Date().toISOString(),
  comparison: summary,
});

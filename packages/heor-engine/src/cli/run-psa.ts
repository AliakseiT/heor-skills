/**
 * run-psa — probabilistic sensitivity analysis (Monte Carlo).
 *
 * Usage: npx tsx src/cli/run-psa.ts <inputs.json>
 *
 * Input file format (matches a dossier's models/inputs/<model>.json):
 *   {
 *     "model": "markov-chain",              // decision-tree | markov-chain | budget-impact
 *     "inputs": { ...baseline parameters... },
 *     "psa": {
 *       "parameterRanges": { "<param>": { "min": 80, "max": 120, "distribution": "uniform" } },
 *       "numIterations": 1000,               // optional, default 1000
 *       "seed": 42,                          // optional, for reproducible runs
 *       "fixedParameters": ["<param>"],      // optional
 *       "parameterRangeOverrides": { "<param>": { "min": 1, "max": 2 } }  // optional
 *     }
 *   }
 *
 * Prints the full PSA result (baseline, iterations, statistics, CEAC curve,
 * tornado diagram) as JSON to stdout. Engine debug logging goes to stderr.
 */
import { runProbabilisticSensitivityAnalysis, type PSAConfiguration } from '../probabilistic-sensitivity-analysis';
import { fail, printJson, readJsonInput, redirectDebugLogsToStderr, resolveModel } from './shared';

const usage = `Usage: npx tsx src/cli/run-psa.ts <inputs.json>
The input file must contain: { "model": "<name>", "inputs": { ... }, "psa": { "parameterRanges": { ... } } }
PSA supports: decision-tree, markov-chain, budget-impact.
See packages/heor-engine/README.md for the full format.`;

const data = readJsonInput(process.argv[2], usage);

if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  fail(`Input must be a JSON object.\n${usage}`);
}

const entry = resolveModel(data.model ?? data.modelType);
if (!entry.psaSupported) {
  fail(`PSA is not supported for model "${entry.slug}". Supported models: decision-tree, markov-chain, budget-impact.`);
}

if (typeof data.inputs !== 'object' || data.inputs === null || Array.isArray(data.inputs)) {
  fail(`Missing or invalid "inputs" object (baseline parameters).\n${usage}`);
}

const psa = data.psa ?? {};
if (typeof psa !== 'object' || psa === null || Array.isArray(psa)) {
  fail(`"psa" must be an object.\n${usage}`);
}
if (typeof psa.parameterRanges !== 'object' || psa.parameterRanges === null || Object.keys(psa.parameterRanges).length === 0) {
  fail(`"psa.parameterRanges" must be a non-empty object mapping parameter names to { min, max, distribution }.\n${usage}`);
}
if (psa.numIterations !== undefined && (typeof psa.numIterations !== 'number' || psa.numIterations <= 0)) {
  fail('"psa.numIterations" must be a positive number.');
}
if (psa.fixedParameters !== undefined && !Array.isArray(psa.fixedParameters)) {
  fail('"psa.fixedParameters" must be an array of parameter names.');
}

const config: PSAConfiguration = {
  modelType: entry.displayName as PSAConfiguration['modelType'],
  baselineInputs: data.inputs,
  parameterRanges: psa.parameterRanges,
  numIterations: psa.numIterations ?? 1000,
  seed: psa.seed,
  fixedParameters: psa.fixedParameters,
  parameterRangeOverrides: psa.parameterRangeOverrides,
};

redirectDebugLogsToStderr();

try {
  const result = await runProbabilisticSensitivityAnalysis(config);
  printJson({
    engine: '@heor/engine',
    kind: 'psa-run',
    model: entry.slug,
    modelType: entry.displayName,
    generatedAt: new Date().toISOString(),
    inputs: data.inputs,
    psaConfig: {
      numIterations: config.numIterations,
      seed: config.seed,
      fixedParameters: config.fixedParameters,
      parameterRanges: config.parameterRanges,
      parameterRangeOverrides: config.parameterRangeOverrides,
    },
    result,
  });
} catch (e) {
  fail(`PSA failed: ${(e as Error).message}`);
}

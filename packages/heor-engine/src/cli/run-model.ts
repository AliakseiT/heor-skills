/**
 * run-model — deterministic single-model run.
 *
 * Usage: npx tsx src/cli/run-model.ts <inputs.json>
 *
 * Input file format (matches a dossier's models/inputs/<model>.json):
 *   { "model": "<model slug or display name>", "inputs": { ...model parameters... } }
 *
 * Prints a JSON run record to stdout. Exits non-zero on invalid input or if
 * the model reports an error.
 */
import { fail, modelSlugs, printJson, readJsonInput, resolveModel } from './shared';

const usage = `Usage: npx tsx src/cli/run-model.ts <inputs.json>
The input file must contain: { "model": "<name>", "inputs": { ... } }
Supported models: ${modelSlugs()}.
See packages/heor-engine/README.md for the parameter format of each model.`;

const data = readJsonInput(process.argv[2], usage);

if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  fail(`Input must be a JSON object.\n${usage}`);
}

const entry = resolveModel(data.model);

if (typeof data.inputs !== 'object' || data.inputs === null || Array.isArray(data.inputs)) {
  fail(`Missing or invalid "inputs" object for model "${entry.slug}".\n${usage}`);
}

const results = entry.calculate(data.inputs);

printJson({
  engine: '@heor/engine',
  kind: 'model-run',
  model: entry.slug,
  modelType: entry.displayName,
  generatedAt: new Date().toISOString(),
  inputs: data.inputs,
  results,
});

if (results && typeof results === 'object' && results.error) {
  fail(`Model calculation reported an error: ${results.error}`);
}

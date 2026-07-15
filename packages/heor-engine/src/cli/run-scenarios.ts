/**
 * run-scenarios — batch scenario comparison (baseline vs alternatives).
 *
 * Usage: npx tsx src/cli/run-scenarios.ts <inputs.json>
 *
 * Input file format (matches a dossier's models/inputs/<model>.json):
 *   {
 *     "deviceClass": "digital-therapy",     // digital-therapy | monitoring-device | therapeutic-device | software-as-medical-device | diagnostic-device
 *     "model": "decision-tree",             // optional; defaults to the device class's model type
 *     "baselineInputs": { ... },            // optional shared baseline (device-class defaults fill gaps)
 *     "scenarios": [
 *       { "id": "baseline", "name": "Baseline" },
 *       { "id": "high-cost", "name": "High cost", "overrides": { "costInterventionTest": 150 } }
 *     ],
 *     "runPSA": false,                      // optional; per-scenario "runPSA" overrides
 *     "psa": { "numIterations": 500, "seed": 42 },   // optional shared PSA settings
 *     "parallelExecutions": 4               // optional
 *   }
 *
 * Prints the batch result (per-scenario results + aggregated metrics) as JSON
 * to stdout. Engine debug logging goes to stderr.
 */
import { executeBatch, type ScenarioExecutionConfig } from '../batch-scenario-executor';
import { listAvailableDeviceClasses, type DeviceClass } from '../economic-model-defaults';
import { fail, printJson, readJsonInput, redirectDebugLogsToStderr, resolveModel } from './shared';

const usage = `Usage: npx tsx src/cli/run-scenarios.ts <inputs.json>
The input file must contain: { "deviceClass": "<class>", "scenarios": [ { "id": ..., "overrides": { ... } }, ... ] }
Device classes: ${listAvailableDeviceClasses().join(', ')}.
See packages/heor-engine/README.md for the full format.`;

const data = readJsonInput(process.argv[2], usage);

if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  fail(`Input must be a JSON object.\n${usage}`);
}

const deviceClasses = listAvailableDeviceClasses();
if (typeof data.deviceClass !== 'string' || !deviceClasses.includes(data.deviceClass as DeviceClass)) {
  fail(`Missing or unknown "deviceClass". Expected one of: ${deviceClasses.join(', ')}.`);
}

if (!Array.isArray(data.scenarios) || data.scenarios.length === 0) {
  fail(`"scenarios" must be a non-empty array.\n${usage}`);
}

const modelEntry = data.model !== undefined ? resolveModel(data.model) : undefined;

const sharedPsa = data.psa ?? {};
if (typeof sharedPsa !== 'object' || sharedPsa === null || Array.isArray(sharedPsa)) {
  fail('"psa" must be an object.');
}

const scenarios: ScenarioExecutionConfig[] = data.scenarios.map((s: any, i: number) => {
  if (typeof s !== 'object' || s === null || Array.isArray(s)) {
    fail(`Scenario at index ${i} must be an object.`);
  }
  const scenarioPsa = { ...sharedPsa, ...(s.psa ?? {}) };
  const psaConfig =
    modelEntry || Object.keys(scenarioPsa).length > 0
      ? {
          ...scenarioPsa,
          ...(modelEntry ? { modelType: modelEntry.displayName as any } : {}),
        }
      : undefined;
  return {
    scenarioId: s.id ?? s.scenarioId ?? `scenario-${i + 1}`,
    scenarioName: s.name ?? s.scenarioName ?? s.id ?? `Scenario ${i + 1}`,
    deviceClass: data.deviceClass as DeviceClass,
    baselineInputs: { ...(data.baselineInputs ?? {}), ...(s.inputs ?? {}) },
    aiSuggestedInputs: s.aiSuggestedInputs,
    expertProvidedInputs: s.expertProvidedInputs,
    parameterOverrides: s.overrides ?? s.parameterOverrides,
    runPSA: s.runPSA ?? data.runPSA ?? false,
    psaConfig,
  };
});

redirectDebugLogsToStderr();

const result = await executeBatch({
  scenarios,
  parallelExecutions: data.parallelExecutions,
  enableCaching: data.enableCaching,
  cacheKeyPrefix: data.cacheKeyPrefix,
});

printJson({
  engine: '@heor/engine',
  kind: 'scenario-batch-run',
  model: modelEntry?.slug,
  deviceClass: data.deviceClass,
  generatedAt: new Date().toISOString(),
  result,
});

if (result.failedScenarios > 0) {
  const failures = result.results
    .filter(r => r.status === 'failed')
    .map(r => `${r.scenarioId}: ${r.error}`)
    .join('; ');
  fail(`${result.failedScenarios} scenario(s) failed: ${failures}`);
}

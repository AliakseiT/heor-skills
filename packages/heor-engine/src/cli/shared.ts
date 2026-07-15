/**
 * Shared helpers for the @heor/engine CLI entrypoints.
 * (New code — not part of the characterization port.)
 */
import { readFileSync } from 'node:fs';
import {
  calculateBudgetImpactModel,
  calculateDecisionTreeModel,
  calculateDiscreteEventSimulationModel,
  calculateMarkovModel,
  calculatePartitionedSurvivalModel,
  calculateStateTransitionModel,
} from '../ce-models';

export interface ModelEntry {
  /** Canonical kebab-case identifier, used in dossier file names (models/inputs/<model>.json). */
  slug: string;
  /** Display name as used inside the engine ("modelType"). */
  displayName: string;
  /** Whether the PSA engine supports this model type. */
  psaSupported: boolean;
  calculate: (inputs: any) => any;
}

export const MODEL_REGISTRY: ModelEntry[] = [
  { slug: 'decision-tree', displayName: 'Decision Tree', psaSupported: true, calculate: calculateDecisionTreeModel as (inputs: any) => any },
  { slug: 'markov-chain', displayName: 'Markov Chain', psaSupported: true, calculate: calculateMarkovModel as (inputs: any) => any },
  { slug: 'budget-impact', displayName: 'Budget Impact Assessment', psaSupported: true, calculate: calculateBudgetImpactModel as (inputs: any) => any },
  { slug: 'state-transition', displayName: 'State Transition Model', psaSupported: false, calculate: calculateStateTransitionModel as (inputs: any) => any },
  { slug: 'partitioned-survival', displayName: 'Partitioned Survival Model', psaSupported: false, calculate: calculatePartitionedSurvivalModel as (inputs: any) => any },
  { slug: 'discrete-event-simulation', displayName: 'Discrete Event Simulation', psaSupported: false, calculate: calculateDiscreteEventSimulationModel as (inputs: any) => any },
];

export function modelSlugs(): string {
  return MODEL_REGISTRY.map(m => m.slug).join(', ');
}

/** Print an error to stderr and exit non-zero. */
export function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

/** Resolve a model by slug or display name (case-insensitive). */
export function resolveModel(name: unknown): ModelEntry {
  if (typeof name !== 'string' || name.trim() === '') {
    fail(`Missing "model" field. Expected one of: ${modelSlugs()}.`);
  }
  const needle = name.trim().toLowerCase();
  const entry = MODEL_REGISTRY.find(
    m => m.slug === needle || m.displayName.toLowerCase() === needle
  );
  if (!entry) {
    fail(`Unknown model "${name}". Expected one of: ${modelSlugs()}.`);
  }
  return entry;
}

/** Read and parse a JSON input file given on argv, failing with usage help. */
export function readJsonInput(path: string | undefined, usage: string): any {
  if (!path) {
    fail(usage);
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read input file "${path}".\n${usage}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Input file "${path}" is not valid JSON: ${(e as Error).message}`);
  }
}

/**
 * Route the engine's internal debug logging (console.log) to stderr so that
 * stdout carries only the final JSON result.
 */
export function redirectDebugLogsToStderr(): void {
  console.log = (...args: unknown[]) => {
    console.error(...args);
  };
}

/** Serialize a result to stdout as pretty JSON. */
export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

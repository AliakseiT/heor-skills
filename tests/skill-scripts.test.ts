/**
 * Tests for the deterministic skill scripts.
 *
 * These tests run the scripts that don't need an LLM: prisma-counts,
 * regulation-navigator evaluate, and tariff-scout search. They use the
 * demo dossier and bundled data as fixtures.
 */
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import * as path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '..');
const TSX_CLI = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const tsx = `node ${JSON.stringify(TSX_CLI)}`;

function run(cmd: string, opts: { cwd?: string } = {}): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8',
      cwd: opts.cwd ?? REPO_ROOT,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', status: 0 };
  } catch (e: any) {
    return { stdout: e.stdout ?? '', stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
}

describe('prisma-counts.ts', () => {
  const script = 'plugins/heor/skills/prisma-review/scripts/prisma-counts.ts';
  const demoDossier = 'examples/demo-dossier';

  it('computes counts from the demo dossier PRISMA files', () => {
    const result = run(`${tsx} ${script} ${demoDossier} --json`);
    expect(result.status).toBe(0);
    const counts = JSON.parse(result.stdout);
    expect(counts.totalIdentified).toBeGreaterThan(0);
    expect(counts.recordsScreened).toBeGreaterThan(0);
    expect(counts.studiesIncludedSynthesis).toBe(6);
  });

  it('produces a mermaid diagram without --json', () => {
    const result = run(`${tsx} ${script} ${demoDossier}`);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('flowchart');
    expect(result.stdout).toContain('Studies included');
  });
});

describe('regulation-navigator evaluate.ts', () => {
  const script = 'plugins/heor/skills/regulation-navigator/scripts/evaluate.ts';

  it('evaluates a CH digital-health pathway with a pathway name', () => {
    const result = run(`${tsx} ${script} --jurisdiction ch --category digital-health --riskClass IIa --hasAI --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0].input.jurisdiction).toBe('ch');
    expect(output[0].pathway).toBeDefined();
    expect(output[0].pathway.pathwayName).toBeTruthy();
  });

  it('evaluates multiple jurisdictions with an array input', () => {
    const input = JSON.stringify([
      { jurisdiction: 'ch', category: 'digital-health', riskClass: 'IIa' },
      { jurisdiction: 'de', category: 'digital-health', riskClass: 'IIa' },
    ]);
    const result = run(`echo '${input}' | ${tsx} ${script} --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveLength(2);
    expect(output[0].input.jurisdiction).toBe('ch');
    expect(output[1].input.jurisdiction).toBe('de');
  });

  it('returns a pathway for a US hardware query', () => {
    const result = run(`${tsx} ${script} --jurisdiction us --category hardware --riskClass IIa --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0].input.jurisdiction).toBe('us');
    expect(output[0].pathway).toBeDefined();
  });
});

describe('tariff-scout search.ts', () => {
  const script = 'plugins/heor/skills/tariff-scout/scripts/search.ts';

  it('searches MiGeL for a known term', () => {
    const result = run(`${tsx} ${script} "Inkontinenz" --jurisdiction ch --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.results).toBeDefined();
    expect(output.results.length).toBeGreaterThan(0);
    expect(output.results[0].code).toBeTruthy();
    expect(output.results[0].list).toBe('migel');
  });

  it('returns empty results for a nonsense query', () => {
    const result = run(`${tsx} ${script} "zzzznotreal" --jurisdiction ch --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.results).toHaveLength(0);
  });

  it('searches across all jurisdictions when no --jurisdiction is given', () => {
    const result = run(`${tsx} ${script} "monitor" --json`);
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.results).toBeDefined();
    expect(Array.isArray(output.results)).toBe(true);
  });
});

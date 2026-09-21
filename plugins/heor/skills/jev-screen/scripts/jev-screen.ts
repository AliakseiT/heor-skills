#!/usr/bin/env npx tsx
/**
 * jev-screen.ts — screen PRISMA records with Jev (TypeSafe System One).
 *
 * Deterministic glue around a judgment model: the agent never screens by hand,
 * the model never sees anything but one atomic yes/no question per PICO
 * dimension, and code composes the answers. Zero runtime dependencies
 * (only node:fs / node:path and global fetch).
 *
 * Usage:
 *   npx tsx scripts/jev-screen.ts --dossier <dir> [options]
 *
 * Reads  : <dossier>/prisma/pico.yaml, <dossier>/prisma/search-results.json
 * Writes : <dossier>/prisma/screening.json        (dossier schema, machine-owned)
 *          <dossier>/prisma/screening-probs.json  (per-question probs sidecar)
 *
 * Options:
 *   --dossier <dir>      dossier directory (default: cwd)
 *   --low <n> --high <n> decision thresholds, 0 < low < high < 1 (default 0.4 0.6)
 *   --lean balanced|sensitive  sensitive counts borderline dims as met
 *                             ("when in doubt, include"; default balanced)
 *   --modelling-focus      add an economic-relevance question; records reporting
 *                          evaluation results or model-usable parameters are
 *                          included even with a loose clinical PICO fit
 *   --timing <text>      optional T dimension (else skipped, never judged)
 *   --study-type <text>  optional S dimension (else skipped, never judged)
 *   --limit <n>          screen at most n unscreened records (default: all)
 *   --resume             skip ids already present in screening.json (default)
 *   --no-resume          re-screen everything
 *   --dry-run            print the built questions, make no API calls
 *   --self-test          offline unit checks (YAML subset parser, decide matrix,
 *                        dossier mapping); no network. Exit non-zero on failure.
 *   --json               machine-readable stdout summary
 *
 * Env: TYPESAFE_API_KEY (required unless --dry-run / --self-test).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const API_URL = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-latest';
const LOW_DEFAULT = 0.4;
const HIGH_DEFAULT = 0.6;
const BATCH = 5;

// ---------------------------------------------------------------------------
// Minimal YAML subset reader: mappings, nested maps, lists of scalars/maps,
// folded (>) / literal (|) block scalars, quoted strings, comments.
// Good enough for pico.yaml; NOT a general YAML parser.
// ---------------------------------------------------------------------------

type YNode = string | string[] | { [k: string]: YNode };

function parseYamlSubset(text: string): { [k: string]: YNode } {
  const lines = text.split('\n');
  const root: { [k: string]: YNode } = {};
  // stack of {indent, container} where container is object or {__list: []}
  const stack: { indent: number; obj: any }[] = [{ indent: -1, obj: root }];
  let pendingKey: { parent: any; key: string; indent: number } | null = null;

  const cur = () => stack[stack.length - 1];

  function placeValue(parent: any, key: string, value: YNode) {
    if (Array.isArray(parent)) parent.push({ [key]: value });
    else parent[key] = value;
  }

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const noComment = raw.split(/(?<!["'])#(?!.*["'])/)[0]; // crude comment strip
    if (!noComment.trim()) { i++; continue; }
    const indent = noComment.length - noComment.trimStart().length;
    const line = noComment.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
    if (pendingKey && indent > pendingKey.indent) {
      // value belongs to pending key — handled below via stack push
    } else {
      pendingKey = null;
    }

    if (line.startsWith('- ')) {
      const parent = cur().obj;
      const arr = Array.isArray(parent) ? parent : null;
      const item = line.slice(2).trim();
      if (arr) {
        if (item.includes(':')) {
          const ci = item.indexOf(':');
          const k = item.slice(0, ci).trim();
          const v = item.slice(ci + 1).trim();
          const o: any = {};
          o[k] = v ? unquote(v) : null;
          arr.push(o);
          if (!v) stack.push({ indent: indent + 2, obj: o });
        } else {
          arr.push(unquote(item));
        }
      } else {
        // "- " directly under a mapping key: convert pending key to list
        if (pendingKey && pendingKey.indent === indent) {
          const list: any[] = [];
          setKey(pendingKey.parent, pendingKey.key, list);
          stack.push({ indent, obj: list });
          pendingKey = null;
          continue; // reprocess this line against the new list level
        }
      }
      i++;
      continue;
    }

    const ci = line.indexOf(':');
    if (ci === -1) { i++; continue; }
    const key = line.slice(0, ci).trim();
    let rest = line.slice(ci + 1).trim();
    const parent = cur().obj;

    if (rest === '' || rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      const folded = rest.startsWith('>');
      // gather indented block
      const block: string[] = [];
      let j = i + 1;
      while (j < lines.length && (lines[j].trim() === '' || lines[j].length - lines[j].trimStart().length > indent)) {
        block.push(lines[j].trim());
        j++;
      }
      if (block.length && (rest === '')) {
        // nested map or list follows; decide by first non-empty line
        const first = block.find((l) => l !== '');
        if (first && first.startsWith('- ')) {
          const list: any[] = [];
          setKey(parent, key, list);
          stack.push({ indent, obj: list });
          pendingKey = { parent, key, indent };
        } else {
          const o: any = {};
          setKey(parent, key, o);
          stack.push({ indent, obj: o });
        }
        i++;
        continue;
      }
      const text = folded ? block.join(' ') : block.join('\n');
      setKey(parent, key, text);
      i = j;
      continue;
    }

    setKey(parent, key, unquote(rest));
    i++;
  }
  return root;

  function setKey(parent: any, key: string, value: YNode) {
    if (Array.isArray(parent)) {
      const last = parent[parent.length - 1];
      if (last && typeof last === 'object') last[key] = value;
      else parent.push({ [key]: value });
    } else {
      parent[key] = value;
    }
  }
  function unquote(v: string): string {
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    return v;
  }
  function placeValue(_p: any, _k: string, _v: YNode) { /* folded into setKey */ void _p; void _k; void _v; }
}

// ---------------------------------------------------------------------------
// PICO text + Jev battery
// ---------------------------------------------------------------------------

interface PicoTexts {
  population: string;
  investigated: string;
  comparison: string;
  outcomes: string;
  timing?: string;
  studyType?: string;
}

function str(n: YNode | undefined): string {
  return typeof n === 'string' ? n : '';
}

function picoFromYaml(y: { [k: string]: YNode }, timing?: string, studyType?: string): PicoTexts {
  const pop: any = (y.population as any) || {};
  const inv: any = (y.intervention as any) || {};
  const cmp: any = (y.comparison as any) || {};
  const out: any = (y.outcomes as any) || {};
  const popText = [
    str(pop.description), pop.condition ? `Condition: ${pop.condition}.` : '',
    pop.ageRange ? `Age: ${pop.ageRange}.` : '', pop.setting ? `Setting: ${pop.setting}.` : '',
    ...(Array.isArray(pop.additionalCriteria) ? pop.additionalCriteria : []).map((c) => String(c)),
  ].filter(Boolean).join(' ');
  const invText = [`${str(inv.name)}: ${str(inv.description)}`.replace(/^: /, ''), inv.duration ? `Duration: ${inv.duration}.` : '', inv.deliveryFormat ? `Delivery: ${inv.deliveryFormat}.` : ''].filter(Boolean).join(' ');
  const cmpText = [`${str(cmp.name)}: ${str(cmp.description)}`.replace(/^: /, '')].filter(Boolean).join(' ');
  const prim = Array.isArray(out.primary) ? out.primary : [];
  const outText = prim.map((o: any) => `${str(o.name)}${o.timeframe ? ` (${o.timeframe})` : ''}: ${str(o.measure)}`).join('; ')
    || str(out.description);
  const p: PicoTexts = { population: popText, investigated: invText, comparison: cmpText, outcomes: outText };
  if (timing) p.timing = timing;
  if (studyType) p.studyType = studyType;
  return p;
}

function buildQuestions(p: PicoTexts, modellingFocus = false): Record<string, { type: string; instructions: string }> {
  const q: Record<string, { type: string; instructions: string }> = {
    population: { type: 'noul', instructions: `Does \`item.text\` describe patients, a problem, or a population matching ALL of: ${p.population}?` },
    investigated: { type: 'noul', instructions: `Does \`item.text\` describe an investigated condition matching ALL of: ${p.investigated}?` },
    outcome: { type: 'noul', instructions: `Does \`item.text\` report an outcome matching ANY of: ${p.outcomes}?` },
  };
  if (p.comparison?.trim()) {
    q.comparison = {
      type: 'noul',
      instructions: `Does the comparison in \`item.text\` match ANY of: ${p.comparison.trim()}? Answer yes if it names a matching comparator OR leaves the comparator unspecified (common in abstracts). Answer no only if it names a clearly different comparator.`,
    };
  }
  if (p.timing?.trim()) q.timing = { type: 'noul', instructions: `Is the timing in \`item.text\` consistent with ALL of: ${p.timing.trim()}?` };
  if (p.studyType?.trim()) {
    q.study_type = {
      type: 'noul',
      instructions: `Does \`item.text\` describe a study type matching: ${p.studyType.trim()}? Pilot studies of that type count as yes. Protocols for planned studies, reviews, editorials, case reports or case series count as no.`,
    };
  }
  q.no_primary_data = {
    type: 'noul',
    instructions: 'Is `item.text` a protocol, review, editorial, case report or case series with no primary study results reported?',
  };
  if (modellingFocus) {
    q.modelling_value = {
      type: 'noul',
      instructions: 'Does `item.text` report economic evaluation results (cost-effectiveness, cost-utility, budget impact, ICER, cost per QALY) or model-usable parameter estimates (effect sizes, utilities, costs, resource use, adherence, transition probabilities) for depression interventions?',
    };
  }
  return q;
}

const WHY: Record<string, string> = {
  population: 'population does not match PICO',
  investigated: 'investigated condition does not match PICO',
  comparison: 'comparison does not match PICO',
  outcome: 'no matching outcome reported',
  timing: 'timing does not match PICO',
  study_type: 'study type does not match',
};

type DossierDecision = 'include' | 'exclude' | 'maybe';

function decide(answers: Record<string, number>, dims: string[], low: number, high: number, lean: 'balanced' | 'sensitive' = 'balanced', modellingFocus = false): { decision: DossierDecision; reasons: string[] } {
  const neg = (k: string) => (answers[k] ?? 0.5) <= low;
  const mid = (k: string) => { const v = answers[k] ?? 0.5; return v > low && v < high; };
  if ((answers.no_primary_data ?? 0) >= high)
    return { decision: 'exclude', reasons: ['no primary results (protocol/review/case report)'] };
  // Modelling focus (prisma-review convention): economic evaluations and
  // parameter sources are included for model relevance even when the clinical
  // PICO fit is loose — provided the record reports usable numbers.
  if (modellingFocus && (answers.modelling_value ?? 0) >= high)
    return { decision: 'include', reasons: ['economically relevant: reports evaluation results or model-usable parameters'] };
  const failed = dims.filter(neg);
  // Sensitive mode mirrors the review convention "when in doubt, include":
  // borderline dimensions count as met, so only confident mismatches exclude.
  // (Missing abstracts still become maybe, never include — see caller.)
  const borderline = lean === 'sensitive' ? [] : dims.filter(mid);
  if (borderline.length > 0) return { decision: 'maybe', reasons: [`borderline: ${borderline.join(', ')}`] };
  if (failed.length > 0) return { decision: 'exclude', reasons: failed.map((k) => WHY[k] ?? `${k} does not match`) };
  return { decision: 'include', reasons: [lean === 'sensitive' ? 'meets PICO (sensitive lean: borderline counted as met)' : 'meets PICO on all judged dimensions'] };
}

// ---------------------------------------------------------------------------
// API + dossier I/O
// ---------------------------------------------------------------------------

async function callJev(apiKey: string, pico: PicoTexts, item: { id: string; text: string }, questions: Record<string, any>, retries = 2): Promise<Record<string, number>> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, state: { pico, item: { id: item.id, text: item.text } }, questions }),
    });
    if (res.ok) {
      const data = (await res.json()) as { answers: Record<string, { noul?: number }> };
      const probs: Record<string, number> = {};
      for (const k of Object.keys(questions)) probs[k] = data.answers[k]?.noul ?? 0.5;
      return probs;
    }
    if ((res.status === 429 || res.status === 529) && attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    throw new Error(`TypeSafe ${res.status}: ${await res.text()}`);
  }
}

interface Args {
  dossier: string; low: number; high: number; timing?: string; studyType?: string;
  lean: 'balanced' | 'sensitive'; modellingFocus: boolean;
  limit: number; resume: boolean; dryRun: boolean; selfTest: boolean; json: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dossier: process.cwd(), low: LOW_DEFAULT, high: HIGH_DEFAULT, lean: 'balanced', modellingFocus: false, limit: Infinity, resume: true, dryRun: false, selfTest: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dossier') a.dossier = argv[++i];
    else if (t === '--low') a.low = Number(argv[++i]);
    else if (t === '--high') a.high = Number(argv[++i]);
    else if (t === '--timing') a.timing = argv[++i];
    else if (t === '--study-type') a.studyType = argv[++i];
    else if (t === '--lean') {
      const v = argv[++i];
      if (v !== 'balanced' && v !== 'sensitive') throw new Error('--lean must be balanced or sensitive');
      a.lean = v;
    }
    else if (t === '--modelling-focus') a.modellingFocus = true;
    else if (t === '--limit') a.limit = Number(argv[++i]);
    else if (t === '--resume') a.resume = true;
    else if (t === '--no-resume') a.resume = false;
    else if (t === '--dry-run') a.dryRun = true;
    else if (t === '--self-test') a.selfTest = true;
    else if (t === '--json') a.json = true;
  }
  if (!(a.low > 0 && a.high < 1 && a.low < a.high)) throw new Error('need 0 < --low < --high < 1');
  return a;
}

// ---------------------------------------------------------------------------
// Offline self-test (no network): parser, decide matrix, dossier mapping
// ---------------------------------------------------------------------------

function selfTest(): { pass: number; fail: string[] } {
  const fail: string[] = [];
  let pass = 0;
  const ok = (cond: boolean, name: string) => { if (cond) pass++; else fail.push(name); };

  const y = parseYamlSubset([
    'population:',
    '  description: >-',
    '    Adults with depression',
    '    receiving care.',
    '  ageRange: "18-65"',
    'intervention:',
    '  name: SereniCBT',
    '  description: App CBT',
    'comparison:',
    '  name: Usual care',
    '  description: GP follow-up',
    'outcomes:',
    '  primary:',
    '    - name: PHQ-9 change',
    '      timeframe: 12 weeks',
    '      measure: Mean change',
  ].join('\n'));
  ok(str((y.population as any)?.description) === 'Adults with depression receiving care.', 'yaml folded block');
  ok(str((y.population as any)?.ageRange) === '18-65', 'yaml quoted scalar');
  const prim: any = (y.outcomes as any)?.primary;
  ok(Array.isArray(prim) && prim[0]?.name === 'PHQ-9 change', 'yaml list of maps');

  const p = picoFromYaml(y);
  ok(p.population.includes('Adults with depression') && p.investigated.includes('SereniCBT'), 'pico texts');
  ok(!('timing' in p), 'timing skipped when absent');
  const q = buildQuestions(p);
  ok(Object.keys(q).join(',') === 'population,investigated,outcome,comparison,no_primary_data', 'dynamic battery');
  ok(!('study_type' in buildQuestions(picoFromYaml(y, '12 w'))), 'studyType skipped when absent');
  ok('timing' in buildQuestions(picoFromYaml(y, '12 w')), 'timing asked when present');

  const dims = ['population', 'investigated', 'outcome', 'comparison'];
  ok(decide({ population: 0.9, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.1 }, dims, 0.4, 0.6).decision === 'include', 'all confident -> include');
  ok(decide({ population: 0.05, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.1 }, dims, 0.4, 0.6).decision === 'exclude', 'confident mismatch -> exclude');
  ok(decide({ population: 0.5, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.1 }, dims, 0.4, 0.6).decision === 'maybe', 'borderline -> maybe');
  ok(decide({ population: 0.5, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.1 }, dims, 0.4, 0.6, 'sensitive').decision === 'include', 'sensitive lean counts borderline as met');
  ok(decide({ population: 0.05, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.1 }, dims, 0.4, 0.6, 'sensitive').decision === 'exclude', 'sensitive lean still excludes confident mismatch');
  ok(decide({ population: 0.2, investigated: 0.2, outcome: 0.1, comparison: 0.9, no_primary_data: 0.1, modelling_value: 0.95 }, dims, 0.4, 0.6, 'balanced', true).decision === 'include', 'modelling focus includes parameter sources');
  ok(decide({ population: 0.2, investigated: 0.2, outcome: 0.1, comparison: 0.9, no_primary_data: 0.1, modelling_value: 0.2 }, dims, 0.4, 0.6, 'balanced', true).decision === 'exclude', 'modelling focus without numbers still excludes');
  ok(decide({ population: 0.9, investigated: 0.9, outcome: 0.9, comparison: 0.9, no_primary_data: 0.95 }, dims, 0.4, 0.6).decision === 'exclude', 'protocol flag -> exclude');
  return { pass, fail };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.selfTest) {
    const { pass, fail } = selfTest();
    console.log(JSON.stringify({ pass, fail }));
    if (fail.length > 0) process.exit(1);
    return;
  }

  const prismaDir = path.join(args.dossier, 'prisma');
  const picoRaw = fs.readFileSync(path.join(prismaDir, 'pico.yaml'), 'utf8');
  const pico = picoFromYaml(parseYamlSubset(picoRaw), args.timing, args.studyType);
  if (!pico.population.trim() || !pico.investigated.trim() || !pico.outcomes.trim()) {
    throw new Error('pico.yaml must yield population, intervention, and outcomes text');
  }
  const questions = buildQuestions(pico, args.modellingFocus);
  // modelling_value is a bonus path to include, never a requirement to meet.
  const dims = Object.keys(questions).filter((k) => k !== 'no_primary_data' && k !== 'modelling_value');

  const searchRaw = JSON.parse(fs.readFileSync(path.join(prismaDir, 'search-results.json'), 'utf8'));
  const records: any[] = Array.isArray(searchRaw) ? searchRaw : (searchRaw.records ?? []);

  if (args.dryRun) {
    console.log(JSON.stringify({ dims, questions, recordCount: records.length }, null, 2));
    return;
  }

  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error('Set TYPESAFE_API_KEY (create one at https://console.typesafe.ai/)');

  const screeningPath = path.join(prismaDir, 'screening.json');
  let existing: any[] = [];
  if (args.resume && fs.existsSync(screeningPath)) {
    existing = JSON.parse(fs.readFileSync(screeningPath, 'utf8'));
  }
  const done = new Set(existing.map((e) => e.id));
  const todo = records.filter((r) => r.id && !done.has(r.id)).slice(0, args.limit);

  const screening = [...existing];
  const probsOut: Record<string, any> = {};
  const counts = { include: 0, exclude: 0, maybe: 0 };
  for (const e of existing) counts[e.decision as keyof typeof counts] = (counts[e.decision as keyof typeof counts] ?? 0) + 1;

  for (let i = 0; i < todo.length; i += BATCH) {
    const chunk = todo.slice(i, i + BATCH);
    const results = await Promise.all(chunk.map(async (r) => {
      const text = `${r.title ?? ''}. ${r.abstract ?? ''}`.trim();
      if (!text) {
        // Convention: missing abstract is never an auto-exclude.
        return { r, probs: {}, decision: 'maybe' as DossierDecision, reasons: ['abstract missing; full text required'] };
      }
      const probs = await callJev(apiKey, pico, { id: String(r.id), text: text.slice(0, 20000) }, questions);
      const { decision, reasons } = decide(probs, dims, args.low, args.high, args.lean, args.modellingFocus);
      if (r.isMandatory && decision === 'exclude') {
        return { r, probs, decision: 'maybe' as DossierDecision, reasons: [...reasons, 'mandatory record: user decides'] };
      }
      return { r, probs, decision, reasons };
    }));
    for (const { r, probs, decision, reasons } of results) {
      screening.push({
        id: r.id,
        decision,
        reason: `${decision === 'include' ? 'Include' : decision === 'exclude' ? 'Exclude' : 'Maybe'}: ${reasons.join('; ')}`,
        screenedBy: 'ai',
        ...(r.isMandatory ? { isMandatory: true } : {}),
      });
      probsOut[r.id] = { probs, thresholds: { low: args.low, high: args.high }, model: MODEL };
      counts[decision]++;
    }
    fs.writeFileSync(screeningPath, JSON.stringify(screening, null, 2) + '\n');
  }

  const probsPath = path.join(prismaDir, 'screening-probs.json');
  let prev: Record<string, any> = {};
  if (fs.existsSync(probsPath)) prev = JSON.parse(fs.readFileSync(probsPath, 'utf8'));
  fs.writeFileSync(probsPath, JSON.stringify({ ...prev, ...probsOut }, null, 2) + '\n');

  const summary = { screened: todo.length, counts, dims, out: { screening: screeningPath, probs: probsPath } };
  console.log(args.json ? JSON.stringify(summary) : `screened ${todo.length} (${counts.include} include / ${counts.exclude} exclude / ${counts.maybe} maybe) -> ${screeningPath}`);
}

main().catch((e) => { console.error(`jev-screen: ${e.message}`); process.exit(1); });

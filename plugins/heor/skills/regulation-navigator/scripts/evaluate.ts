/**
 * Deterministic evaluator for the regulation-navigator ruleset.
 *
 * Reads references/rules.json + an input JSON and prints the matching pathway(s),
 * warnings, and country insight — so the skill's answer is reproducible and
 * verifiable rather than improvised by the model.
 *
 * Usage:
 *   npx tsx scripts/evaluate.ts --input input.json
 *   echo '{"jurisdiction":"ch","category":"digital-health","riskClass":"IIa","hasAI":true}' | npx tsx scripts/evaluate.ts
 *   npx tsx scripts/evaluate.ts --jurisdiction ch --category digital-health --riskClass IIa --hasAI
 *   npx tsx scripts/evaluate.ts --input dossier-inputs.json --json   # machine-readable output
 *
 * Input shape (single object or an array of objects for multi-jurisdiction compare):
 *   { jurisdiction: "ch", category: "digital-health", riskClass?: "IIa", hasAI?: true }
 *
 * jurisdiction: ISO 3166-1 alpha-2 lowercase (ch|de|fr|us|uk)
 * category:     digital-health | ivd | hardware | procedure
 * riskClass:    I | IIa | III | NA   (optional; only affects warnings)
 * hasAI:        boolean              (optional; only affects warnings)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RULES_PATH = path.join(HERE, '..', 'references', 'rules.json');

interface Requirement {
  label: string;
  description: string;
  type: string;
  automationLevel: string;
  availability: string;
  criticality?: string;
  link?: string;
}
interface Section {
  id: string;
  title: string;
  sectionType: string;
  requirements: Requirement[];
}
interface Pathway {
  jurisdiction: string | null;
  category: string | null;
  isDefault?: boolean;
  pathwayName: string;
  authority: string;
  timeline: string;
  stopper: string;
  status: string;
  pathwayType: string;
  roleDescription: string;
  expertInsight?: string;
  expertInsightWhenHasAI?: string;
  successRate?: string;
  adoptionBarrier?: string;
  sections: Section[];
}
interface WarningRule {
  matcher: { jurisdiction?: string; category?: string; riskClass?: string; hasAI?: boolean };
  message: string;
}
interface RuleSet {
  version: string;
  lastVerified: string;
  taxonomy: { jurisdictions: string[]; categories: string[]; riskClasses: string[] };
  pathways: Pathway[];
  globalDefault: Pathway;
  warnings: WarningRule[];
  insights: Record<string, string>;
}

interface Input {
  jurisdiction: string;
  category?: string | null;
  riskClass?: string | null;
  hasAI?: boolean;
}

interface Evaluation {
  input: Input;
  pathway: Pathway;
  resolvedBy: 'jurisdiction+category' | 'jurisdiction-default' | 'global-default';
  expertInsight: string | null;
  warnings: string[];
  insight: string | null;
  timelineMaxMonths: number;
}

function loadRules(): RuleSet {
  return JSON.parse(fs.readFileSync(RULES_PATH, 'utf-8')) as RuleSet;
}

/** Faithful port of parseTimelineToMonths from src/lib/pathway-rules.ts. */
export function parseTimelineToMonths(timeline: string): number {
  const lower = timeline.toLowerCase();
  const numbers = (timeline.match(/\d+/g) ?? []).map(Number);
  if (numbers.length === 0) return 0;
  const maxVal = Math.max(...numbers);
  if (lower.includes('year')) return maxVal * 12;
  return maxVal;
}

export function evaluate(rules: RuleSet, input: Input): Evaluation {
  const jurisdiction = input.jurisdiction;
  const category = input.category ?? null;

  // Base pathway is keyed only on (jurisdiction, category) — faithful to evaluatePathway.
  let resolvedBy: Evaluation['resolvedBy'] = 'jurisdiction+category';
  let pathway =
    rules.pathways.find(
      (p) => p.jurisdiction === jurisdiction && p.category === category && category !== null
    ) ?? null;
  if (!pathway) {
    resolvedBy = 'jurisdiction-default';
    pathway = rules.pathways.find((p) => p.jurisdiction === jurisdiction && p.isDefault) ?? null;
  }
  if (!pathway) {
    resolvedBy = 'global-default';
    pathway = rules.globalDefault;
  }

  const expertInsight =
    input.hasAI && pathway.expertInsightWhenHasAI
      ? pathway.expertInsightWhenHasAI
      : pathway.expertInsight ?? null;

  const warnings = rules.warnings
    .filter((w) => {
      const m = w.matcher;
      if (m.jurisdiction !== undefined && m.jurisdiction !== jurisdiction) return false;
      if (m.category !== undefined && m.category !== category) return false;
      if (m.riskClass !== undefined && m.riskClass !== (input.riskClass ?? null)) return false;
      if (m.hasAI !== undefined && m.hasAI !== Boolean(input.hasAI)) return false;
      return true;
    })
    .map((w) => w.message);

  return {
    input,
    pathway,
    resolvedBy,
    expertInsight,
    warnings,
    insight: rules.insights[jurisdiction] ?? null,
    timelineMaxMonths: parseTimelineToMonths(pathway.timeline),
  };
}

// ---- CLI ----

function parseCli(argv: string[]): { inputs: Input[]; json: boolean } {
  let inputFile: string | undefined;
  let json = false;
  const single: Partial<Input> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--input': inputFile = argv[++i]; break;
      case '--json': json = true; break;
      case '--jurisdiction': single.jurisdiction = argv[++i]; break;
      case '--category': single.category = argv[++i]; break;
      case '--riskClass': single.riskClass = argv[++i]; break;
      case '--hasAI': single.hasAI = true; break;
      default: throw new Error(`Unknown argument: ${arg}`);
    }
  }

  let raw: unknown;
  if (inputFile) {
    raw = JSON.parse(fs.readFileSync(path.resolve(inputFile), 'utf-8'));
  } else if (single.jurisdiction) {
    raw = single;
  } else if (!process.stdin.isTTY) {
    const stdin = fs.readFileSync(0, 'utf-8').trim();
    if (!stdin) throw new Error('No input. Provide --input <file>, flags, or pipe JSON via stdin.');
    raw = JSON.parse(stdin);
  } else {
    throw new Error('No input. Provide --input <file>, --jurisdiction ... flags, or pipe JSON via stdin.');
  }

  const inputs = (Array.isArray(raw) ? raw : [raw]) as Input[];
  return { inputs, json };
}

function renderText(rules: RuleSet, evals: Evaluation[]): string {
  const out: string[] = [`Regulation Navigator — ruleset ${rules.version} (last verified ${rules.lastVerified})`];
  for (const e of evals) {
    const p = e.pathway;
    out.push('');
    out.push('═'.repeat(72));
    out.push(
      `${(e.input.jurisdiction || '??').toUpperCase()} · ${e.input.category ?? '(no category)'}` +
        `${e.input.riskClass ? ` · Class ${e.input.riskClass}` : ''}${e.input.hasAI ? ' · AI/ML' : ''}`
    );
    out.push('═'.repeat(72));
    out.push(`Pathway:      ${p.pathwayName}  [${p.status} · ${p.pathwayType}]`);
    out.push(`Authority:    ${p.authority}`);
    out.push(`Timeline:     ${p.timeline}  (max ~${e.timelineMaxMonths} months)`);
    out.push(`Key stopper:  ${p.stopper}`);
    out.push(`Role:         ${p.roleDescription}`);
    out.push(`Resolved by:  ${e.resolvedBy}`);
    if (p.successRate) out.push(`Success rate: ${p.successRate}`);
    if (p.adoptionBarrier) out.push(`Adoption barrier: ${p.adoptionBarrier}`);
    if (e.expertInsight) out.push(`\nExpert insight: ${e.expertInsight}`);
    for (const s of p.sections) {
      out.push(`\n  [${s.sectionType}] ${s.title}`);
      for (const r of s.requirements) {
        const tag = r.type === 'PREREQUISITE' ? 'PREREQ' : 'DELIV ';
        const crit = r.criticality ? ` (${r.criticality})` : '';
        out.push(`    - ${tag} ${r.label}${crit}: ${r.description}`);
        out.push(`        automation=${r.automationLevel} availability=${r.availability}${r.link ? ` link=${r.link}` : ''}`);
      }
    }
    if (e.warnings.length) {
      out.push('\n  Reality-check warnings:');
      for (const w of e.warnings) out.push(`    ! ${w}`);
    }
    if (e.insight) out.push(`\n  Country insight: ${e.insight}`);
  }

  if (evals.length > 1) {
    out.push('');
    out.push('─'.repeat(72));
    out.push('Multi-jurisdiction comparison');
    out.push('─'.repeat(72));
    const fastTrack = evals.filter((e) => e.pathway.status === 'Fast-Track');
    out.push(
      `Fastest / Fast-Track: ${
        fastTrack.length
          ? fastTrack.map((e) => `${e.input.jurisdiction.toUpperCase()}: ${e.pathway.pathwayName}`).join('; ')
          : 'none for these inputs'
      }`
    );
    const enterprise = evals.filter((e) => e.pathway.status === 'Enterprise');
    const mostRigorous = enterprise.length
      ? enterprise
      : [...evals].sort((a, b) => b.timelineMaxMonths - a.timelineMaxMonths).slice(0, 1);
    out.push(
      `Most rigorous / longest: ${mostRigorous
        .map((e) => `${e.input.jurisdiction.toUpperCase()}: ${e.pathway.pathwayName} (~${e.timelineMaxMonths}mo)`)
        .join('; ')}`
    );
  }
  return out.join('\n');
}

function main(): void {
  const rules = loadRules();
  const { inputs, json } = parseCli(process.argv.slice(2));
  for (const input of inputs) {
    if (!input.jurisdiction) throw new Error(`Each input needs a "jurisdiction": ${JSON.stringify(input)}`);
    if (!rules.taxonomy.jurisdictions.includes(input.jurisdiction)) {
      console.error(
        `Warning: jurisdiction "${input.jurisdiction}" not in ruleset ${rules.taxonomy.jurisdictions.join('/')} — will fall back to global default.`
      );
    }
  }
  const evals = inputs.map((input) => evaluate(rules, input));
  if (json) {
    console.log(JSON.stringify(evals, null, 2));
  } else {
    console.log(renderText(rules, evals));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

# HEOR Skills

Market-access and health-economics tooling for medical device companies.
Nine skills covering the reimbursement journey from pathway selection to
application drafting, backed by a deterministic economic modeling engine and
six official reimbursement databases (Switzerland, Germany, France, USA).

Works with Claude Code and any Agent-Skills-compatible harness (Codex,
Cursor, Gemini CLI).

> **Status: pre-release.** Not yet published to any marketplace.

## Pipeline

```mermaid
graph LR
    A["dossier.yaml<br/>+ documents/"] --> B["regulation-navigator<br/>which pathway?"]
    A --> C["tariff-scout<br/>existing code?"]
    C --> B
    B --> D["prisma-review<br/>literature search"]
    D --> E["economic-modeling<br/>CEA, BIA, PSA"]
    E --> F["ch-migel-application<br/>or eurhta-report"]
    F --> G["hta-quality-check<br/>score + consistency"]
```

A dossier is a plain directory. Each skill reads from it, writes to it, and
picks up where the previous one left off. Start with just a `dossier.yaml`
describing your product, and work through the pipeline.

## Skills

| Skill | What it does |
|---|---|
| regulation-navigator | Maps a product to its reimbursement pathway across CH, DE, FR, US, UK with prerequisites and timelines |
| tariff-scout | Searches official reimbursement lists for existing codes and comparable products |
| prisma-review | Runs a PRISMA 2020 systematic literature review: PICO, search, screening, diagram, synthesis |
| economic-modeling | Builds and runs cost-effectiveness and budget-impact models through a deterministic engine |
| ch-migel-application | Drafts a Swiss MiGeL (device list) application form |
| ch-analysenliste-application | Drafts a Swiss Analysenliste (laboratory test) application form |
| ch-klv-forms | Drafts Swiss KLV forms: Meldung, Antrag, Umstrittenheit |
| eurhta-report | Drafts a EUnetHTA Core Model HTA report chapter by chapter |
| hta-quality-check | Scores a draft against BAG rubrics and checks cross-section consistency |

## Economic engine

The `@heor/engine` package is a pure-TypeScript economic modeling engine with
zero runtime dependencies. Six model types (decision tree, Markov chain,
budget impact, state transition, partitioned survival, discrete event
simulation), Monte Carlo PSA with CEAC and tornado diagrams, batch scenario
comparison, Excel export with live formulas, and structured run comparison.

```bash
npx tsx packages/heor-engine/src/cli/run-model.ts examples/markov-chain.json
npx tsx packages/heor-engine/src/cli/run-psa.ts examples/psa-markov-chain.json
npx tsx packages/heor-engine/src/cli/export-excel.ts models/runs/baseline.json
```

## Reimbursement data

Six official reimbursement lists are normalized to versioned JSON and
refreshed monthly by CI:

| Country | List | Source |
|---|---|---|
| Switzerland | MiGeL (devices and aids) | BAG/FOPH |
| Switzerland | Analysenliste (laboratory tests) | BAG/FOPH |
| Germany | DiGA (digital health apps) | BfArM FHIR API |
| Germany | HMV (assistive devices) | GKV-Spitzenverband API |
| France | LPP (medical products and services) | CNAM / ameli |
| USA | HCPCS Level II (procedure codes) | CMS |

## Getting started

```bash
git clone <this-repo>
cd heor-skills
pnpm install

# Run the engine tests
pnpm -r test

# Explore the demo dossier
ls examples/demo-dossier/
```

Install as a Claude Code plugin (once published):

```
/plugin marketplace add <owner>/heor-skills
/plugin install heor@heor-skills
```

## Layout

```
plugins/heor/skills/           9 skills, each with SKILL.md + references
packages/heor-engine/          economic modeling engine (npm-publishable)
data/{ch,de,fr,us}/            normalized reimbursement data (JSON, versioned)
tools/data-pipeline/           fetch + normalize scripts (run by CI cron)
examples/demo-dossier/         fully populated example dossier (SereniCBT)
docs/cookbook/                 recipe guides for common workflows
```

## Principles

- **Country first, language second.** Data and templates are organized by
  jurisdiction. Language is a variant within a jurisdiction, not the other
  way around.
- **The engine does the math.** Economic model results come from
  `@heor/engine` CLI runs, never from the LLM.
- **Drafts, not submissions.** Every skill ends with a human-review
  disclaimer. Output is a starting point for a qualified professional.
- **No servers, no databases.** Markdown, JSON, and one TypeScript engine.
  The data pipeline runs in CI and opens a PR when official sources change.

## License

Apache-2.0. Drafts produced with these skills require review by qualified
professionals. Nothing here is regulatory, clinical, or reimbursement
advice.

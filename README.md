# HEOR Skills — Market Access & Health Economics for AI Agents

Open-source Agent Skills pack for **HEOR (Health Economics and Outcomes Research)** and **medical device market access**, distilled from the [MedTech Access](https://www.medtechaccess.ch/) suite. Works with Claude Code (full plugin experience) and any [Agent Skills](https://agentskills.io)-compatible harness (Codex, Copilot, Cursor, Gemini CLI, Goose, …).

> **Status: pre-release extraction in progress.** Not yet published to any marketplace.

## What's inside

| Skill | Scope | What it does |
|---|---|---|
| `prisma-review` | Global | Systematic literature review: PICO → search queries → screening → PRISMA 2020 diagram → narrative synthesis. Uses the official PubMed connector + ClinicalTrials.gov MCP. |
| `eurhta-report` | EU | EUnetHTA Core Model dossier drafting, chapter by chapter, with rubrics. |
| `economic-modeling` | Global | CEA/BIA: decision tree, Markov, partitioned survival, DES, state transition, budget impact — computed by the deterministic `heor-engine`, never by the LLM. Includes PSA and scenario comparison. |
| `regulation-navigator` | CH · DE · FR · UK · US | Map device type × risk class × jurisdiction to a market-access pathway with prerequisites and timelines (`rules.json`). |
| `tariff-scout` | CH · DE · FR · US | Search official reimbursement lists (MiGeL, Analysenliste, HMV, DiGA, LPP, HCPCS) for existing codes and analogs. |
| `ch-migel-application` | CH | Draft a MiGeL (Mittel- und Gegenständeliste) application on the official form structure. |
| `ch-analysenliste-application` | CH | Draft an Analysenliste application. |
| `ch-klv-forms` | CH | Draft KLV forms: Meldung neue Leistung, Antrag neue Leistung, Umstrittenheit. |
| `hta-quality-check` | CH/EU | Score a draft against the BAG rubric and run cross-chapter consistency checks. |

## Design principles

- **Country/region-first, never language-first.** Data, skills, and templates are organized by jurisdiction (ISO 3166 — `ch`, `de`, `fr`, `us`; region `eu`); languages are variants within a jurisdiction (e.g., MiGeL data ships in `de`/`fr`/`it`).
- **Minimal maintenance, evergreen by automation.** Markdown + JSON + one dependency-free TypeScript engine. No server, database, or hosting. Official-source data refresh runs on a schedule in CI and opens a reviewable PR; merged updates ship as tagged data releases you can pin.
- **The LLM never does arithmetic.** All economic modeling runs through `packages/heor-engine` — deterministic, unit-tested, auditable.
- **Human-in-the-loop by design.** Output is a draft for expert review, not a submission.

## Layout

```
.claude-plugin/marketplace.json   # this repo is a Claude Code plugin marketplace
plugins/heor/                     # the plugin: skills + MCP wiring + commands
packages/heor-engine/             # pure-TS economic modeling engine (npm-publishable)
data/{ch,de,fr,us}/               # normalized official reimbursement lists (JSON, versioned)
tools/data-pipeline/              # fetch + normalize scripts (run by CI cron)
```

## Install (once published)

```
/plugin marketplace add <owner>/heor-skills
/plugin install heor@heor-skills
```

Bare skills (non-Claude harnesses): copy `plugins/heor/skills/<name>` into your harness's skills directory, or use `npx skills add`.

## License

Apache-2.0. Drafts produced with these skills require review by qualified professionals; nothing here is regulatory, clinical, or reimbursement advice.

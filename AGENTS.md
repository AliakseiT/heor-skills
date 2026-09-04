# AGENTS.md

This file is the entry point for AI agents entering this repository.

## What this repo is

Open-source HEOR (Health Economics and Outcomes Research) and medical device
market-access skills for AI agents. Nine skills, a deterministic economic
modeling engine, and six jurisdictional reimbursement databases (CH, DE, FR,
US). Works with Claude Code, Codex, Cursor, Gemini CLI, and any
Agent-Skills-compatible harness.

## Skill registry

When a user asks for something matching the left column, use the skill on
the right. Load the SKILL.md from the path shown.

| User intent | Skill | Path |
|---|---|---|
| "literature review", "PRISMA", "systematic search", "PICO" | prisma-review | `plugins/heor/skills/prisma-review/SKILL.md` |
| "cost-effectiveness", "CEA", "BIA", "Markov", "ICER", "PSA" | economic-modeling | `plugins/heor/skills/economic-modeling/SKILL.md` |
| "HTA report", "EUnetHTA", "Core Model", "dossier chapter" | eurhta-report | `plugins/heor/skills/eurhta-report/SKILL.md` |
| "MiGeL", "Mittel- und Gegenständeliste", "Swiss device list application" | ch-migel-application | `plugins/heor/skills/ch-migel-application/SKILL.md` |
| "Analysenliste", "lab test reimbursement", "Swiss lab list" | ch-analysenliste-application | `plugins/heor/skills/ch-analysenliste-application/SKILL.md` |
| "KLV", "Antrag", "Meldung", "Umstrittenheit" | ch-klv-forms | `plugins/heor/skills/ch-klv-forms/SKILL.md` |
| "regulatory pathway", "reimbursement route", "market access" | regulation-navigator | `plugins/heor/skills/regulation-navigator/SKILL.md` |
| "reimbursement code", "tariff search", "existing code" | tariff-scout | `plugins/heor/skills/tariff-scout/SKILL.md` |
| "quality check", "score", "consistency check" | hta-quality-check | `plugins/heor/skills/hta-quality-check/SKILL.md` |

## Typical workflow order

1. **regulation-navigator** — determine the pathway (which jurisdiction, which form)
2. **tariff-scout** — check if an existing reimbursement code already covers the product
3. **prisma-review** — build the evidence base (systematic literature review)
4. **economic-modeling** — run the cost-effectiveness and budget impact models
5. **ch-migel-application** (or eurhta-report, or other application skill) — draft the submission
6. **hta-quality-check** — score the draft and check consistency

This order is not mandatory. Skills read from a shared dossier directory and
tolerate missing files. See `plugins/heor/DOSSIER_FORMAT.md` for the file
contract.

## Engine CLI commands

All economic calculations run through `packages/heor-engine`. Never compute
model results yourself.

```bash
# Deterministic single-model run
npx tsx packages/heor-engine/src/cli/run-model.ts <inputs.json>

# Probabilistic sensitivity analysis (Monte Carlo)
npx tsx packages/heor-engine/src/cli/run-psa.ts <inputs.json>

# Batch scenario comparison
npx tsx packages/heor-engine/src/cli/run-scenarios.ts <inputs.json>

# Export run records to Excel with live formulas
npx tsx packages/heor-engine/src/cli/export-excel.ts <run1.json> [--output <path>]

# Compare multiple run records
npx tsx packages/heor-engine/src/cli/compare-runs.ts <run1.json> <run2.json> [--baseline <file>]
```

## Other scripts

```bash
# Regulation navigator: evaluate a pathway deterministically
npx tsx plugins/heor/skills/regulation-navigator/scripts/evaluate.ts \
  --jurisdiction ch --category digital-health --riskClass IIa --hasAI

# Tariff scout: search reimbursement lists
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "depression app" --jurisdiction ch

# PRISMA counts: compute flow diagram numbers
npx tsx plugins/heor/skills/prisma-review/scripts/prisma-counts.ts <dossier-dir>

# Data pipeline: refresh reimbursement databases
npx tsx tools/data-pipeline/refresh.ts --all --download
```

## Key files

| File | What it tells you |
|---|---|
| `CONVENTIONS.md` | Binding rules for all contributions |
| `plugins/heor/DOSSIER_FORMAT.md` | The dossier directory contract (what files skills read/write) |
| `packages/heor-engine/README.md` | Engine CLI docs (input formats, model types) |
| `TESTING.md` | How to test the engine and skills |
| `examples/demo-dossier/` | A fully populated example dossier (SereniCBT) |
| `tools/data-pipeline/sources.json` | Registry of official reimbursement data sources |

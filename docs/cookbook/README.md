# Cookbook

Recipe guides for common market-access workflows. Each recipe walks through
a complete scenario with prompts, commands, and expected outputs.

## Recipes

| Recipe | What it covers |
|---|---|
| [01: MiGeL application from scratch](01-migel-from-scratch.md) | Full Swiss device listing: pathway, tariff search, literature review, economic model, application, quality check |
| [02: Cross-jurisdiction comparison](02-cross-jurisdiction-comparison.md) | Compare CH, DE, FR, US pathways and tariff codes for the same product |
| [03: Economic modeling with PSA](03-economic-modeling-with-psa.md) | Build a Markov model, run baseline, add Monte Carlo PSA, export to Excel |
| [04: Literature review to HTA report](04-literature-review-to-report.md) | PRISMA review then EUnetHTA report chapter by chapter |
| [05: Tariff search and gap analysis](05-tariff-search-and-gap-analysis.md) | Search reimbursement lists, classify hits, decide bill vs. file |
| [06: Scenario comparison](06-scenario-comparison.md) | Run multiple model scenarios, compare results, export analysis |

## How to use these recipes

Each recipe assumes you have the skills pack installed and a Claude Code
session running. Copy the demo dossier to start, or create your own from
scratch.

```bash
cp -r examples/demo-dossier /tmp/my-dossier && cd /tmp/my-dossier
claude --model sonnet
```

Then follow the prompts in each recipe. The recipes show the expected
output so you can verify you are on track.

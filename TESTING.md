# Testing the HEOR Skills Pack

Four test layers, plus an optional LLM smoke test:

| Layer | What | Tests | How to run |
|---|---|---|---|
| Engine characterization | Model calculators, PSA, batch scenarios | 39 | `pnpm --filter @heor/engine test` |
| Skill scripts | prisma-counts, regulation-navigator, tariff-scout | 8 | `npx vitest run --config vitest.config.ts` |
| Data validation | Every JSON file under `data/` validated against its schema | 24 | `npx vitest run --config vitest.config.ts` |
| Reproducibility | Engine run on committed inputs must match committed output | 1 (CI) | CI workflow step |
| LLM smoke test | End-to-end skill pipeline in a Claude Code session | manual | See §5 |

## 1. Engine — no LLM required

```bash
cd heor-skills
pnpm install
pnpm --filter @heor/engine test      # 39 characterization tests
pnpm --filter @heor/engine typecheck

# Run each model CLI directly (prints JSON to stdout):
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/markov-chain.json
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/decision-tree.json
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/budget-impact.json
npx tsx packages/heor-engine/src/cli/run-psa.ts       packages/heor-engine/examples/psa-markov-chain.json
npx tsx packages/heor-engine/src/cli/run-scenarios.ts packages/heor-engine/examples/scenarios-decision-tree.json
```

PSA with the same `seed` must reproduce bit-identical output — rerun the `run-psa.ts` line twice and diff.

## 2. Skill scripts + data validation — no LLM required

```bash
# All 32 tests (skill scripts + data validation):
npx vitest run --config vitest.config.ts

# Or run just the skill scripts:
npx vitest run --config vitest.config.ts tests/skill-scripts.test.ts

# Or run just the data validation:
npx vitest run --config vitest.config.ts tests/data-validation.test.ts
```

The skill script tests run the actual CLI scripts (`prisma-counts.ts`, `evaluate.ts`, `search.ts`) against the demo dossier and bundled data, verifying they produce correct output without an LLM.

The data validation tests load every JSON file under `data/` and validate it against its corresponding schema in `tools/data-pipeline/schemas/`. This catches schema drift when new data versions are pulled.

## 3. Deterministic skill scripts (manual)

```bash
# Regulation navigator rule evaluation
npx tsx plugins/heor/skills/regulation-navigator/scripts/evaluate.ts \
  --jurisdiction ch --category digital-health --risk-class IIa --has-ai

# Tariff search over the bundled CH data
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts --query "tire-lait" --jurisdiction ch

# PRISMA counts from a dossier
npx tsx plugins/heor/skills/prisma-review/scripts/prisma-counts.ts examples/demo-dossier
```

## 4. CI

`.github/workflows/ci.yml` runs on every push and PR:

1. Install dependencies (`pnpm install --frozen-lockfile`)
2. Typecheck (`pnpm --filter @heor/engine typecheck`)
3. Engine tests (`pnpm --filter @heor/engine test`)
4. Full vitest suite (`npx vitest run --config vitest.config.ts`)
5. Demo dossier reproducibility (engine run on committed inputs must match committed output)

## 5. LLM smoke test — Claude Code plugin setup

From your local clone (or the GitHub repo — private works via your existing `gh`/git credentials):

```bash
# one-time, non-interactive:
claude plugin marketplace add /path/to/heor-skills     # or: AliakseiT/heor-skills
claude plugin install heor@heor-skills
claude plugin list                                      # verify: heor, enabled
```

Or inside a session: `/plugin marketplace add …`, `/plugin install heor@heor-skills`.

**Model**: run sessions with `claude --model sonnet`, or pin it in `~/.claude/settings.json` / a project `.claude/settings.json`:

```json
{ "model": "sonnet" }
```

Project-scoped auto-setup (e.g., in a test-dossier directory's `.claude/settings.json`) — no manual install steps for anyone opening that project:

```json
{
  "model": "sonnet",
  "extraKnownMarketplaces": {
    "heor-skills": { "source": { "source": "github", "repo": "AliakseiT/heor-skills" } }
  },
  "enabledPlugins": { "heor@heor-skills": true }
}
```

**MCP note**: the plugin wires the official PubMed connector (`https://pubmed.mcp.claude.com/mcp`) and the ClinicalTrials.gov server (runs via `npx`, no key). Claude Code will ask you to approve both on first use — that's expected.

## 6. Smoke-test walkthrough (demo dossier)

`examples/demo-dossier/` contains a fictional Class IIa CBT digital therapeutic (`SereniCBT`) targeting the Swiss dGA fast-track. Copy it somewhere writable and start a session in it:

```bash
cp -r examples/demo-dossier /tmp/serenicbt && cd /tmp/serenicbt
claude --model sonnet
```

Then walk the pipeline — each prompt should trigger the named skill (verify with the skill announcement; you can also force one with `/heor:<skill-name>`):

| # | Prompt | Skill exercised | Expect |
|---|---|---|---|
| 1 | "Which market-access pathway applies to this device in Switzerland?" | regulation-navigator | dGA MiGeL fast-track + AI warning, via `scripts/evaluate.ts` |
| 2 | "Are there existing Swiss reimbursement codes for digital CBT or similar?" | tariff-scout | ranked MiGeL/AL hits or a justified gap |
| 3 | "Run a systematic literature review for this dossier." | prisma-review | `prisma/pico.yaml` → queries → PubMed/CT.gov searches → screening with your review checkpoint → `prisma-diagram.md` |
| 4 | "Build a cost-effectiveness model and run it, then add a PSA." | economic-modeling | model choice rationale, `models/inputs/*.json` with per-parameter sources, engine CLI runs into `models/runs/` |
| 5 | "Draft the MiGeL application in German." | ch-migel-application | `applications/ch/migel/de.md`, no `{{...}}` left, expert-review disclaimer |
| 6 | "Quality-check the MiGeL draft." | hta-quality-check | BAG-rubric scores per module + consistency findings |

Pass criteria beyond "it ran": every economic number in drafts traces to a `models/runs/` file (the LLM must never compute results); PRISMA counts match `scripts/prisma-counts.ts` output; screening stopped for your review before finalizing.

## 7. Cross-harness spot-check (optional)

Copy one skill directory (e.g. `plugins/heor/skills/regulation-navigator`) into another harness's skills path (Codex: `.agents/skills/`) and confirm the core workflow still functions — the pack is designed harness-neutral.

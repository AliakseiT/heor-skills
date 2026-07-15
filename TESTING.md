# Testing the HEOR Skills Pack

Two layers to test: the **engine** (deterministic, no LLM involved) and the **skills** (need a Claude Code session with the plugin loaded).

## 1. Engine — no LLM required

```bash
cd heor-skills
pnpm install
pnpm -r test          # 39 characterization tests
pnpm -r typecheck

# Run each model CLI directly (prints JSON to stdout):
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/markov-chain.json
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/decision-tree.json
npx tsx packages/heor-engine/src/cli/run-model.ts     packages/heor-engine/examples/budget-impact.json
npx tsx packages/heor-engine/src/cli/run-psa.ts       packages/heor-engine/examples/psa-markov-chain.json
npx tsx packages/heor-engine/src/cli/run-scenarios.ts packages/heor-engine/examples/scenarios-decision-tree.json
```

PSA with the same `seed` must reproduce bit-identical output — rerun the `run-psa.ts` line twice and diff.

Deterministic skill scripts (also no LLM):

```bash
# Regulation navigator rule evaluation
npx tsx plugins/heor/skills/regulation-navigator/scripts/evaluate.ts \
  --jurisdiction ch --category digital-health --risk-class IIa --has-ai

# Tariff search over the bundled CH data
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts --query "tire-lait" --jurisdiction ch
```

## 2. Skills — Claude Code plugin setup

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

## 3. Smoke-test walkthrough (demo dossier)

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
| 5 | "Draft the MiGeL application in German." | ch-migel-application | `applications/ch/migel/de.md`, no `{{…}}` left, expert-review disclaimer |
| 6 | "Quality-check the MiGeL draft." | hta-quality-check | BAG-rubric scores per module + consistency findings |

Pass criteria beyond "it ran": every economic number in drafts traces to a `models/runs/` file (the LLM must never compute results); PRISMA counts match `scripts/prisma-counts.ts` output; screening stopped for your review before finalizing.

## 4. Cross-harness spot-check (optional)

Copy one skill directory (e.g. `plugins/heor/skills/regulation-navigator`) into another harness's skills path (Codex: `.agents/skills/`) and confirm the core workflow still functions — the pack is designed harness-neutral.

---
name: regulation-navigator
description: Map a medical device or digital-health product to its market-access / reimbursement pathway across CH, DE, FR, US, and UK. Use when the user asks "how do we get reimbursed / listed / covered", which regulatory pathway applies, what prerequisites/deliverables/timelines a launch needs, or wants to compare jurisdictions. Determines jurisdiction(s), category, and risk class, then evaluates a versioned ruleset (references/rules.json) deterministically via scripts/evaluate.ts.
metadata:
  jurisdiction: [ch, de, fr, us, uk]
  languages: [en]
  last-verified: 2025-12-10
  version: "1.0.0"
---

# Regulation Navigator

Determine the market-access pathway(s) for a device or digital-health product and present prerequisites, deliverables, timelines, and jurisdiction-specific warnings. The ruleset is pure data (`references/rules.json`) and is evaluated by a deterministic script, so results are reproducible — never hand-wave a pathway, always run `evaluate.ts`.

## Inputs

Gather three things (from the user's description or from a `dossier.yaml`):

1. **jurisdiction(s)** — one or more of `ch`, `de`, `fr`, `us`, `uk` (ISO 3166-1 alpha-2 lowercase). In a dossier these are `jurisdictions:`.
2. **category** — exactly one of:
   - `digital-health` — software as a medical device, DTx, apps, telemonitoring
   - `ivd` — in-vitro diagnostics, lab assays, biomarkers
   - `hardware` — physical medical devices
   - `procedure` — a method/service (not a product)

   In a dossier these are `intervention.categories:` (map any legacy `SOFTWARE→digital-health`, `DIAGNOSTIC→ivd`, `HARDWARE→hardware`, `PROCEDURE→procedure`).
3. **risk class** *(optional but recommended)* — `I`, `IIa`, `III`, or `NA` (procedures). In a dossier this is `intervention.deviceClass:` (e.g. `IIa`). Also note whether the product **uses AI/ML** (`hasAI`) — it changes warnings (notably the French White-Box requirement).

**If jurisdiction or category is ambiguous, ask** before evaluating — a wrong category selects the wrong pathway. Risk class and AI status only affect warnings, so you may proceed with a stated assumption and note it.

> How selection works: the base pathway is keyed **only** on (jurisdiction, category). Risk class and AI never change which pathway is selected — they only add reality-check warnings. Resolution is most-specific-first: exact (jurisdiction, category) → the jurisdiction's default pathway → a global "Strategic Assessment" fallback.

## Workflow

1. **Resolve inputs.** Read `dossier.yaml` if a dossier path was given; otherwise extract from the user's description. Confirm any ambiguous category/jurisdiction.
2. **Build the input JSON.** One object per (jurisdiction × the single category). Example:
   ```json
   [
     { "jurisdiction": "ch", "category": "digital-health", "riskClass": "IIa", "hasAI": true },
     { "jurisdiction": "de", "category": "digital-health", "riskClass": "IIa", "hasAI": true }
   ]
   ```
   An array evaluates several jurisdictions at once and adds a comparison block.
3. **Evaluate deterministically.** Run the script (never infer pathway content yourself):
   ```bash
   cd plugins/heor/skills/regulation-navigator
   echo '<input JSON>' | npx tsx scripts/evaluate.ts
   # or:  npx tsx scripts/evaluate.ts --input input.json
   # or:  npx tsx scripts/evaluate.ts --jurisdiction ch --category digital-health --riskClass IIa --hasAI
   # add --json for machine-readable output
   ```
4. **Present the result.** For each jurisdiction report:
   - **Pathway name, authority, status** (Fast-Track / Standard / Enterprise) and **timeline**.
   - **Key stopper** — the single criterion most likely to block market access.
   - **Prerequisites** (things that must already be true, e.g. CE mark) vs **deliverables** (what this workstream produces), grouped by section, with links.
   - **Expert insight, success rate, adoption barrier** where present.
   - **Reality-check warnings** and the **country insight** verbatim from the script.
   For multiple jurisdictions, add the fastest-vs-most-rigorous comparison the script prints and recommend a sequencing strategy.
5. **Point to the next skill.** If a listing/application pathway applies, link the matching application skill (e.g. `ch-migel-application` for a CH MiGeL listing, `ch-analysenliste-application` for a CH Analysenliste listing). Use `tariff-scout` first to check whether an existing reimbursement code already covers the product.

## Notes

- The ruleset covers **CH, DE, FR, US, UK**. (The repository README currently scopes this skill to CH·DE·FR·US; UK/NICE-EVA content is present in `rules.json` and evaluated — flag the README wording to a maintainer, do not drop UK.)
- `rules.json` carries `version` and `lastVerified` (`2025-12-10`). Regulatory pathways change; treat anything past the last-verified date as needing confirmation against the official authority (links are in each requirement).
- Amend rules only in `references/rules.json` (pure data). The enums for `sectionType`, `pathwayType`, `status`, etc. are documented under `taxonomy` in that file.

## Human review required

Pathway output is planning guidance, not regulatory advice. **End every response with an explicit note** that the market-access strategy must be confirmed with qualified regulatory/reimbursement professionals and the relevant authority before the company commits resources or submits anything.

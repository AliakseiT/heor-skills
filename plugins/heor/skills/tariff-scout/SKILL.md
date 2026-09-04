---
name: tariff-scout
description: Search official reimbursement lists (Swiss MiGeL and Analysenliste, German HMV and DiGA, French LPP, US HCPCS) for existing codes and analogous listed products. Use when the user asks "is there already a reimbursement code / tariff position for X", "what do comparable products bill under", "is our device already listed", or needs to decide between billing an existing code vs filing a new application. Runs deterministic lexical (non-embedding) search via scripts/search.ts over the normalized data in data/.
metadata:
  jurisdiction: [ch, de, fr, us]
  languages: [de, fr, it, en]
  last-verified: 2025-07-01
---

# Tariff Scout

Given an intervention or device description, find existing reimbursement codes and analogous listed products across the requested jurisdictions, then recommend whether to bill an existing code or file a new application.

Search is **lexical** — normalized multi-language token matching with a simple score, no embeddings (CONVENTIONS.md §2). It runs over the normalized JSON in `data/<jurisdiction>/<list>/<version>/`, produced by `tools/data-pipeline/`.

## Data availability

| Jurisdiction / list | Status |
|---|---|
| `ch/migel` (Mittel- und Gegenständeliste) | available (de, fr, it) |
| `ch/analysenliste` (List of Analyses) | available (de, fr, it) |
| `de/hmv` (Hilfsmittelverzeichnis) | available (de) |
| `de/diga` (DiGA-Verzeichnis) | available (de) |
| `fr/lpp` (Liste des Produits et Prestations) | available (fr) |
| `us/hcpcs` (HCPCS Level II) | available (en) |

Data is refreshed monthly by CI. If the user asks about a jurisdiction with no generated data, say so and offer to run the pipeline (`tools/data-pipeline/refresh.ts`).

## Workflow

1. **Extract search terms** from the intervention description: the device/analyte name, its function, synonyms, and the local-language term when known (Swiss lists are DE/FR/IT — an English query may not match; try the German or French term too).
2. **Run the search** for each relevant jurisdiction/list:
   ```bash
   cd plugins/heor/skills/tariff-scout
   npx tsx scripts/search.ts "<terms>" --jurisdiction ch --limit 10
   # narrow to one list:   --list ch/analysenliste
   # one language:         --lang de
   # machine-readable:     --json
   ```
   Run it a few times with different term variants (synonyms, local language) rather than one long query — short, specific queries score best.
3. **Interpret and classify** the hits into:
   - **Exact matches** — a listed code that already covers this exact product/analyte (high score, name clearly the same thing).
   - **Similar / analogous products** — listed items in the same category or clinical area (useful as pricing and precedent anchors).
   - **Gaps** — the function/analyte appears unlisted in a jurisdiction where comparators exist.
4. **Recommend**:
   - If an **exact code exists** → bill under it; report code, list, price/tariff, and any limitation.
   - If only **analogs exist** → a new application is likely needed; cite the closest analogs as precedent and hand off to the relevant application skill:
     - `ch/migel` → **`ch-migel-application`**
     - `ch/analysenliste` → **`ch-analysenliste-application`**
   - If **no data** for the jurisdiction → note the gap and that the list must be ingested first.
5. Present codes with their **price/tariff + currency + unit** and **limitations** (from the label files), and always cite the list and version so the user can verify.

## Bare-skill caveat (data pinning)

The normalized data **ships inside this repo** under `data/`. A bare skill copied into another harness must either carry that `data/` directory along or point `search.ts` at one:

- `--data-dir <path>` (highest priority), else
- env `HEOR_DATA_DIR`, else
- the repo-relative default `<repo>/data`.

Because the lists change (Swiss revisions ~twice a year), **pin a data release** (git tag `data-YYYY-MM-DD`) so results are reproducible; don't assume "latest". The script always reads the newest version directory present in whatever `data/` it is given, so what you pin is what you get.

## Human review required

Search results are a starting point, not a coding or reimbursement determination. **End every response** noting that code selection and any new-listing decision must be confirmed with a qualified reimbursement specialist against the current official list before billing or submission.

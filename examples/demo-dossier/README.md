# Demo Dossier: SereniCBT

A fully populated example dossier showing what every skill in the HEOR
skills pack produces. SereniCBT is a fictional Class IIa digital therapeutic
for mild-to-moderate depression, targeting the Swiss dGA fast-track.

Browse this directory to see what a completed market-access pipeline looks
like, end to end.

## What's here

| Path | Produced by | What it is |
|---|---|---|
| `dossier.yaml` | User | The manifest: intervention, comparator, jurisdictions |
| `documents/README.md` | User | Supporting documents (CE cert, IFU, study reports) |
| `prisma/pico.yaml` | prisma-review | PICO extracted from the dossier |
| `prisma/queries.yaml` | prisma-review | Tiered PubMed and ClinicalTrials.gov search queries |
| `prisma/search-results.json` | prisma-review | Deduplicated records from the database searches |
| `prisma/screening.json` | prisma-review | Include/exclude/maybe decisions per record |
| `prisma/included-studies.json` | prisma-review | Final included set with extracted data |
| `prisma/prisma-diagram.md` | prisma-review | PRISMA 2020 flow diagram (Mermaid + table) |
| `models/inputs/markov-chain.json` | economic-modeling | Engine-ready model inputs with per-parameter sources |
| `models/runs/2026-01-15-markov-chain.json` | economic-modeling | Engine output (deterministic run, computed by @heor/engine) |
| `chapters/05-literature-research.en.md` | prisma-review / eurhta-report | Literature review chapter |
| `applications/ch/migel/de.md` | ch-migel-application | Drafted MiGeL application form (German) |

## How to use this

Copy this directory somewhere writable, start a Claude Code session in it,
and walk through the skills. Or just read the files to understand the
expected output format and quality.

```bash
cp -r examples/demo-dossier /tmp/my-dossier && cd /tmp/my-dossier
claude --model sonnet
```

Then try prompts like:

- "Which market-access pathway applies to this device?"
- "Run a systematic literature review"
- "Build a cost-effectiveness model and run it"
- "Draft the MiGeL application in German"
- "Quality-check the draft"

The skills will read the existing files, update them, or fill gaps.

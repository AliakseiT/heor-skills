# prisma-review

Runs a PRISMA 2020 systematic literature review inside a dossier directory.
Six steps: PICO extraction, query generation, database search, abstract
screening, flow diagram, narrative synthesis.

## When to use

- "Run a systematic literature review"
- "Build the PRISMA diagram"
- "Search PubMed and ClinicalTrials.gov for evidence"
- "Screen abstracts against PICO criteria"

## What it produces

Files under `prisma/`: `pico.yaml`, `queries.yaml`, `search-results.json`,
`screening.json`, `included-studies.json`, `prisma-diagram.md`, and a
literature review chapter in `chapters/`.

## Key script

```bash
npx tsx scripts/prisma-counts.ts <dossier-dir>
```

Computes PRISMA 2020 flow-diagram counts from the stored JSON files.
Outputs a Mermaid diagram, a table, and JSON.

## MCP wiring

The plugin wires the official PubMed MCP connector and a
ClinicalTrials.gov MCP server. Fallback to NCBI E-utilities and the
ClinicalTrials.gov v2 REST API via curl when MCP is unavailable.

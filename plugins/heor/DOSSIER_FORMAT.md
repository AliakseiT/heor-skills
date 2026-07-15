# Dossier Directory Format (v1)

The shared working-state contract for all `heor` skills. A *dossier* is a plain directory (usually a git repo) — no database. Every skill reads and writes these paths; git history replaces version tracking.

```
<dossier>/
├── dossier.yaml                     # the manifest — see below
├── documents/                       # user-supplied sources (CER, IFU, device description, PDFs, …)
├── prisma/
│   ├── pico.yaml                    # population, intervention, comparison, outcomes (+ rationale)
│   ├── queries.yaml                 # per-database search strings (pubmed, clinicaltrials, …) + tier
│   ├── search-results.json          # {searches: [{database, query, tier, reportedCount}], duplicatesRemoved, records: [{id, source, title, abstract, year, authors, url, doi?, pmid?, nct?}]} (bare record array also tolerated)
│   ├── screening.json               # [{id, decision: include|exclude|maybe, reason, screenedBy}]
│   ├── included-studies.json        # final set with extraction fields
│   └── prisma-diagram.md            # PRISMA 2020 flow counts (mermaid + table)
├── chapters/                        # dossier text, one file per chapter
│   └── <nn>-<slug>.<lang>.md        # e.g. 03-clinical-effectiveness.en.md
├── models/
│   ├── inputs/<model>.json          # engine-ready parameter file (see heor-engine CLI docs)
│   └── runs/<date>-<model>[-psa|-scenario].json   # engine output, never hand-edited
└── applications/
    └── <jurisdiction>/<form>/<lang>.md   # e.g. ch/migel/de.md
```

## dossier.yaml

```yaml
version: 1
intervention:
  name: ...
  description: >-        # what it is, indication, mechanism, claimed benefit
  deviceClass: ...        # e.g. IIa
  categories: [digital-health]        # digital-health | ivd | hardware | procedure
jurisdictions: [ch, eu]   # ISO 3166 lowercase; region code eu allowed
languages: [en, de]       # output languages, BCP-47
comparator: ...           # standard of care description
notes: ...                # free-form global context / instructions carried into every skill
```

## Rules

1. Skills must tolerate missing files (a dossier may start as just `dossier.yaml`) and must never require a migration step — add fields, don't repurpose them.
2. JSON written by scripts (`models/runs/`, `search-results.json`) is machine-owned: regenerate, don't hand-edit. Markdown and YAML are human-owned: preserve manual edits when regenerating (write alongside or diff, never blind-overwrite).
3. All content is jurisdiction-first: an application form lives under its jurisdiction with language as the leaf (see CONVENTIONS.md).
4. Skills state at the end of any generated draft that expert review is required before submission.

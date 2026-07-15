# Safety

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch "Safety").

## Goal (from source)

Assess the safety profile of the technology.

## Instructions (from source)

- Report on adverse events and complications.
- Compare safety outcomes with the comparator.
- Discuss any specific safety concerns.

## Data sources

- `prisma/included-studies.json` — adverse-event data from included studies
  (cited by number).
- `documents/` — IFU warnings/contraindications, clinical study reports,
  post-market surveillance data supplied by the user.
- `dossier.yaml` — device class (risk class contextualizes the safety
  discussion).

## Quality bar

- Report frequencies/severities exactly as the sources state them; absence of
  reported events is "no adverse events reported [n]", never "safe".
- Cover device-specific concerns where applicable (use errors, data privacy
  for digital health, biocompatibility for hardware).
- If the evidence base contains no comparative safety data, say so explicitly.

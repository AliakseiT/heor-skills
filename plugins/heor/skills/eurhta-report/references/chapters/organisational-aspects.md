# Organisational Aspects

Source note: `src/ai/flows/generate-hta-chapter.ts` handled this chapter with
its generic branch (no chapter-specific rubric). Carried over verbatim:

> Generate the content for the "Organisational Aspects" chapter. When
> discussing evidence, you may refer to the "Literature Research" chapter for
> detailed publication lists. You can summarize key findings from relevant
> literature here if appropriate for this specific chapter.

## Domain guidance (extension beyond the source, aligned to EUnetHTA Core Model — Organisational aspects, ORG)

Address, where the dossier provides material:

- Changes to the care process: which steps, settings (inpatient/outpatient/
  home), and patient flows change when the technology is adopted.
- Staff implications: professions involved, training needs, changes in
  workload or task allocation.
- Infrastructure and equipment prerequisites (IT integration, space,
  connectivity for digital-health products).
- Cooperation and communication across providers/levels of care.
- Implementation and de-implementation: rollout effort, what current practice
  it replaces, transition management.
- Capacity/volume considerations consistent with the BIA target population
  (`models/inputs/bia.json` when present).

Use resource-use findings from included studies where they exist; otherwise
describe organisational requirements from the IFU/device documentation and
mark projections as assumptions.

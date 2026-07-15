# Technology Description

Source note: `src/ai/flows/generate-hta-chapter.ts` handled this chapter with
its generic branch (no chapter-specific rubric). Carried over verbatim:

> Generate the content for the "Technology Description" chapter. When
> discussing evidence, you may refer to the "Literature Research" chapter for
> detailed publication lists. You can summarize key findings from relevant
> literature here if appropriate for this specific chapter.

## Domain guidance (extension beyond the source, aligned to EUnetHTA Core Model — Description and technical characteristics of technology, TEC)

Cover, where the dossier provides material:

- What the technology is: name, class/type (from `dossier.yaml`
  `intervention.deviceClass` and `categories`), regulatory status
  (CE marking / MDR class) if documented.
- Mechanism of action / how it achieves its claimed benefit.
- Components, accessories, software versions; what is consumed per use.
- Intended use and claimed indications (from the IFU in `documents/`);
  intended user (professional, patient) and use environment.
- Training, infrastructure, and maintenance requirements.
- Differences from the comparator technology and from predecessor versions.
- Lifecycle/maturity of the technology.

Ground every specification in `documents/` (IFU, device description) — do not
guess technical parameters.

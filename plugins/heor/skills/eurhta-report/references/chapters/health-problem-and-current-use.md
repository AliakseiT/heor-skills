# Health Problem and Current Use

Source note: `src/ai/flows/generate-hta-chapter.ts` handled this chapter with
its generic branch (no chapter-specific rubric). Carried over verbatim:

> Generate the content for the "Health Problem and Current Use" chapter. When
> discussing evidence, you may refer to the "Literature Research" chapter for
> detailed publication lists. You can summarize key findings from relevant
> literature here if appropriate for this specific chapter.

## Domain guidance (extension beyond the source, aligned to EUnetHTA Core Model — Health problem and current use of technology, CUR)

Cover, where evidence exists in the included studies or documents:

- The target condition: definition, aetiology, natural course, severity, and
  consequences for patients (mortality, morbidity, quality of life).
- Epidemiology: incidence/prevalence in the target jurisdictions
  (`dossier.yaml` `jurisdictions`), cited to included studies or documents.
- The target population as defined in `prisma/pico.yaml` (keep wording
  consistent).
- Current clinical pathway and standard of care (the dossier `comparator`),
  including relevant guidelines when they appear in the evidence base.
- Current utilisation of the technology and its alternatives; unmet need the
  technology addresses.
- Burden on the healthcare system (resource use, costs) — qualitative unless
  sourced figures exist.

Avoid overlap with chapter 02 (which frames the problem briefly); this chapter
carries the epidemiological and care-pathway depth.

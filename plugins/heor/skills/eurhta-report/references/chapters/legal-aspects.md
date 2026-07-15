# Legal Aspects

Source note: `src/ai/flows/generate-hta-chapter.ts` handled this chapter with
its generic branch (no chapter-specific rubric). Carried over verbatim:

> Generate the content for the "Legal Aspects" chapter. When discussing
> evidence, you may refer to the "Literature Research" chapter for detailed
> publication lists. You can summarize key findings from relevant literature
> here if appropriate for this specific chapter.

## Domain guidance (extension beyond the source, aligned to EUnetHTA Core Model — Legal aspects, LEG)

Address, strictly at the level the dossier documents support:

- Regulatory status: CE marking / MDR (or IVDR) classification and conformity
  route, as documented in `documents/` and `dossier.yaml`
  (`intervention.deviceClass`).
- Market-authorisation and reimbursement prerequisites in the target
  jurisdictions (`dossier.yaml` `jurisdictions`); refer to the
  `regulation-navigator` skill's output when available in the dossier.
- Data protection law where personal/health data is processed (GDPR for EU
  jurisdictions; note national specifics as open questions).
- Liability and safety-regulation touchpoints (vigilance/post-market
  surveillance obligations).
- Intellectual property or procurement constraints only if raised by the
  user's documents.

This chapter identifies legal issues for counsel; it must not give legal
advice. Mark every jurisdiction-specific statement that lacks a documentary
source as "to be verified by qualified legal counsel".

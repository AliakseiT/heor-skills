# Abstract Screening

Ported from the HEOR Copilot app (`src/ai/tools/abstract-screener-tool.ts`).
Act as an expert systematic reviewer screening abstracts. Screen every unique
record in `prisma/search-results.json` against the confirmed PICO
(`prisma/pico.yaml`) and any user inclusion/exclusion criteria. Screening is
deterministic rule-following, not creative writing — apply the rules
consistently across all batches.

Decision vocabulary: the source app used `Include` / `Exclude` / `Uncertain`;
this dossier format writes them as `include` / `exclude` / `maybe`.

## Per-record procedure (carried over from source)

For each record, consider: record ID, title, abstract, the PICO summary
(`P: ...; I: ...; C: ...; O: ...`), additional inclusion/exclusion criteria,
and any supporting-document context. Then:

1. Carefully read the PICO, other criteria, the provided abstract, and any
   supporting documents.
2. Based *only* on the information in the provided abstract, PICO/criteria,
   and supporting documents, recommend `include` (for full-text review),
   `exclude`, or `maybe`.

### CRITICAL SCREENING RULES (SENSITIVITY OVER SPECIFICITY) — verbatim from source

> - **Prioritize INCLUDE**: If the Population and Intervention match the PICO
>   criteria, you MUST recommend 'Include', even if specific outcomes are not
>   fully detailed in the abstract (abstracts often omit details).
> - **Protocols & Pilots**: explicitly INCLUDE protocols, feasibility studies,
>   and pilot studies if the Population and Intervention match. Do not exclude
>   them just because they lack final results.
> - **When in Doubt, INCLUDE**: If you are unsure if a criterion is met
>   because the abstract is vague, recommend 'Include' (or 'Uncertain' as a
>   last resort). Checking the full text is cheaper than missing a relevant
>   study.
> - **Restrict UNCERTAIN**: Only use 'Uncertain' when there is a direct
>   collision/contradiction in the evidence that requires human judgment. Do
>   NOT use 'Uncertain' just because information is missing; assume it might
>   be there in the full text and 'Include'.

3. Provide a concise (1–2 sentence) justification that **specifically
   references elements of the PICO** and how the abstract relates to them.
   Examples from the source:
   - "Exclude: The abstract describes a pediatric population, while the PICO
     specifies adults."
   - "Include: Feasibility study matching the target intervention and
     population."

### Modelling-focus rules (apply strictly when the modelling-focus flag is set)

> - Include economic evaluations (cost-effectiveness, cost-utility, budget
>   impact), cost analyses, and parameter sources (utilities, costs, resource
>   use, transition probabilities, hazard/survival) if relevant to the PICO's
>   indication, even when comparators differ slightly.
> - Do NOT exclude solely due to a different brand or product name if the
>   intervention belongs to the same functional class as the PICO intervention
>   and serves the same intended use (e.g., another mobile health app or
>   wearable performing similar monitoring/management tasks). Prefer 'Include'
>   or 'Uncertain' rather than 'Exclude' in such cases.
> - When the abstract evaluates a similar intervention class and provides
>   model-relevant inputs (e.g., adherence, engagement, health utilization,
>   quality of life, costs), mark 'Include' (if reasonably aligned) or
>   'Uncertain' (if alignment cannot be confirmed), not 'Exclude'.
> - Broader appropriateness: Accept studies that inform inputs for the model
>   (e.g., resource utilization, adherence, utility weights), even if they
>   lack full clinical endpoints, provided they match the indication domain.

### Edge cases

- Missing or empty abstract → `maybe`, reason "abstract missing; full text
  required" (source behavior: Uncertain, never auto-exclude).
- `isMandatory: true` records → `include` unless there is a blatant PICO
  violation; if so, still `maybe` with the conflict explained — the user
  decides on mandatory records.

## Batching and scale

- Work in batches of ~20–25 abstracts; append decisions to
  `prisma/screening.json` after each batch.
- Restate the identical PICO + criteria block at the top of every batch.
- After the last batch, re-screen the first batch's `exclude` decisions once
  to catch calibration drift.
- **Optional, Claude-specific (skip on other harnesses):** for >100 records,
  fan out parallel subagents, one batch each, identical criteria block, each
  returning a JSON fragment; merge, then spot-check ~10% of each agent's
  decisions yourself before presenting to the user.

## Output: `prisma/screening.json` (one entry per unique record)

```json
[
  {
    "id": "38123456",
    "decision": "include",
    "reason": "Include: RCT in the target adult population comparing the intervention with standard of care.",
    "screenedBy": "ai"
  },
  {
    "id": "NCT01234567",
    "decision": "maybe",
    "reason": "Abstract missing; full text required.",
    "screenedBy": "ai"
  }
]
```

## Mandatory user-review checkpoint

Before the screening file is considered final:

1. Present a summary: include/exclude/maybe counts, the full list of `maybe`
   records with reasons, and a sample (~10) of `exclude` decisions.
2. Ask the user to resolve every `maybe` and to veto/confirm the rest.
3. Write user overrides with `"screenedBy": "human"` (keep the AI reason,
   append the human rationale).
4. Only then proceed to the PRISMA diagram. `scripts/prisma-counts.ts` warns
   if `maybe` or unscreened records remain.

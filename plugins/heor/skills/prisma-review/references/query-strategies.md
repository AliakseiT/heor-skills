# Search Query Generation

Ported from the HEOR Copilot app (`src/ai/flows/propose-search-queries-flow.ts`).
Act as an expert medical information specialist with deep knowledge of
PRISMA-S-compliant search strategies. Generate systematically constructed
queries for PubMed and ClinicalTrials.gov from the confirmed
`prisma/pico.yaml` plus any user inclusion/exclusion criteria.

## Search focus by assessment objective

Default — EUnetHTA Core Model assessment:

> Your search queries must prioritize finding literature to support Health
> Technology Assessment:
> - **Cost-Effectiveness Analysis (CEA)**: Studies with clinical effectiveness
>   data, utility values, cost data, model parameters, comparative
>   effectiveness
> - **Budget Impact Analysis (BIA)**: Market penetration data, population
>   studies, resource utilization, economic impact assessments
> - **Model Development**: Parameter values, transition probabilities,
>   survival data, quality of life measures
>
> Emphasize study types: RCTs, economic evaluations, modeling studies,
> systematic reviews, real-world evidence, registry studies, HTA reports.
> PRECISION STRATEGY: Start with narrow, focused queries. Only broaden if
> insufficient results.

Modelling focus (when flagged): include comprehensive economic modeling terms
(utilities, EQ-5D, ICER, QALY/QALYs, cost-utility, budget impact,
Markov/decision tree/partitioned survival, transition probability, hazard
ratio/survival, discounting, time horizon); expand Intervention to include
class/similar interventions (generic names, device class) if the description
is brand-specific. Economic/budgetary keywords are introduced as **optional OR
clauses or in broader tiers, never as mandatory AND clauses**.

MiGeL variant (Swiss WZW assessment): prioritize Wirksamkeit (clinical
trials, effectiveness studies, efficacy data), Zweckmäßigkeit (medical
necessity, indication-specific benefit, appropriate-use guidelines), and
Wirtschaftlichkeit (health economic evaluations, cost analyses, budget impact,
cost comparison). Emphasize RCTs, effectiveness studies, economic evaluations,
systematic reviews, HTA reports, real-world evidence. Keep the core clinical
device/accessory terms mandatory and economic language optional. Use the
`wzwOutcomes` keyword lists from `pico.yaml` when present.

## PubMed strategy (carried over from source)

1. Identify concept blocks for P, I, C (and optionally O) with:
   - Exploded MeSH terms: `"term"[Mesh]`
   - Free-text keywords in title/abstract: `"term"[tiab]` (include variants,
     synonyms, European brand names where applicable)
2. Assemble three tiers with a PRECISION-FIRST strategy:
   - **narrow**: START HERE with a concise query. Use exact phrases, `[tiab]`,
     and key MeSH. Combine Population + Intervention, but keep additional
     domains (usability, safety, economic) as **optional OR paragraphs**. Do
     **not** require every concept with AND.
   - **balanced**: ONLY if narrow yields <20 results. Add moderate synonyms
     while keeping the clinical core mandatory. Optional domains remain
     optional OR blocks.
   - **broad**: ONLY if balanced yields <10 results. Add more synonyms; you
     may drop outcome blocks if necessary. Under modelling focus, introduce
     economic/budgetary keywords here if not already present — as OR
     expansions or separate optional blocks, never mandatory.
3. Provide an RCT/economic hedge as a **separate component** (not embedded in
   the core query). Use PubMed `[pt]`, `[sh]`, and `[tiab]` fields
   appropriately (e.g.
   `randomized controlled trial[pt] OR randomized[tiab] OR placebo[tiab]`).

## ClinicalTrials.gov strategy (carried over from source)

1. Map PICO to fields:
   - Population → `AREA[Condition]`
   - Intervention/Comparator → `AREA[InterventionName]`,
     `AREA[ArmGroupLabel]`, `AREA[Keyword]`
   - Outcomes (only if necessary to narrow) → `AREA[OutcomeMeasure]` or
     `AREA[BriefSummary]`

   Example: `(AREA[Condition] Hypertension) AND (AREA[InterventionName]
   Lisinopril OR AREA[InterventionName] Enalapril)`
2. Assemble three tiers, precision-first:
   - **narrow**: START HERE — combine Population + Intervention with only the
     minimum outcomes necessary. Economic/usability keywords must be optional
     (OR) or omitted. Use simplified terms (e.g., "Diabetes" instead of
     "Type 2 Diabetes Mellitus") if results are sparse.
   - **balanced**: ONLY if narrow yields <10 results. Add moderate synonyms
     but keep the clinical technology terms compulsory; optional clauses
     remain optional.
   - **broad**: ONLY if balanced yields <5 results. Add more synonyms; you may
     omit outcome clauses entirely if needed. Under modelling focus, add
     economic evaluation/model parameter keywords as optional OR blocks; never
     force them with AND.

Note: the "<20 / <10 / <5" figures above are the *query-design* heuristics
from the source prompt; the *runtime* escalation thresholds used during
execution are in `search-execution.md` (they differ deliberately: design
broad-enough tiers, escalate conservatively).

## Output: `prisma/queries.yaml`

```yaml
generated: 2026-07-15        # date of generation
pubmed:
  default: >-                # = the narrow (high-precision) query
  tiers:
    - tier: narrow
      query: >-
      note: ...
    - tier: balanced
      query: >-
      note: ...
    - tier: broad
      query: >-
      note: ...
  rctHedge: >-               # separate validated hedge string
clinicaltrials:
  default: >-                # = the narrow query
  tiers:
    - tier: narrow
      query: >-
      note: ...
    - tier: balanced
      query: >-
      note: ...
    - tier: broad
      query: >-
      note: ...
criteria:
  inclusion: >-              # user-provided, if any
  exclusion: >-
```

`queries.yaml` is human-owned — preserve user edits. Present the tiers to the
user for confirmation before executing the search.

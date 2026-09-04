# Parameter Population and Source Tracking

Faithful port of the HEOR Copilot populate-inputs prompts
(`src/ai/flows/populate-model-inputs-flow.ts` plus the six model-specific
`populate-*-inputs-flow.ts` files). Act as an expert HEOR researcher tasked
with finding plausible values for model inputs from the dossier's evidence
and established economic sources.

Apply the dossier's global context (`dossier.yaml` `notes`, e.g. "ensure all
costs are in CHF") to every value — if CHF is specified, all cost values are
in CHF.

## Source priority ladder

For each empty parameter, work down this ladder and stop at the first source
that yields a defensible value:

1. **Expert-provided inputs** (values the user stated in conversation or in
   an expert-inputs note) — highest priority; never overridden by literature.
2. **Expert-uploaded documents** (`documents/`) — search thoroughly,
   including tables, figures, and appendices.
3. **Literature full texts** (retrieved full texts of
   `prisma/included-studies.json` entries) — a primary source; search
   tables with economic data, results sections with specific numeric values,
   methods sections describing populations/costs/resource use, discussion
   sections citing benchmarks, and supplementary materials. If the exact
   parameter is absent, look for related parameters the value can be derived
   from (state the derivation in the source rationale).
4. **Related model inputs** — if a companion model exists in
   `models/inputs/` (e.g. populating BIA when a CEA is already populated),
   any parameter with the **exact same name** MUST take the identical value.
   Use the related model's *results* as context (e.g. to inform budget
   impact), never as parameter values.
5. **Literature abstracts** (included studies without full text).
6. **User-provided references** (PMIDs/DOIs/titles the user listed) —
   a starting point, not a limit.
7. **Broader targeted search** of general knowledge: scientific literature,
   standard cost databases, utility catalogs (EQ-5D/SF-6D population norms),
   and HTA reports for similar interventions. Values from here get
   `confidence: low` or `medium` and an honest `extractionMethod`.
8. **Device-class defaults** (engine `src/economic-model-defaults.ts`,
   classes: `digital-therapy`, `monitoring-device`, `therapeutic-device`,
   `software-as-medical-device`, `diagnostic-device`) — **last resort only**.
   Every defaulted parameter is flagged: source
   `"Device-class default (<class>): <defaults-library source text>"`,
   `confidence: low`, and it must be called out in the summary shown to the
   user.

If no rung yields a defensible value, leave the parameter empty and report
the gap — do not invent a number. Exception: if the user explicitly allowed
ungrounded values ("allowUngrounded"), you may supply a plausible value with
the source recorded as an assumption plus rationale, keeping the parameter
set internally consistent (probabilities sum correctly, units align).

Rules that always apply:

- **Numbers only.** Numeric parameters get bare numbers ("150", not
  "150 CHF"); the currency/unit lives in the global context and narration.
  The only string parameter is the BIA "Target Market" (a country/region
  name such as "Switzerland" — never a number).
- **Preserve existing concrete values.** Never overwrite a value the user or
  a previous session already set, unless the user asks or it is clearly
  inconsistent (then raise it, don't silently change it).
- **Model-type separation.** CEA files contain only clinical/economic
  parameters; the BIA file contains only population/market parameters.
  Never mix (see catalogs below).

## Per-model parameter catalogs

Populate only the parameters belonging to the chosen model. Canonical
human-readable names below; the engine-file key spelling per model is in
`input-format.md`.

### Decision Tree (from populate-decision-tree-inputs-flow)

Allowed: Cost of Intervention Test; Sensitivity of Intervention Test;
Specificity of Intervention Test; Cost of Comparator Test; Sensitivity of
Comparator Test; Specificity of Comparator Test; Prevalence of
Disease/Condition; Cost of Treatment (Correct Positive); Utility of
Treatment (Correct Positive); Cost of False Positive Management; Utility of
False Positive State; Cost of False Negative Consequence; Utility of False
Negative State; Cost of Correct Negative Management; Utility of Correct
Negative State.

Forbidden (leave out): any market/population parameter (Target Market,
Target Population Size, Market Share Year X, Annual Cost per Patient, BIA
horizon), transition probabilities, health-state costs/utilities, drug
acquisition/administration/monitoring costs.

Search strategies: sensitivity/specificity/PPV/NPV in diagnostic accuracy
studies (ROC tables); testing/treatment/management costs in economic
evaluations; utilities in QoL/EQ-5D sections; prevalence in epidemiological
studies or baseline-characteristics tables. All probabilities and utilities
in [0, 1].

### Markov Chain (from populate-markov-chain-inputs-flow)

Allowed: Prob Healthy to Healthy; Prob Healthy to Disease; Prob Healthy to
Dead; Prob Disease to Healthy; Prob Disease to Disease; Prob Disease to
Dead; Cost Healthy State; Cost Disease State; Cost Dead State; Utility
Healthy State; Utility Disease State; Utility Dead State; Number of Cycles;
Annual Discount Rate; Initial Cohort % Healthy; Initial Cohort % Disease.
These sixteen names are exact and mandatory.

Forbidden: all BIA parameters, test characteristics, false
positive/negative parameters.

**Transition-probability consistency (critical, from the source prompt):**

- For each living state the outgoing probabilities MUST sum to exactly 1.0
  (`P(H→H) + P(H→D) + P(H→Dead) = 1.0`, same for Disease).
- Populate each state's transitions **holistically**: find all transitions
  out of a state together, from the same source where possible. If
  literature values don't sum to 1.0 due to rounding, make slight,
  justifiable adjustments (documented in the rationale), prioritizing the
  most confidently sourced values.
- **All-or-none per state:** if you cannot find a consistent complete set
  for a state after diligent research, leave ALL transitions from that state
  empty and report the gap — never populate one or two of three.
- Initial cohort percentages are on the 0–100 scale and should sum to 100.

Search strategies: progression/survival rates and hazard ratios in
longitudinal studies (convert hazard rates to per-cycle probabilities and
document the conversion); state costs in economic evaluations; utilities in
EQ-5D/preference-weight studies; cycles/discount rate in model-based
evaluations (discount rate is a decimal, e.g. 0.03).

### Budget Impact Assessment (from populate-bia-inputs-flow)

Allowed: Target Market (e.g., Country Name) — **critical, string**; Target
Population Size (Total Eligible); Intervention Market Share Year 1–3 (%)
(Years 4–5 optional); Comparator Market Share Year 1–3 (%) (Years 4–5
optional); Annual Cost of Intervention per Patient; Annual Cost of
Comparator per Patient; Annual Cost of Other Treatment per Patient
(optional); Number of Years for BIA Assessment (1–5).

Forbidden: every CEA parameter (transition probabilities, state
costs/utilities, test characteristics, prevalence/incidence, discount rate,
cycles).

BIA-specific rules (verbatim intent from the source prompt):

- **Target Market first.** All other values — population size, costs — MUST
  be relevant to that specific market.
- **Market-share constraint:** Intervention + Comparator market share for
  any given year MUST equal exactly 100%. If you estimate one, compute the
  other as (100 − first) and say so in the rationale.
- **Interdependencies:** eligible population is often derived from total
  population × prevalence × diagnosis rate — when you find one value,
  check the others for consistency.
- **Country-specific data:** for costs and epidemiology, prioritize
  official country-specific sources (national HTA bodies, statistics
  offices, country-focused publications). If unavailable, use a similar
  market and note the source region explicitly.
- Market shares are percentages on the 0–100 scale; horizon is 1–5 years
  (the engine reuses year-3 shares beyond year 3).

### Partitioned Survival Model (from populate-partitioned-survival-inputs-flow)

Allowed: survival-curve parameters (e.g. Weibull scale/shape from OS/PFS
curves), Cost per Cycle (Pre-progression), Cost per Cycle
(Post-progression), Utility (Pre-progression), Utility (Post-progression),
Number of Cycles, Annual Discount Rate.

Search strategies: Kaplan–Meier curves, hazard ratios, and time-to-event
data in trials; state-specific costs and resource use; utilities by
progression state. Forbidden: BIA parameters, test characteristics, simple
three-state Markov parameters.

The engine uses a Weibull survival curve: `survivalCurveParam1` = scale (λ),
`survivalCurveParam2` = shape (k). Extract these from Kaplan–Meier data
(e.g. via Weibull regression or parametric fitting).

### State Transition Model (from populate-state-transition-model-inputs-flow)

Allowed: the full transition probability matrix (each row summing to 1.0,
absorbing states with self-probability 1), initial state distribution
(fractions summing to 1.0), per-state costs, per-state utilities, number of
cycles, discount rate. Document what each state index means in the
`sources`/notes.

Search strategies: disease stages/state definitions, transition matrices and
progression probabilities in longitudinal studies, state costs and
utilities by stage. Forbidden: BIA and diagnostic-test parameters.

### Discrete Event Simulation (from populate-discrete-event-simulation-inputs-flow)

Allowed: event rates (Event Rate Alpha), resource costs (Resource Cost
Beta), Patient Arrival Rate, Queue Capacity, Simulation Duration.

Search strategies: clinical event frequencies and complication rates;
capacity/utilization studies; waiting/service times in healthcare-system
analyses; patient-flow and pathway costs. Forbidden: BIA, test, Markov, and
partitioned-survival parameters.

**Stub warning:** the engine's DES calculator is a deterministic
volume approximation; disclose this.

## Systematic value-extraction strategies (all models)

From the source prompt — where to look inside papers:

- **Costs:** Methods sections (cost components, resource utilization);
  economic-evaluation tables (often Table 2/3); Results (total/mean costs,
  breakdowns); currency symbols ($, €, £, CHF) followed by numbers.
- **Probabilities/rates:** Results sections (percentages, proportions);
  transition matrices in Markov studies; survival tables; hazard ratios
  (convert to probabilities, documenting the method).
- **Utilities:** "EQ-5D", "SF-6D", "utility", "QALY", "quality-adjusted";
  utility tables; preference weights and health-state values.
- **Population/demographics:** Methods population descriptions; Table 1
  (baseline characteristics); epidemiology in introductions.
- **BIA parameters:** market share/adoption/penetration data; national
  statistics and registries; treatment and healthcare cost studies; existing
  budget-impact analyses and HTA reports.

## Mandatory source tracking (`sources` block)

Every populated parameter gets an entry in the `sources` object of
`models/inputs/<model>.json` (schema ported from the app's
`ParameterSourceSchema`):

```json
"sources": {
  "<parameter name exactly as in inputs>": {
    "value": 1250,
    "primarySource": "Smith et al. (2022) - Cost-effectiveness of new diagnostic device",
    "pmid": "12345678",
    "doi": "10.1000/j.health.2022.01",
    "location": "Table 3, Cost Analysis section",
    "directQuote": "The mean cost per patient for the intervention was $1,250 (SD: $320)",
    "confidence": "high",
    "extractionMethod": "table",
    "supportingContext": "Cost includes device purchase and administration in hospital setting",
    "verificationStatus": "verified"
  }
}
```

Required per parameter: `primarySource` (full citation, document filename,
"Device-class default (<class>): …", or "Assumption based on <rationale>"),
`location` (exact place — "Table 2, p. 8", "Figure 1, panel B", "Results
section, paragraph 3" — mandatory whenever the value came from a document or
paper), `confidence` (`high`/`medium`/`low`, based on source quality and
relevance), and `extractionMethod` (`table` / `text` / `figure` /
`calculation` / `website` / `assumption` / `default`). Recommended:
`directQuote`, `supportingContext`, `pmid`/`doi`, `verificationStatus`
(`verified` / `pending` / `unverified` / `inferred` / `estimated`). A plain
string value is tolerated for legacy files but never write one — always emit
the structured object.

For values from PRISMA literature, cite as "Author et al. (Year) - Title"
and carry the `pmid`/`doi` from `prisma/included-studies.json` so downstream
chapters can cross-reference the Literature Research chapter.

## Building PSA parameter ranges

When preparing the `psa.parameterRanges` block (step 4 of the workflow),
derive uncertainty the same way as values:

1. Reported uncertainty from the sourced study (95% CI, SD, IQR) →
   `normal`/`lognormal` with the reported `mean`/`stdDev`, `min`/`max` from
   the CI (the engine clamps samples to [min, max]).
2. A defensible mode with soft bounds → `triangular` with `mode`.
3. Device-class default ranges from the engine defaults library → copy them
   and flag as defaults.
4. Last resort, with user agreement → `uniform` over ±20–25% of the
   baseline, recorded as an assumption.

Do not vary structurally fixed parameters (Number of Cycles, discount rate
mandated by the jurisdiction, horizon) — list them in `fixedParameters`
instead. Costs are commonly `lognormal` (non-negative, right-skewed);
probabilities and utilities `normal` clamped or `triangular` within [0, 1].
For Markov transition probabilities the PSA engine re-normalizes each
state's sampled outgoing probabilities to sum to 1.0 after every draw
(parameters listed in `fixedParameters` keep their baseline value and the
variable ones are scaled to fill the remainder) — so it is safe to give
ranges to some but not all transitions of a state.

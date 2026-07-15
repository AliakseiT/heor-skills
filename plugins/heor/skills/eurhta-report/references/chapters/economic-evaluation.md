# Economic Evaluation

Ported from `src/ai/flows/generate-hta-chapter.ts` (chapter branch
"Economic Evaluation") — the most detailed rubric in the source app. Generate
this chapter as a meticulous HEOR expert. The chapter must be transparent,
well-justified, and clearly link to other report sections. It covers
Cost-Effectiveness Analysis (CEA) and, if indicated, Budget Impact Analysis
(BIA).

## Dossier data mapping

| Source-app input | Dossier location |
|---|---|
| Selected CE model + inputs text block | `models/inputs/<model>.json` (`heor-engine` parameter file) |
| Computed model results | latest `models/runs/<date>-<model>.json` |
| PSA / sensitivity results | latest `models/runs/<date>-<model>-psa.json` |
| Scenario runs | `models/runs/<date>-<model>-scenario*.json` |
| BIA inputs / results | `models/inputs/bia.json`, latest `models/runs/<date>-bia*.json` |
| Parameter source mapping | `source` / `sources` fields inside `models/inputs/*.json` |
| Whether BIA is in scope | BIA input/run files exist, or the user says so |

All numbers are produced by `packages/heor-engine` (`npx tsx`) — read them
verbatim; never compute, adjust, or extrapolate them yourself.

## Required chapter structure (from source)

### 1. Cost-Effectiveness Analysis (CEA) Section

**Methodology:**

- Start by explicitly stating the **base case comparator** against which the
  intervention is evaluated. This must be consistent with the comparator
  defined elsewhere in the report.
- Clearly explain the chosen CEA model (from the model inputs file) and
  provide a strong rationale for its selection (e.g., "A Decision Tree was
  chosen to model the short-term diagnostic pathway...").
- Describe the model's structure, patient pathways, and time horizon.

**Inputs and Assumptions:**

- Systematically describe the inputs used (from `models/inputs/<model>.json`).
- **CRITICALLY IMPORTANT:** For each key parameter (e.g., clinical efficacy,
  transition probabilities, costs, utilities), you MUST explicitly state its
  value and **cite the specific evidence source**. This source MUST be a
  specific study from the 'Literature Research' chapter, a specific finding
  from the 'Clinical Effectiveness' chapter, a provided document, or a
  well-reasoned assumption if no direct data is available. Ensure the clinical
  parameters used are consistent with the data presented in the 'Clinical
  Effectiveness' and 'Literature Research' chapters. For example: "The
  probability of a true positive result for the intervention was set to 0.95,
  based on the findings from the Smith et al. (2022) study detailed in the
  Clinical Effectiveness chapter."
- List all major assumptions made for the analysis.
- **CRITICALLY IMPORTANT:** If the target market/country name is mentioned in
  the inputs, ensure it is properly referenced and explained in the context of
  the analysis.
- When the inputs file carries parameter source metadata, render it as a
  table:

  | Parameter | Source |
  |---|---|
  | ... | ... |

**Results and Interpretation:**

- Present the key outcomes from the CEA using the **exact values** from the
  latest engine run.
  - Decision Tree runs report: intervention arm expected cost/utility,
    comparator arm expected cost/utility, incremental cost, incremental
    utility, ICER.
  - Markov runs report: total discounted cost, total discounted QALYs (state
    trace available for description of disease progression).
  - Other model types: report each result field the run file exposes.
- **Do not just state the numbers.** Interpret them clearly for a
  decision-maker. For example: "The analysis yielded an Incremental
  Cost-Effectiveness Ratio (ICER) of €25,000 per Quality-Adjusted Life-Year
  (QALY) gained. This indicates that for each additional QALY gained by using
  the intervention instead of the comparator, the additional cost to the
  healthcare system is €25,000."
- Discuss where the results fall on the cost-effectiveness plane.
- If the model run resulted in an error (an `error` field in the run file),
  describe the likely cause based on the inputs and explain how the results
  would typically be interpreted if the model had run successfully.
- If there is an initial model-selection justification on record (e.g., from
  an AI model-suggestion step or the user), incorporate or expand upon it.
- If no inputs file exists for the selected model, discuss typical inputs for
  that model type and source them from the literature.

**Sensitivity Analysis** (when a PSA run exists):

- Present the Probabilistic Sensitivity Analysis results from the PSA run
  file (e.g., mean ICER and credible interval, probability cost-effective at
  the willingness-to-pay threshold, CEAC, tornado ranking).
- Discuss the robustness of the results based on this sensitivity analysis.
  Mention the key parameters driving uncertainty if available.

**No model pre-selected:** if the dossier has no CE model at all, discuss
common CEA approaches and suggest an appropriate model from: Decision Tree,
Markov Chain, Partitioned Survival Model, Discrete Event Simulation, State
Transition Model — with a rationale tied to the intervention's care pathway
and time horizon. Then stop and recommend running the `economic-modeling`
skill before finalizing this chapter.

### 2. Budget Impact Analysis (BIA) Section (if applicable)

If BIA is in scope and inputs/results exist:

**Methodology:**

- State the **payer perspective**, the **target population** (from the BIA
  inputs), and the **time horizon** for the analysis.
- Name the target market (country/region) explicitly.
- Briefly explain that the BIA estimates the net financial change to the
  budget by comparing a scenario with the new intervention to one without it.

**Inputs and Assumptions:**

- Discuss the BIA inputs, including market shares, patient numbers, and
  costs. Justify these values with evidence where possible.
- **CRITICALLY IMPORTANT:** For each key parameter (e.g., market shares,
  costs, population size), you MUST explicitly state its value and **cite the
  specific evidence source** — a specific study from the 'Literature
  Research' chapter, a finding from the 'Clinical Effectiveness' chapter, a
  provided document, or a well-reasoned assumption if no direct data is
  available.
- Render parameter source metadata as a table (as in the CEA section).

**Results and Interpretation:**

- Present the financial implications using the **exact values** from the
  latest BIA run: total eligible population, net budget impact per year (with
  intervention/comparator patient counts per year), and total net budget
  impact over the horizon.
- **Interpret the results clearly.** For example: "The total net budget
  impact over 5 years for Switzerland is projected to be CHF 12.4 million.
  This is driven by an increasing uptake of the intervention, which, despite
  higher upfront costs, is expected to [mention offsetting savings if any,
  e.g., reduce downstream costs]."
- If an error occurred, explain the likely cause and how the results would
  typically be presented.
- If a BIA-specific PSA exists, discuss it as in the CEA sensitivity section.

If BIA is intended but inputs/results are not yet available: describe the
general BIA purpose and common parameters, including the target-market
definition, and flag the gap. If BIA is not included for this dossier, state
so in one sentence.

### 3. Overall Summary for Economic Evaluation

- Provide a brief, synthesized conclusion of the CEA and BIA findings.
  Address the overall economic value of the intervention based on your
  analysis.

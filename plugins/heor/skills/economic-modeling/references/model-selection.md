# Model Selection

Ported from `src/ai/flows/suggest-ce-model-flow.ts` (HEOR Copilot). Act as an
expert HEOR analyst specializing in cost-effectiveness modeling: analyze the
intervention description, supporting documents, and included studies, then
select the **single most appropriate** cost-effectiveness model and justify
it in 2–3 sentences. The justification must explicitly tie the model choice
to the intervention's characteristics — care pathway, disease course, and
time horizon — not to generic model descriptions.

## Candidate models

The cost-effectiveness model is chosen from exactly this list (the app's
`COST_EFFECTIVENESS_MODELS`):

- Decision Tree
- Markov Chain
- Partitioned Survival Model
- Discrete Event Simulation
- State Transition Model

Budget Impact Assessment is **not** a CEA alternative — it answers a
different question (net financial impact on a payer's budget) and is added
*alongside* a CEA whenever the dossier targets reimbursement or the user asks
about affordability, market uptake, or payer budget.

## When to choose which

Decision guidance distilled from the source app's per-model flows and
device-class defaults library:

| Model | Choose when | Typical interventions |
|---|---|---|
| **Decision Tree** | Short-term, one-shot pathway with discrete branches and no recurring states: a test/screening decision leading to true/false positive/negative outcomes, each with a terminal cost and utility. No discounting needed (single episode). | Diagnostic and screening applications, digital health diagnostics, triage tools |
| **Markov Chain** | Chronic or recurrent disease modeled as a small set of health states (engine: Healthy / Disease / Dead) with per-cycle transition probabilities, state costs and utilities, discounting over many cycles. | Chronic disease management, continuous monitoring devices, long-term therapy |
| **Partitioned Survival Model** | Outcomes are driven by survival curves (OS/PFS) rather than transition probabilities — patients are partitioned into pre-/post-progression by curves over time. | Oncology and other treatment interventions with trial time-to-event data |
| **Discrete Event Simulation** | Patient-level flow through a system matters: arrival rates, queues, capacity constraints, resource utilization, waiting times. | Care-pathway/capacity questions, service redesign, throughput-limited services |
| **State Transition Model** | A Markov-style cohort model with an **arbitrary** number of states and a full transition matrix — when three fixed states are too restrictive. | Multi-stage disease progression (e.g. staged fibrosis, NYHA classes) |

Device-class heuristics (the engine's defaults library pairs each class with
a model): `digital-therapy` and `diagnostic-device` → Decision Tree;
`monitoring-device` → Markov Chain; `therapeutic-device` → Partitioned
Survival Model; `software-as-medical-device` → Budget Impact Assessment.
Use the dossier's `deviceClass`/`categories` as a starting hint, never as a
substitute for the pathway/time-horizon justification.

## Engine support tiers (must be disclosed at selection time)

| Model (slug) | Calculator | PSA |
|---|---|---|
| `decision-tree` | full | yes |
| `markov-chain` | full | yes |
| `budget-impact` | full | yes |
| `state-transition` | **stub** (vector × matrix propagation only) | no |
| `partitioned-survival` | **stub** (50/50 pre/post split; survival-curve params accepted but unused) | no |
| `discrete-event-simulation` | **stub** (deterministic volume approximation) | no |

When two models are scientifically defensible and one is fully implemented,
prefer the fully implemented one and say why. If a stub model is clearly the
right science (e.g. oncology with real survival curves), still recommend it
— but warn the user explicitly that the engine's calculator is a stub, the
numbers are structural placeholders, and PSA is unavailable; offer a fully
supported model as a pragmatic alternative.

## Output of this step

1. **Suggested model** — one entry from the candidate list (plus optional
   "add a Budget Impact Assessment" recommendation).
2. **Justification** — 2–3 sentences tied to the intervention.
3. **Input template** — the full parameter list for the chosen model with
   empty values (each parameter name on its own line followed by a colon and
   nothing else; no placeholders). Use **exactly** the canonical parameter
   names from `input-format.md` — for Markov Chain the sixteen names are
   mandatory and must all appear. This template is what step 2 (parameter
   population) fills in.

Wait for the user to confirm or override the model choice before populating.

# Recipe 07: Early-stage market access when no reimbursement code exists

Assess reimbursement pathways and prepare the required health economic
justification for novel SaMD and medical devices when existing tariff lists
have no matching code.

## Scenario

You are building a novel Software as a Medical Device (SaMD), digital health
application, or breakthrough technology. A search in official reimbursement
databases (MiGeL, Analysenliste, EBM, OPS, LPPR, HCPCS) returns **no exact match**.

You need to evaluate your market access options as early as possible — ideally
during product design or clinical trial planning — and prepare the quantitative
evidence required to create a new reimbursement position or qualify for early access.

## Prerequisites

- A product concept or draft `dossier.yaml` with your intended use, target
  indication, and planned clinical comparator (standard of care).
- Claude Code with the `heor` plugin loaded or access to the skills pack.

---

## Steps

### 1. Confirm the gap and search for pricing anchors

Before concluding that no code exists, run systematic searches across the
target jurisdiction's tariff lists using broad functional terms, clinical
indications, and local-language keywords.

```bash
# Search Swiss medical devices (MiGeL) in German
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "Cognitive Behavioral Therapy" --jurisdiction ch --list ch/migel --lang de

# Search German digital health directory (DiGA)
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "Depression" --jurisdiction de --list de/diga

# Search US HCPCS codes
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "remote monitoring software" --jurisdiction us
```

If exact matches are absent, record any **analogous codes** or **substitutable
interventions**. Even if your product cannot be billed under them, payers will use
these codes as reference price anchors during price negotiations.

---

### 2. Determine your market access route

When no reimbursement code exists, medical technology falls into one of three
primary pathways:

| Route | When it applies | Primary authority | Evidence burden |
|---|---|---|---|
| **A. Dedicated Digital Health Fast-Track** | Outpatient SaMD (Class I or IIa) in countries with explicit digital health schemes | Germany (BfArM DiGA)<br>France (HAS PECAN)<br>Switzerland (dGA MiGeL, July 2026) | Positive care effect (pVE), clinical efficacy trial, data privacy (BSI / GDPR) |
| **B. Inpatient Hospital Bundling (DRG)** | Software used in hospital settings by physicians/surgeons | Hospital CFO / Pharmacy & Therapeutics Committee, German InEK (NUB) | Cost reduction, reduced length of stay, complication avoidance |
| **C. New National Tariff Petition** | Outpatient device or diagnostic requiring a brand-new public funding line | Switzerland (BAG / EAMGK / ELGK)<br>Germany (G-BA)<br>France (CNEDiMTS) | Full HTA dossier: PRISMA literature review, Markov cost-utility model (ICER/QALY), Budget Impact Analysis (BIA) |

Run the regulation navigator to confirm requirements, authorities, and key stoppers:

```bash
npx tsx plugins/heor/skills/regulation-navigator/scripts/evaluate.ts \
  --jurisdiction de --category digital-health --riskClass IIa --hasAI
```

---

### 3. Synthesize comparative clinical evidence (PRISMA review)

Payers do not create new codes based on safety or usability alone. They require
formal evidence that the intervention outperforms the existing standard of care.

```
Prompt: "Set up a PRISMA literature review comparing our SaMD against standard of care for our target indication."
```

The `prisma-review` skill helps:
- Formulate the **PICO** question (Population, Intervention, Comparator, Outcomes).
- Build Boolean search strings for PubMed and ClinicalTrials.gov.
- Track screening decisions and exclusion rationales to eliminate publication bias.
- Generate a PRISMA 2020 flow diagram using `scripts/prisma-counts.ts`.

---

### 4. Build the health economic model (Cost-Effectiveness & PSA)

To justify a new reimbursement tariff or price point, you must show that the
clinical improvement is economically justifiable (Cost-Utility Analysis).

```
Prompt: "Build a Markov cohort model for our SaMD versus standard of care and run a 1,000-iteration PSA."
```

Using the `heor-engine`:
1. **Model selection:** Select a Markov state-transition model (for progressive
   or chronic conditions) or a Decision Tree (for acute/diagnostic pathways).
2. **Cycle analysis:** Model the cohort over a multi-year or lifetime horizon.
3. **ICER calculation:** Determine the Incremental Cost-Effectiveness Ratio:
   $$\text{ICER} = \frac{\text{Cost}_{\text{intervention}} - \text{Cost}_{\text{comparator}}}{\text{QALY}_{\text{intervention}} - \text{QALY}_{\text{comparator}}}$$
4. **Probabilistic Sensitivity Analysis (PSA):** Run Monte Carlo simulations
   (`run-psa.ts`) drawing from beta, gamma, and log-normal distributions to prove
   the model holds under parameter uncertainty.

---

### 5. Calculate the Budget Impact (BIA)

Payers evaluating a new code application need to know their total financial exposure.

```
Prompt: "Calculate a 3-year Budget Impact Analysis using our target population uptake curve."
```

The model projects:
- Total eligible target patient population in the jurisdiction.
- Realistic annual market adoption rate (e.g. Year 1: 5%, Year 2: 12%, Year 3: 25%).
- Net budget change: (Intervention cost + monitor cost) minus (Avoided hospitalizations + avoided complications).
- Export tables and charts via `export-excel.ts`.

---

### 6. Assemble the application dossier

Depending on your target jurisdiction, trigger the appropriate application skill:
- **Switzerland (Outpatient Device / dGA):** Trigger `ch-migel-application`.
- **Switzerland (In-vitro diagnostic / AI lab):** Trigger `ch-analysenliste-application`.
- **Pan-European / General HTA:** Trigger `eurhta-report` to generate the EUnetHTA
  Joint Clinical Assessment (JCA) Core Model chapters.

---

### 7. Run submission readiness and consistency check

Before submitting to an authority or external health economist, run `hta-quality-check`:

```
Prompt: "Quality-check our drafted application dossier."
```

Verify that:
- Every economic number matches a deterministic run file in `models/runs/`.
- PRISMA counts in the text match `scripts/prisma-counts.ts`.
- No unverified assumptions or unfilled template placeholders remain.
- The WZW criteria (*Wirksamkeit, Zweckmässigkeit, Wirtschaftlichkeit*) or equivalent
  national statutory criteria are addressed with direct evidence citations.

---

## Deliverables Checklist for New Code Applications

- [ ] **PICO definition:** Standard of care comparator clearly articulated.
- [ ] **Tariff gap analysis:** Documented lack of existing codes + identified analog reference prices.
- [ ] **PRISMA 2020 synthesis:** Structured search protocol and screening log.
- [ ] **Deterministic economic model:** Cycle-by-cycle Markov trace or decision tree file.
- [ ] **PSA scatter plot & CEAC curve:** 1,000+ Monte Carlo iterations proving cost-effectiveness probability.
- [ ] **3- to 5-year Budget Impact Analysis:** Net payer financial forecast under varied uptake scenarios.
- [ ] **Formal application draft:** Formatted to the target authority's template.

# Cross-Section Consistency Rubric (Swiss HTA documents)

Evaluate the *internal consistency* of an HTA document — do its sections/modules agree with each other? Act as a meticulous, critical reviewer of Swiss HTA documents. Apply the document-type-specific checks below, then the general principles, then score.

## Document-type-specific checks

### EurHTA / EUnetHTA Core Model report

1. **Terminology and definitions:** base-case comparator defined identically across Introduction, Clinical Effectiveness, and Economic Evaluation; patient inclusion/exclusion criteria consistent across sections; intervention (dosage, frequency, administration) described consistently.
2. **Evidence trail:** economic model parameters trace back to the clinical evidence; internal cross-references accurate and verifiable; PRISMA evidence properly integrated per EUnetHTA methods.
3. **Economic model integrity:** model type justified for the target (European/Swiss) context; assumptions consistent with clinical practice and reimbursement frameworks; conclusions follow logically from the presented data.
4. **Alignment:** executive summary faithfully reflects the conclusions; clear narrative path from problem to recommendations; policy implications consistent with HTA objectives.

### MiGeL application

1. **Module consistency:** product description identical across modules; technical parameters identical wherever repeated; cost details consistent between modules.
2. **Regulatory compliance:** CE certification status consistent throughout; Swiss market-presence claims consistent; OKP reimbursement history accurately represented.
3. **Evidence consistency:** efficacy data consistent across modules; cost-effectiveness claims consistently supported; references properly linked to claims.
4. **Form completeness:** modules cohere as one application; German terminology used consistently; formatting meets BAG requirements.

### Analysenliste application

1. **Section consistency:** analysis description consistent across sections; sensitivity/specificity values identical wherever referenced; regulatory status consistently described.
2. **Scientific evidence:** studies properly integrated across sections; references accurately cross-referenced; evidence-quality assessment consistent.
3. **Regulatory compliance:** IVDR/MDR framework consistently applied; QA measures consistently described; market-authorization status consistently represented.
4. **Form structure:** all 26 sections cohere; German medical terminology correct; BAG formatting met.

### Antrag neue Leistung

1. **Module consistency (ELGK):** service description consistent across modules; **PICOT definition identical throughout**; WZW criteria (Wirksamkeit, Zweckmässigkeit, Wirtschaftlichkeit) consistently evaluated.
2. **HTA methodology:** systematic review consistently applied; evidence grading consistent; economic methods consistently described.
3. **Swiss healthcare context:** KLV entry proposal consistent with the Swiss system; stakeholder considerations consistently addressed; implementation factors consistently evaluated.
4. **Scientific rigor:** HTA methods consistently applied; methods and assumptions transparently documented; ELGK submission standards met.

### Meldung neue Leistung

1. **Service classification:** service type consistent across sections; ambulant/stationär application consistently defined; target population consistently described.
2. **Regulatory information:** legal framework consistently identified; market-authorization status consistent; current reimbursement status consistently described.
3. **Evidence consistency:** benefit-risk ratio consistently evaluated; relevant studies consistently referenced; epidemiological claims consistent.
4. **BAG compliance:** all 9 sections cohere; German terminology consistent; BAG formatting met.

### Umstrittenheitsabklärung

1. **Dispute justification:** disputed service consistently identified; dispute arguments consistent across sections; evidence for the dispute consistently presented.
2. **WZW dispute:** efficacy concerns consistently argued; appropriateness concerns consistently presented; economic concerns consistently documented.
3. **Stakeholder considerations:** conflicts of interest consistently disclosed; publication consent consistently addressed; additional remarks consistently integrated.
4. **Procedure compliance:** all 7 sections cohere; German medical terminology correct; BAG procedural formatting met.

## General consistency principles (all document types)

- **Internal references:** cross-references accurate and verifiable.
- **Terminology:** technical terminology used consistently.
- **Data consistency:** numerical values and claims consistent everywhere they appear (PRISMA counts, prices, volumes, performance parameters).
- **Language quality:** written in proper target language for the intended audience.

## Scoring (1–10)

For BAG forms (German-language documents), use:

| Score | Meaning |
|---|---|
| 9–10 (Sehr gut) | Meets all Swiss requirements fully; consistent terminology; no contradictions |
| 7–8 (Gut) | Largely complete; minor inconsistencies easily corrected |
| 5–6 (Ausreichend) | Clear gaps or contradictions; fundamental revision needed |
| 3–4 (Mangelhaft) | Serious defects; incomplete or contradictory |
| 0–2 (Ungenügend) | Unsuitable for submission; fundamental rework required |

For EurHTA/English-language reports, use:

| Score | Meaning |
|---|---|
| 10 (Flawless) | Perfectly consistent, meets all standards |
| 9 (Excellent) | Well aligned, only minor issues |
| 7–8 (Minor flaws) | Small discrepancies, moderate revisions |
| 4–6 (Moderate flaws) | Inconsistencies undermining credibility; major revisions |
| 1–3 (Major flaws) | Contradictions making the document unusable for submission |

## Output structure

Write the review in the document's language (German for BAG forms, English for EurHTA):

- `consistencyScore` (1–10) with the applicable rubric
- `consistencySummary` — 1–2 sentence overall finding
- `feedback` — detailed, actionable, pointing to specific sections and describing each inconsistency clearly
- Per section/chapter: title, specific feedback, `issues[]`, `recommendations[]`, `strengths[]`, optional per-section score
- `criticalIssues[]` — cross-section must-fix items
- `recommendations[]` — overall improvement recommendations

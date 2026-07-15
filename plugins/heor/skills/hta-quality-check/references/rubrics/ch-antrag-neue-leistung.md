# Antrag neue Leistung Quality Rubric (ELGK HTA standards)

Evaluate a completed "Antrag neue Leistung" form against official Swiss HTA criteria applied by the ELGK (Eidgenössische Kommission für allgemeine Leistungen und Grundsatzfragen). Act as an expert in Swiss HTA assessment; judge by the highest scientific standards and give methodologically grounded recommendations.

## Quality dimensions (score each 0–100)

**1. Vollständigkeit**
- All modules completely filled in?
- Applicant and experts clearly identified?
- All required statements present?
- Enclosure index complete?

**2. Wissenschaftliche Rigorosität**
- Literature search systematic and PRISMA-conform?
- Study designs appropriate for the question?
- Evidence assessment methodologically correct?
- Risk of bias adequately considered?

**3. Evidenzqualität**
- Evidence base sufficiently strong?
- RCTs or other high-quality studies present?
- Transferability to Switzerland established?
- Patient-relevant outcomes investigated?

**4. Ökonomische Analyse**
- Cost analysis complete and traceable?
- All relevant costs considered?
- Cost-effectiveness analysis methodologically correct?
- Budget impact realistically estimated?

**5. Regulatorische Konformität**
- Application meets ELGK requirements?
- KLV entry correctly formulated (trilingual, with Limitationen)?
- All formal requirements fulfilled?
- Confidentiality aspects appropriately handled?

## Module scores (0–100 each)

- **Antragsteller/Experten:** completeness and qualification of the involved persons
- **Modul 1 — Leistungsbeschreibung:** medical baseline, PICOT, treatment pathways, regulatory status
- **Modul 2 — Wirksamkeit:** literature search, study characteristics, benefit-harm assessment
- **Modul 3 — Zweckmässigkeit:** role in care, quality assurance, legal/ethical/societal aspects
- **Modul 4 — Wirtschaftlichkeit:** cost analysis, volume estimation, health-economic assessment
- **Modul 5 — KLV-Eintrag:** trilingual proposal for the benefits schedule
- **Modul 6 — Formalia:** references, enclosures, confidentiality, signature

## WZW assessment (0–100 each)

**Wirksamkeit**
- Effectiveness demonstrated by high-quality evidence?
- Benefit outweighs the risks?
- Effects clinically relevant?

**Zweckmässigkeit**
- Service appropriate for the indication?
- Consistent with the current state of science?
- Quality-assurance measures defined?

**Wirtschaftlichkeit**
- Service cost-effective?
- Costs reasonable?
- Budget impact acceptable?

## Critical issues (always flag)

- Insufficient evidence base
- Methodological flaws in the assessment
- Missing or incomplete cost analysis
- Regulatory inconsistencies
- Unclear or incomplete PICOT definition

## Special evaluation criteria

- Patient relevance of the outcomes
- Methodological quality of the HTA assessment
- Realistic Swiss perspective
- Appropriate handling of uncertainty
- Complete presentation of benefit AND harm

## Readiness level (choose one)

- `not_ready` — fundamental methodological flaws, insufficient evidence
- `needs_major_revision` — substantial rework across several modules
- `needs_minor_revision` — smaller methodological or content corrections
- `ready_for_submission` — ready for ELGK review with complete, high-quality documentation

## Output structure

Report (in German for a German-language form): overall score (0–100), the five dimension scores, module scores, WZW scores, `strengths[]`, `weaknesses[]`, `missingFields[]`, `recommendations[]`, `criticalIssues[]`, and the readiness level.

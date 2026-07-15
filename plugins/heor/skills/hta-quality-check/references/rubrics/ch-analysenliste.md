# Analysenliste Application Quality Rubric (BAG / EAMGK-AL)

Evaluate a completed Analysenliste notification form against the official EAMGK-AL criteria. Act as an expert on Swiss Analysenliste applications to the BAG. Score four quality dimensions 0–100, plus section-group scores; be objective and constructive with specific, actionable recommendations.

## Quality dimensions (score each 0–100)

**1. Vollständigkeit (completeness)**
- Are all mandatory fields filled in?
- Are contact details complete?
- Is the analysis description detailed?
- Are technical specifications provided?

**2. Genauigkeit (accuracy)**
- Are technical parameters (Sensitivität, Spezifität) correct and plausible?
- Are regulatory statements precise?
- Are market data realistic?
- Are cost figures traceable?

**3. Regulatorische Konformität (regulatory compliance)**
- CE marking correctly stated?
- Legal framework (IVDR/MDR; GUMG/EpG for the analysis) applicable and correct?
- Quality-assurance measures described?
- Market-authorization status clearly defined?

**4. Wissenschaftliche Fundierung (scientific foundation)**
- Relevant studies referenced?
- Evidence quality adequate?
- Guidelines considered (national and international)?
- Expert references given?

## Section-group scores (0–100 each, across the 26 sections)

- **Kontaktinformationen (1–2):** completeness of applicant and contact data
- **Analysenbeschreibung (3–9):** designation, type, goal, context, description, indication, target population
- **Technische Spezifikationen (10, 22):** frequency, Sensitivität, Spezifität, NPV, PPV
- **Markt & Entwicklung (11–14):** alternatives, development status, tariff, volumes
- **Regulatorische Informationen (15–19):** financing, legal framework, market authorization, CE conformity
- **Qualitätssicherung (20–21):** similar analyses, internal/external quality control
- **Wissenschaftliche Evidenz (23–24):** studies, guidelines, references
- **Formale Aspekte (25–26):** confidentiality, signature

## Critical issues (always flag)

- Missing mandatory information
- Implausible technical data
- Regulatory inconsistencies
- Insufficient scientific evidence

## Readiness level (choose one)

- `not_ready` — fundamental information missing
- `needs_major_revision` — substantial rework required
- `needs_minor_revision` — small corrections needed
- `ready_for_submission` — ready for BAG submission

## Output structure

Report (in German for a German-language form): overall score (0–100), the four dimension scores, section-group scores, `strengths[]`, `weaknesses[]`, `missingFields[]`, `recommendations[]`, `criticalIssues[]`, and the readiness level.

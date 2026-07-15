# Meldung neue Leistung Quality Rubric (BAG / ELGK)

Evaluate a completed "Meldung neue Leistung" notification form against the official ELGK/BAG criteria. Act as an expert on Swiss notification procedures at the BAG; be objective and constructive with specific, actionable recommendations.

## Quality dimensions (score each 0–100)

**1. Vollständigkeit**
- All mandatory fields filled in?
- Contact details complete and correct?
- Service description detailed?
- All classifications made?

**2. Genauigkeit**
- Service classification correct (diagnostisch / therapeutisch / mit Medizinprodukt / Selbstanwendung / organisatorisch)?
- Medical statements precise and professionally correct?
- Epidemiology data realistic?
- Cost figures traceable?

**3. Regulatorische Konformität**
- Notification meets BAG requirements?
- Legal framework correctly identified?
- Market-authorization statements accurate?
- Application settings (ambulant/stationär) clearly defined?

**4. Evidenzqualität**
- Benefit-harm ratio appropriately presented?
- Relevant studies and guidelines referenced?
- Evidence base sufficient for a notification procedure?
- Outcomes defined in patient-relevant terms?

## Section scores (0–100 each, 9 sections)

- **Kontaktinformationen (1):** completeness of applicant and contact data
- **Leistungsbezeichnung (2):** generic designation, trade name, existing nomenclature positions
- **Leistungsklassifikation (3):** correct assignment of service type, goal, setting
- **Leistungsbeschreibung (4):** health problem, epidemiology, standard measures, mechanism, outcomes
- **Entwicklungsstand (5):** application status, introduction specifics, legal framework, market authorization
- **Wirksamkeitsnachweis (6):** benefit-harm ratio, evidence quality
- **Wirtschaftlichkeit (7):** cost comparison, insured volume, financing status
- **Vertraulichkeit (8):** conflicts of interest, recusal arrangements
- **Formalia (9):** signature and completeness declaration

## Critical issues (always flag)

- Missing or incomplete mandatory statements
- Wrong service classification
- Insufficient evidence base
- Regulatory inconsistencies
- Unrealistic cost or volume figures

## Special evaluation criteria

- WZW conformity (Wirksamkeit, Zweckmässigkeit, Wirtschaftlichkeit)
- Patient relevance of the outcomes
- Realistic market estimate
- Evidence base appropriate for a notification (lighter than a full Antrag)

## Readiness level (choose one)

- `not_ready` — fundamental information missing, serious classification errors
- `needs_major_revision` — substantial rework in several areas
- `needs_minor_revision` — smaller corrections and additions
- `ready_for_submission` — ready for BAG submission with all required statements

## Output structure

Report (in German for a German-language form): overall score (0–100), the four dimension scores, section scores, `strengths[]`, `weaknesses[]`, `missingFields[]`, `recommendations[]`, `criticalIssues[]`, and the readiness level.

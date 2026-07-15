# Umstrittenheitsabklärung Quality Rubric (BAG / ELGK)

Evaluate a completed "Umstrittenheitsabklärung" dispute form against the official ELGK/BAG criteria. Act as an expert on Swiss dispute procedures at the BAG; be objective and balanced — assess both the legitimacy of the dispute and the quality of the argumentation.

## Quality dimensions (score each 0–100)

**1. Vollständigkeit**
- All mandatory fields filled in?
- Applicant and contact details complete?
- Disputed service clearly identified?
- All relevant sections addressed?

**2. Begründungsqualität (quality of justification)**
- Justification for the dispute coherent?
- Arguments professionally grounded?
- Criticism constructive and factual?
- Alternative approaches shown?

**3. Evidenzstärke (strength of evidence)**
- Evidence for the dispute sufficient?
- New scientific findings considered?
- Studies and references current and relevant?
- Evidence base convincing?

**4. Regulatorische Konformität**
- Notification meets BAG procedural requirements?
- Confidentiality aspects appropriately handled?
- Conflicts of interest transparently disclosed?
- Formal requirements fulfilled?

## Section scores (0–100 each, 7 sections)

- **Antragstellende (1):** completeness and credibility of the disputing party
- **Leistungsidentifikation (2):** clear identification of the disputed service (whole service vs. aspects)
- **Leistungsbeschreibung (3):** properties, application, costs described in detail
- **Begründung der Anmeldung (4):** quality of the WZW dispute justification
- **Weitergabe/Publikation (5):** appropriate handling of confidentiality and transparency
- **Weitere Bemerkungen (6):** additional relevant information
- **Unterschrift (7):** formal completeness

## Dispute-category assessment (0–100 each)

**Wirksamkeit bestritten**
- New studies raising doubt about effectiveness?
- Methodological flaws identified in the original evidence?
- Safety concerns emerged?

**Zweckmässigkeit bestritten**
- Better alternatives become available?
- Medical standard changed?
- Guideline recommendations revised?

**Wirtschaftlichkeit bestritten**
- Costs risen disproportionately?
- More cost-effective alternatives available?
- Budget impact proven problematic?

**Andere Gründe**
- Regulatory changes occurred?
- New safety risks known?
- Conditions of use changed?

## Critical issues (always flag)

- Insufficient justification for the dispute
- Missing or weak evidence base
- Conflicts of interest not transparently disclosed
- Formal defects in the submission
- Unclear or incomplete identification of the service

## Special evaluation criteria

- Objectivity and factuality of the criticism
- Consideration of patient interests
- Fair appraisal of the existing evidence
- Constructive improvement proposals
- Transparency about own interests

## Procedural aspects (comment on each)

- Is the timing of the dispute appropriate?
- Are all affected stakeholders considered?
- Is the impact on patient care assessed?
- Are transition arrangements proposed?

## Readiness level (choose one)

- `not_ready` — fundamental justification missing, serious formal defects
- `needs_major_revision` — substantial rework of the argumentation
- `needs_minor_revision` — smaller additions and corrections
- `ready_for_submission` — ready for BAG review with convincing justification

## Output structure

Report (in German for a German-language form): overall score (0–100), the four dimension scores, section scores, dispute-category scores, `strengths[]`, `weaknesses[]`, `missingFields[]`, `recommendations[]`, `criticalIssues[]`, procedural-aspect comments, and the readiness level.

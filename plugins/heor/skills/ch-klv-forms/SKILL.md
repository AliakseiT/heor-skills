---
name: ch-klv-forms
description: >-
  Draft one of the three Swiss KLV/OKP service forms for the BAG from a dossier
  directory: "Meldung neue Leistung" (notification of a new service),
  "Antrag neue Leistung" (full application for KLV Anhang 1 listing, WZW/PICOT
  based, ELGK review), or "Umstrittenheitsabklärung" (dispute of an already
  reimbursed service). Use when the user mentions KLV, Krankenpflege-
  Leistungsverordnung, OKP Leistungspflicht, neue Leistung melden/beantragen,
  ELGK, umstrittene Leistung, Umstrittenheit, WZW-Kriterien (Wirksamkeit,
  Zweckmässigkeit, Wirtschaftlichkeit), or in English: Swiss new-service
  notification, KLV listing application, Swiss health-benefit dispute form.
  Routes to the right form, reads the dossier, and writes the output to
  applications/ch/<form>/<lang>.md. Default output language German; the
  structure supports French/Italian variants.
metadata:
  jurisdiction: ch
  languages: [de]
  last-verified: 2026-07-15
---

# Swiss KLV Forms (Meldung / Antrag neue Leistung, Umstrittenheit)

This skill drafts the three BAG forms for medical services under the mandatory health insurance (OKP), assessed against the WZW criteria — Wirksamkeit (effectiveness), Zweckmässigkeit (appropriateness), Wirtschaftlichkeit (economic efficiency).

## Step 0 — Route to the correct form

Determine which form the user needs. If ambiguous, ask — the three serve different procedural stages:

| Form | When it applies | Output path |
|---|---|---|
| **Meldung neue Leistung** | First step: notifying the BAG of a *new* service (diagnostic, therapeutic, device-assisted, self-applied device, or organizational measure) so it can be checked whether OKP reimbursement review is required. Short 9-section form; precedes a full application. | `applications/ch/meldung-neue-leistung/<lang>.md` |
| **Antrag neue Leistung** | Full application for inclusion of a new service in the reimbursement obligation (KLV Anhang 1), reviewed by the ELGK (Eidgenössische Kommission für allgemeine Leistungen und Grundsatzfragen) against Swiss HTA methodology. Six modules with PICOT, systematic literature review, and full WZW assessment. Use when the user is past notification stage or explicitly wants the Antragsformular. | `applications/ch/antrag-neue-leistung/<lang>.md` |
| **Umstrittenheitsabklärung** | The service is *already* reimbursed by the OKP, but its Wirksamkeit, Zweckmässigkeit, or Wirtschaftlichkeit is disputed (e.g., new contrary evidence, better alternatives, disproportionate cost). Filed by insurers, professional societies, patient organizations, etc. | `applications/ch/umstrittenheit/<lang>.md` |

## Step 1 — Output language

The output language is a parameter. Default is German (`de`); French or Italian is legitimate — ask if unstated. Templates live at `references/templates/<form>/<lang>.md`; currently only `de.md` exists per form. For `fr`/`it`, translate the German template's structure faithfully, keep numbering identical, and flag in the disclaimer that the structure must be checked against the official BAG form in that language.

The templates use `{{placeholder}}` slots. Replace every slot with drafted content, or with `[Bitte hier eintragen]` (or the language-appropriate equivalent) when no information is available. No `{{...}}` may remain in the output.

## Step 2 — Gather inputs from the dossier

Work inside the user's dossier directory (see DOSSIER_FORMAT.md at the plugin root). Read what exists; never fail on missing files.

1. `dossier.yaml` — intervention/service name, description, comparator, `notes` (global instructions: apply throughout).
2. `documents/` — service descriptions, protocols, guidelines, regulatory documents; extract specific data wherever available.
3. `prisma/` — PICO (`pico.yaml`), queries, PRISMA flow counts (`prisma-diagram.md`), and `included-studies.json` for clinical and economic evidence. Full texts are the primary evidence source.
4. `chapters/` — drafted chapters may be reused as evidence summaries.
5. `models/inputs/*.json`, `models/runs/*.json` — CEA/BIA parameters and results, plus PSA/tornado output for the Antrag's Wirtschaftlichkeit module.

Never compute or re-derive model results yourself; use only `packages/heor-engine` outputs in `models/runs/` (`npx tsx <script>` to regenerate). If a needed result is missing, ask the user to run the engine.

Ask the user for missing essentials: applicant institution and contacts, clinical/economic experts (Antrag), the requested tariff/cost figures, and — for Umstrittenheit — who is disputing and why.

## Step 3 — Common drafting rules

You are acting as an expert on Swiss healthcare applications to the BAG. Produce the complete form in Markdown in the requested language, following the template exactly.

- Mark applicable checkboxes with `[x]` instead of `[ ]`.
- Extract specific data from documents where available; never invent facts.
- Consider Swiss healthcare-system specifics throughout (TARMED/TARDOC positions, KVG/KLV legal framework, Swissmedic/CE status, ambulant vs. stationär).
- Structure content around the WZW criteria (Wirksamkeit, Zweckmässigkeit, Wirtschaftlichkeit) and Swiss HTA methodology / ELGK requirements; focus on patient-relevant outcomes and cost-effectiveness.
- Citations: with PRISMA data, use numbered inline citations `[1]`, `[2]`, ... from one reference list, never duplicated inside sections, with a final `### Referenzen` section repeating the list. Without PRISMA data, cite from the supplied documents; inline citations optional.
- Economic evidence: where CEA/BIA results exist, embed the deterministic CEA summary (naming the model), the budget-impact summary, PSA/sensitivity results (Antrag), and parameter-source tables (`| Parameter | Quelle |`) for CEA and BIA inputs from `models/inputs/` source tracking.

## Step 4 — Form-specific guidance

### 4a. Meldung neue Leistung (9 sections)

- **Grundlegende Informationen (1–2):** contact details (extract or placeholder); generic designation and trade name; position in existing nomenclatures (TARMED, KLV, ...).
- **Leistungsklassifikation (3):** classify correctly — diagnostische Leistung (tests, imaging), medizinisch-therapeutische Leistung (treatments, operations), medizinisch-therapeutische Leistung mit Medizinprodukt (implants, devices), Medizinprodukt zur Selbstanwendung (aids, self-tests), organisatorische Massnahme (coordination, case management). Set Zielsetzung (präventiv/therapeutisch) and Anwendung (ambulant/stationär).
- **Leistungsbeschreibung (4):** health problem, target group, indications; research or estimate Swiss incidence/prevalence; current standard measures and their limitations; mechanism of action, users, treatment pathway, application frequency; key patient-relevant outcomes (mortality, morbidity, quality of life).
- **Entwicklung und Regulierung (5):** application status in Switzerland and worldwide; introduction specifics; legal framework and market-authorization status (CH, EU/USA); whether regulatory conditions are fulfilled.
- **Evidenz und Wirtschaftlichkeit (6–7):** benefit-harm ratio based on available evidence; relevant studies, guidelines, publications; cost per treatment case (new service vs. standard); number of insured affected per year; current financing situation (CH/abroad).
- **Formale Aspekte (8–9):** confidentiality and potential conflicts of interest (recusal request); signature block.

### 4b. Antrag neue Leistung (6 modules + applicant block)

- **Antragsteller und Experten:** realistic applicant (institution, professional society, manufacturer); clinical and economic experts; main contact with full details.
- **Modul 1 — Leistungsbeschreibung:** 1.1 medical baseline (indications, standard therapy, disease burden, epidemiology, alternatives); 1.2 service description (mechanism/application, contraindications, patient-relevant outcomes, measurement time points); 1.3 prevention-specific details where applicable; 1.4 structured **PICOT** (Population, Intervention, Comparator, Outcomes, Time) — from `prisma/pico.yaml`, kept identical everywhere it is referenced; 1.5 treatment pathways in detail; 1.6–1.8 regulatory status, providers/current use, future potential.
- **Modul 2 — Wirksamkeit:** 2.1 systematic literature search with PRISMA-conform reporting (methodology + flow counts from `prisma/`); 2.1.1–2.1.3 study characteristics, evidence quality, transferability to Switzerland; 2.2–2.3 benefit-harm assessment for therapeutic/diagnostic services (controlled trials, endpoints, subgroups, long-term results); 2.4–2.5 efficacy summary and evidence gaps.
- **Modul 3 — Zweckmässigkeit:** 3.1 role in patient care and guideline recommendations; 3.2 quality-assurance measures and prerequisites for use; 3.3 appropriate care and adherence factors (target group, selection criteria, care structures); 3.4–3.6 legal, ethical, and societal aspects.
- **Modul 4 — Wirtschaftlichkeit:** 4.1–4.3 detailed cost analysis (service, comparator, per case); 4.4–4.5 application volumes and cost impact (from BIA); 4.6 health-economic literature (economic PRISMA results); 4.7 global assessment — all numbers from `models/runs/`, with international reference comparisons and the insurer (OKP) perspective.
  - **Cost logic for the sample material:** if the service involves a specimen and the material is *not* blood-based (not Blut/Serum/Plasma — e.g., breath, urine, saliva), you MUST state explicitly that phlebotomy costs (Position 4701.00) are excluded from the calculation, add the costs of the specific collection method instead (e.g., breath bag, urine cup, saliva swab), and highlight the resulting cost and convenience advantage (non-invasive, no blood draw) in the Wirtschaftlichkeit module.
- **Modul 5 — KLV Eintrag:** proposed entry for KLV Anhang 1 in all three languages (Deutsch, Französisch, Italienisch), including any Limitationen.
- **Modul 6 — Formalia:** complete references and enclosure index; confidentiality/recusal; signature.

### 4c. Umstrittenheitsabklärung (7 sections)

Frame everything as an objective, well-evidenced dispute — constructive, factual criticism, not advocacy.

- **Antragstellende (1):** realistic disputing party (professional society, health insurer, patient organization) with full contacts; be transparent about potential conflicts of interest.
- **Bestrittene Leistung (2):** generic designation; whether the entire service or only specific aspects/indications are disputed.
- **Leistungsbeschreibung (3):** 3.1 properties (description, indications, alternatives, mechanism/claimed benefit, risks); 3.2 medical device/implant classification with manufacturer details; 3.3 application (treatment pathway, upstream/downstream services, providers, annual volumes); 3.4 costs and tariffs (current costs, tariff positions, market prices).
- **Begründung der Anmeldung (4):** check and argue the disputed WZW dimension(s) —
  - *Wirksamkeit bestritten:* lacking or contradictory evidence, new studies, methodological flaws in the original evidence, safety signals.
  - *Zweckmässigkeit bestritten:* inappropriate use, better alternatives now available, changed medical standard or revised guidelines.
  - *Wirtschaftlichkeit bestritten:* disproportionate costs, more cost-effective alternatives, problematic budget impact.
  - *Weitere Gründe:* safety concerns, regulatory changes, changed conditions of use.
  Document each concern with concrete evidence (studies raising doubt, guideline changes, expert opinions, cost comparisons).
- **Special analysis for dispute procedures:** explain why the service was originally listed; what has changed since (new evidence, alternatives, costs); whether the original WZW criteria are still met; implications for patient safety and quality of care.
- **Weitergabe/Publikation (5), Bemerkungen (6), Unterschrift (7):** consent to forwarding to BAG/associations/ELGK, publication consent, requests to exclude sensitive information with justification, additional remarks, signature block.

## Step 5 — Write the output

Write the completed form to the path from the routing table (create directories as needed). If the file already exists, do not blindly overwrite — show a diff or write alongside and let the user choose.

Verify: no `{{...}}` slots or template guidance remain; checkboxes consistent with the narrative; PICOT/service description identical across modules; PRISMA counts internally consistent; all economic figures match `models/runs/` exactly. List all remaining placeholder fields to the user.

## Step 6 — Mandatory expert review disclaimer

End the generated document with a clearly separated note, and repeat it to the user:

> **Hinweis / Disclaimer:** Dieser Entwurf wurde automatisiert aus den Dossier-Unterlagen erstellt. Er ersetzt keine fachliche Prüfung. Vor der Einreichung beim BAG/ELGK müssen alle Angaben — insbesondere klinische Evidenz, WZW-Beurteilung, Kosten- und Tarifangaben sowie rechtliche Aussagen — durch qualifizierte Fachpersonen geprüft und verantwortet werden.

This step is not optional.

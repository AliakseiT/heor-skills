---
name: ch-analysenliste-application
description: >-
  Draft a Swiss Analysenliste notification form (Meldeformular Analysenliste)
  for a new laboratory analysis, addressed to the BAG/EAMGK-AL, from a dossier
  directory. Use when the user asks about the "Analysenliste", "AL",
  "Meldeformular Analysenliste", listing of a laboratory test / Laboranalyse /
  diagnostic assay for Swiss OKP reimbursement, companion diagnostics listing,
  or EAMGK-AL submission (English triggers: Swiss laboratory analysis list,
  Swiss lab test reimbursement application, analysis list notification). Reads
  dossier.yaml, supporting documents, PRISMA literature results, and economic
  model runs; writes the completed form to
  applications/ch/analysenliste/<lang>.md. Default output language German; the
  structure supports French/Italian variants.
metadata:
  jurisdiction: ch
  languages: [de, fr]
  last-verified: 2026-07-15
  version: "1.0.0"
---

# Analysenliste Application (Swiss Laboratory Analysis List)

Draft a complete Analysenliste notification form for the Swiss Federal Office of Public Health (BAG) — the form by which a new laboratory analysis is submitted for review of its reimbursement obligation under the mandatory health insurance (OKP), assessed by the EAMGK-AL.

Regulatory context (reflected in the template header): the signed form plus enclosures is submitted electronically to office.al@eamgk.admin.ch (one PDF for the form, one per enclosure; >20 MB via the BIT file-transfer service).

## Step 0 — Output language

The output language is a parameter. Default is German (`de`); French or Italian output is legitimate — ask if the user has not said.

Use the form template at `references/templates/<lang>.md`. Official templates exist for `de` and `fr` (extracted from the official BAG Meldeformular, version März/mars 2025 — see `references/templates/_sources.md`). BAG publishes no Italian version of this form (the Italian BAG page links the French file); for `it` output, translate the French template's structure and question wording faithfully, keep the 26-section numbering identical, and flag in the final disclaimer that no official Italian form exists and the draft must be verified with BAG before submission.

## Step 1 — Gather inputs from the dossier

Work inside the user's dossier directory (see DOSSIER_FORMAT.md at the plugin root). Read what exists; never fail on missing files.

1. `dossier.yaml` — analysis name and description, categories (expect `ivd`), comparator, and `notes` (global context instructions: apply them throughout).
2. `documents/` — IFU, assay description, validation reports, regulatory certificates. Primary source for technical facts (technique, performance data, CE status).
3. `prisma/included-studies.json` and related PRISMA files — clinical and economic/resource-use evidence for sections 20–24; full texts are the primary evidence source where available.
4. `chapters/` — drafted evidence summaries may be reused.
5. `models/inputs/*.json`, `models/runs/*.json` — cost-effectiveness and budget-impact results, used to ground the tariff, volume, and market sections.

Never compute or re-derive model results yourself; use only outputs from `packages/heor-engine` scripts stored in `models/runs/`. If a needed result is missing, ask the user to run the engine, then continue.

Ask the user for anything not derivable from the dossier, in particular: contact person details, applicant type (Labor / Hersteller / wissenschaftliche Gesellschaft / Einzelperson), requested tariff (Taxpunkte/CHF), expected annual volumes, and confidentiality/recusal wishes.

## Step 2 — Drafting rules (apply throughout)

You are acting as an expert on Swiss Analysenliste applications to the BAG. Produce the complete form in Markdown in the requested language, following the template exactly.

- Mark applicable checkboxes with `[x]` instead of `[ ]`.
- Use `[Bitte hier eintragen]` (or the language-appropriate equivalent) only when no information is available; never invent facts.
- Extract specific values from the documents — e.g., "Sensitivität: 95 %", not "hoch".
- Respect Swiss regulatory specifics: GUMG (genetic testing), EpG (epidemics law), IVDR/MDR, Swissmedic/CE market-authorization status.
- If PRISMA literature is available: use numbered inline citations `[1]`, `[2]`, ... from a single reference list; do not repeat full reference lists inside sections; append a final `### Referenzen` section with the same numbered list. Without PRISMA data, rely on the provided documents and summaries; inline citations are optional.
- Where CEA/BIA results exist, embed a short summary of the deterministic cost-effectiveness result (naming the model type) and the budget-impact result in the economic sections (13–15), and document parameter sources as a table (`| Parameter | Quelle |`) — one for CEA parameters and one for BIA assumptions — using the source-tracking fields from `models/inputs/`.

## Step 3 — Section-by-section guidance

Read the template at `references/templates/<lang>.md` and fill all 26 sections in order.

**Grundlegende Informationen (Abschnitte 1–3)**
- Extract contact details from documents or use placeholders.
- Determine the applicant type (Labor, Hersteller, etc.) and check it.
- Identify the generic designation (without trade name) and the trade name of the analysis, plus any existing position in KLV/TARMED or other nomenclatures.

**Analyse-Klassifikation (Abschnitte 4–6)**
- Classify the type of analysis (Körperflüssigkeiten/somatische Zellen/Gewebe, Companion Diagnostics, andere).
- Determine the goal (Prävention, Diagnostik, Therapieüberwachung).
- Define the application context (ambulant vs. Spital/Pflegeheim).

**Technische Beschreibung (Abschnitte 7–9)**
- Describe the analysis technique and method (kommerziell vs. In-House).
- Specify indications and the target population.
- Estimate application frequency (at diagnosis, during treatment, after recovery) from available data.

**Markt und Regulierung (Abschnitte 10–19)**
- Analyze alternatives (what it replaces, what it is an add-on to) and the development status (routine use in CH/abroad, research, development).
- State the requested tariff and estimated annual analysis volumes — grounded in BIA inputs/results where available.
- Assess the current financing situation in Switzerland (stationär/ambulant) and abroad (countries, mechanism).
- Identify the applicable legal frameworks (GUMG, EpG for the analysis; IVDR, MDR for the device).
- Document market authorization (Schweiz / Schweiz+Ausland / nur Ausland) and the CE conformity certificate (manufacturer declaration vs. Notified Body, or justified absence).

**Qualität und Evidenz (Abschnitte 20–24)**
- Identify similar analyses on the market.
- Describe quality-assurance measures: internal controls (kommerziell/In-House) and external quality control (Schweiz/Ausland/keine).
- Extract technical performance parameters with concrete values: Sensitivität, Spezifität, NPV, PPV.
- Compile the scientific support: study types (HTA, RCT, ...), the key relevant studies, whether conducted by the manufacturer or independently, and national and international guidelines.
- List the references (numbered, matching inline citations).

**Formale Aspekte (Abschnitte 25–26)**
- Confidentiality: recusal request for a commission member with justification, if the user wants one.
- Prepare the signature block (Ort, Datum, Unterschrift).

## Step 4 — Write the output

Write the completed form to `applications/ch/analysenliste/<lang>.md` in the dossier (create directories as needed). If the file already exists, do not blindly overwrite — show a diff or write alongside and let the user choose.

Then verify completeness: no leftover template guidance, every open field carries the placeholder and is reported to the user, checkbox selections are consistent with the narrative (e.g., CE status vs. market authorization), and all economic figures match `models/runs/` exactly.

## Step 5 — Mandatory expert review disclaimer

End the generated document with a clearly separated note, and repeat it to the user:

> **Hinweis / Disclaimer:** Dieser Entwurf wurde automatisiert aus den Dossier-Unterlagen erstellt. Er ersetzt keine fachliche Prüfung. Vor der Einreichung beim BAG/EAMGK-AL müssen alle Angaben — insbesondere technische Leistungsdaten, regulatorischer Status, Tarif- und Mengenangaben — durch qualifizierte Fachpersonen (Labormedizin, Regulatory Affairs, Gesundheitsökonomie) geprüft und verantwortet werden.

This step is not optional.

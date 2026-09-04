---
name: ch-migel-application
description: >-
  Draft a Swiss MiGeL application form (Antrag auf Aufnahme in die Mittel- und
  Gegenständeliste / MiGeL-Antrag) for submission to the BAG/EAMGK-MiGeL, from a
  dossier directory. Use when the user asks for a MiGeL application, "MiGeL",
  "Mittel- und Gegenständeliste", "MiGeL-Antrag", "Neuaufnahme Kategorie B/C",
  "Höchstvergütungsbetrag" (HVB), or Swiss OKP reimbursement listing of a
  medical device, aid, or product used by patients (English triggers: Swiss
  medical device list application, Swiss aids and appliances list, MiGeL
  reimbursement dossier). Reads dossier.yaml, supporting documents, PRISMA
  literature results, and economic model runs; writes the completed form to
  applications/ch/migel/<lang>.md. Default output language German; the
  structure supports French/Italian variants.
metadata:
  jurisdiction: ch
  languages: [de, fr]
  last-verified: 2026-07-15
  version: "1.0.0"
---

# MiGeL Application (Mittel- und Gegenständeliste)

Draft a complete MiGeL application form for the Swiss Federal Office of Public Health (BAG), addressed to the Eidgenössische Kommission für Analysen, Mittel und Gegenstände (EAMGK), Ausschuss für Mittel und Gegenstände (EAMGK-MiGeL), and the EDI. The MiGeL lists devices and aids applied by patients themselves or by non-professional carers that are reimbursed by the mandatory health insurance (OKP).

Regulatory context to keep in mind (and reflected in the template header):

- Before a full MiGeL application, the form "Meldung einer neuen Leistung oder eines neuen Produkts" must normally be submitted first. If the dossier shows no evidence of a prior Meldung, note this to the user.
- The signed form plus enclosures is submitted electronically to office.migel@eamgk.admin.ch (application as one PDF, each enclosure a separate PDF; >20 MB via BIT file transfer).
- Every claim in the form must be justified and backed by a cited literature source; relevant studies (preferably RCTs, systematic reviews, meta-analyses) must be enclosed as full-text PDFs and listed in the enclosure index.

## Step 0 — Output language

The output language is a parameter, not a property of the form. Default is German (`de`) — the working language of BAG/EAMGK submissions — but French or Italian output is legitimate; ask if the user has not said.

- Use the form template at `references/templates/<lang>.md`. Official templates exist for `de` and `fr` (extracted from the official BAG forms, June 2025 — see `references/templates/_sources.md`). BAG publishes no Italian version of this form (the Italian BAG page links the French file); for `it` output, translate the French template's structure and question wording faithfully, keep all section numbering identical, and flag in the final disclaimer that no official Italian form exists and the draft must be verified with BAG before submission.
- Module 6 always requires the product designation in all three languages (Deutsch/Französisch/Italienisch) regardless of output language.

## Step 1 — Gather inputs from the dossier

Work inside the user's dossier directory (see DOSSIER_FORMAT.md at the plugin root). Read what exists; never fail on missing files.

1. `dossier.yaml` — intervention name, description, device class, comparator, and `notes` (global context instructions: apply them throughout the draft).
2. `documents/` — supporting documents (IFU, device description, CER, protocols). Use them as the primary source for product facts. From the IFU or device description, extract the manufacturer name and address for the applicant/contact table; if not found, use the placeholder.
3. `prisma/included-studies.json`, `prisma/prisma-diagram.md`, `prisma/screening.json`, `prisma/search-results.json` — literature evidence and PRISMA flow counts. If the dossier contains separate clinical and economic searches (e.g., subdirectories or tagged entries), keep them separate: clinical numbers feed Modul 2, economic numbers feed Modul 5.
4. `chapters/` — any drafted dossier chapters (clinical effectiveness, economic evaluation) may be reused as evidence summaries.
5. `models/inputs/*.json` and `models/runs/*.json` — economic model parameters and results (CEA, budget impact, PSA, tornado/sensitivity output).

Never compute or re-derive model results yourself. All numbers in the Wirtschaftlichkeit module must come from `models/runs/` files produced by the `packages/heor-engine` scripts (`npx tsx <script>`). If a needed result is missing, ask the user to run the engine (or run the documented engine script), then continue.

Ask the user for anything the dossier does not provide, in particular: applicant/author/expert contact details, manufacturer details if not extractable, product price/tariff and comparator price, requested MiGeL category (B or C) or HVB change, and CE certificate details.

## Step 2 — Drafting rules (apply throughout)

You are acting as an expert in Swiss health economics. Produce the complete form in Markdown in the requested language, following the template exactly — every module, every question, every table.

- Where information is missing, insert the literal placeholder `[Bitte hier eintragen]` (keep this German marker even in fr/it drafts only if the user wants a BAG-recognizable placeholder; otherwise use the language-appropriate equivalent `[Veuillez compléter]` / `[Da compilare]`). Never invent facts to fill a gap.
- Replace all italic explanatory text in square brackets from the template with real content; the explanations describe what BAG expects in that field — satisfy them, don't repeat them.
- Mark applicable checkboxes with `[x]` instead of `[ ]` (e.g., Anlass des Antrages, diagnostic-pathway position).
- Extract specific values from documents (e.g., "Sensitivität: 95 %", concrete CHF amounts), not vague qualifiers.
- Literature full texts (from `prisma/` or `documents/`) are the primary evidence source; abstracts are fallback.
- If the user asks for a regeneration with corrections, treat their instruction as overriding earlier drafts.

### Citations and references

If PRISMA literature is available:

- Use the numbered reference list for short inline citations in the form (format `[1]`, `[2]`, ...).
- Do not repeat full reference lists inside individual modules.
- Append a final section `### Referenzen` with the same numbered list at the end of the form.
- Build the list from `prisma/included-studies.json` (authors, year, title, journal/source, PMID/DOI where present).

If no PRISMA search exists, base the literature statements exclusively on the provided documents; inline citations are then optional.

## Step 3 — Module-by-module guidance

Read the template at `references/templates/<lang>.md` and fill it in order.

**Header & Antragsteller/Experten** — version date, applicant, author, optional clinical and economic experts, main contact. Use extracted manufacturer data (name, address) where the manufacturer is the applicant; placeholders otherwise.

**Anlass des Antrages** — check the applicable reason (Neuaufnahme Kategorie B or C, HVB change, HVB Selbstanwendung, HVB Pflege, other) based on the user's goal.

**Modul 1 — Beschreibung des Produktes** — product name, packaging, formats, device class (reference the CE certificate as an enclosure); how the product works, who applies it (professions involved, ambulant vs. stationär); indications and contraindications; lifetime, warranty, maintenance, disposal; patient-relevant outcomes ranked by relevance for assessing Wirksamkeit (mortality, morbidity, clinical events, patient-reported outcomes, adverse events) and their measurement time points; for diagnostics, position in the diagnostic pathway (triage / replacement / add-on); medical baseline (1.2: indications, Swiss incidence/prevalence, current standard therapy and its OKP status, disease burden and unmet need, competing products in development); treatment-pathway table contrasting comparator vs. product across Voruntersuchung/Behandlung/Nachbehandlung; future potential (1.4).

**Modul 2 — Wirksamkeit** — covers efficacy, effectiveness, and safety.
- 2.1.1 Methodik: databases searched, search terms, in-/exclusion criteria — from `prisma/queries.yaml` and `prisma/pico.yaml`.
- 2.1.2 PRISMA results: use the **clinical** PRISMA counts exclusively here: records identified, after duplicate removal, after abstract screening, excluded (with reasons), included after full-text screening. Typical databases: PubMed, ClinicalTrials.gov. If only one combined PRISMA search exists, use its counts here and note the scope.
- 2.1.3 Study characteristics table (author/year, design, participants per arm, outcomes, enclosure no.), one row per included study.
- 2.1.4 Evidence quality: how well the studies support a valid estimate of effectiveness vs. the comparator (design, risk of bias, directness).
- 2.1.5 Transferability to Swiss clinical practice, differentiated by endpoint where needed.
- 2.2 (therapeutic) / 2.3 (diagnostic) benefit-harm tables with confidence intervals; for diagnostics fill all three Wirksamkeitsebenen (clinical outcomes, management consequences, diagnostic accuracy: sensitivity, specificity, ROC, PPV/NPV).
- 2.4 Summary (max. 2 pages): comparative effectiveness, evidence quality, safety profile.
- 2.5 Evidence gaps: ongoing/planned trials (registry IDs, design, expected completion).

**Modul 3 — Zweckmässigkeit** — position of the product in (inter)national guidelines and expected changes to the care pathway; quality-assurance requirements and required qualifications/certificates; adherence risks and safeguards; risks/incentives for over-, under-, or misuse; legal aspects; ethical aspects; societal aspects (risks to health professionals, equitable access within Switzerland, patient acceptance/preferences, effects on indirect/societal costs).

**Modul 4 — Marktsituation** — Swiss market presence, distribution channels, 5-year sales-volume table (share within MiGeL scope), past OKP reimbursement history; foreign availability and reimbursement conditions.

**Modul 5 — Wirtschaftlichkeit** — explain every calculation step; reference the engine output files as the calculation annex.
- 5.1/5.2 prices and tariffs of product and comparator, calculation basis, purchase vs. rental, expected price development — use the exact CEA/BIA input values from `models/inputs/` (product price, comparator price, annual costs); do not substitute your own numbers.
- 5.3 cost-per-case tables for product and comparator (step, count, unit cost, total).
- 5.4 volume forecasts (applications and patients per year, for product and comparator) — from BIA inputs (target population, market shares).
- 5.5 quantity-times-cost tables, savings table, and net financial impact on the OKP — from the budget-impact run in `models/runs/`.
- 5.6.1–5.6.3 health-economic literature: use the **economic** PRISMA counts exclusively here (same fields as Modul 2), plus the study-characteristics table and evidence-quality assessment.
- 5.6.4 cost-effectiveness ratio: summarize the deterministic CEA result (name the model type), its reliability, and transferability to Swiss routine conditions.
- 5.6.5 parameter-source table: one row per CEA/BIA model parameter with its exact source (DOI/PMID, quote, or document name) from the source-tracking fields in `models/inputs/`.
- If sensitivity-analysis output exists (tornado diagram, PSA/CEAC results in `models/runs/`), summarize it under Wirtschaftlichkeit: key drivers from the tornado analysis, probability of cost-effectiveness from the PSA.
- 5.7 global assessment: place the product in the cost/effect matrix (`[x]` in one cell) and justify the placement in the Bemerkungen and summary fields, consistent with the CEA/BIA results.

**Modul 6 — Eintrag in der MiGeL** — proposed entry with designation in German, French, and Italian, MiGeL position, position number if applicable, and any limitations.

**Modul 7 — Referenzen und Beilagen** — full reference index (same numbering as inline citations), enclosure index (CE certificate, full-text PDFs, calculation spreadsheet/engine outputs), confidentiality/recusal request if the user wants one, and the signature block.

## Step 4 — Write the output

Write the completed form to `applications/ch/migel/<lang>.md` in the dossier (create directories as needed). If the file already exists, do not blindly overwrite: show the user a diff or write alongside (e.g., `de.new.md`) and let them choose — application markdown is human-owned per the dossier rules.

Then verify completeness:

- No template instruction text or italic guidance remains.
- Every unanswered field carries the placeholder marker, and you list these open fields to the user.
- PRISMA counts in 2.1.2 and 5.6.1 are internally consistent (identified ≥ screened ≥ included).
- All Modul 5 numbers match the `models/runs/` files exactly.

## Step 5 — Mandatory expert review disclaimer

End the generated document with a clearly separated note, and repeat it to the user:

> **Hinweis / Disclaimer:** Dieser Entwurf wurde automatisiert aus den Dossier-Unterlagen erstellt. Er ersetzt keine fachliche Prüfung. Vor der Einreichung beim BAG/EAMGK-MiGeL müssen alle Angaben — insbesondere klinische Evidenz, Preise, Tarife und regulatorische Aussagen — durch qualifizierte Fachpersonen (Regulatory Affairs, Gesundheitsökonomie, klinische Experten) geprüft und verantwortet werden.

This step is not optional.

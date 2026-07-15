---
name: hta-quality-check
description: >-
  Score and consistency-check a drafted HTA application or report before
  submission. Use when the user asks to review, score, evaluate, quality-check,
  or check the consistency of a MiGeL application, Analysenliste form, Antrag
  neue Leistung, Meldung neue Leistung, Umstrittenheitsabklärung, or an
  EurHTA/EUnetHTA report (German triggers: Qualitätsprüfung, Bewertung,
  Konsistenzprüfung, Vollständigkeitsprüfung, einreichungsbereit?; English:
  quality check, readiness review, submission readiness, scoring, cross-chapter
  consistency). Applies the BAG/ELGK scoring rubrics and cross-section
  consistency checks manually — module scores, WZW assessment, critical
  issues, readiness level — and writes a structured review report next to the
  reviewed document.
metadata:
  jurisdiction: ch
  languages: [de, en]
  last-verified: 2026-07-15
---

# HTA Quality Check (scoring + consistency)

Manually evaluate a drafted HTA document against the official Swiss rubrics. You — the agent — are the evaluator: read the document, apply the rubric criteria yourself, and justify every score with evidence quoted or referenced from the document. Do not delegate the judgment to any external scoring service.

## Step 1 — Identify the document and its type

Locate the document to review. Default locations in a dossier: `applications/ch/<form>/<lang>.md` or `chapters/*.md` (for report-level reviews). If the user did not name a file, list the candidates and ask.

Determine the document type — it selects the rubric:

| Document type | Quality rubric | Also run consistency? |
|---|---|---|
| MiGeL application | `references/rubrics/ch-migel.md` | yes |
| Analysenliste form | `references/rubrics/ch-analysenliste.md` | yes |
| Antrag neue Leistung | `references/rubrics/ch-antrag-neue-leistung.md` | yes |
| Meldung neue Leistung | `references/rubrics/ch-meldung-neue-leistung.md` | yes |
| Umstrittenheitsabklärung | `references/rubrics/ch-umstrittenheit.md` | yes |
| EurHTA / chapter set | (no form rubric) | consistency only |

The consistency rubric for all types is `references/rubrics/consistency.md`.

Review language follows the document: German for BAG forms, English for EurHTA reports, unless the user asks otherwise.

## Step 2 — Gather context

Read alongside the document, where present in the dossier:

- `dossier.yaml` — intervention description and notes, to judge whether the form reflects the actual intervention.
- `prisma/prisma-diagram.md` and `prisma/included-studies.json` — to verify PRISMA counts and citations in the document against the actual literature data.
- `models/runs/*.json` — to verify that economic figures in the document match the engine outputs. Never recompute model results yourself; compare against the run files only (regeneration is done with the `packages/heor-engine` scripts, `npx tsx <script>`, if the user asks).

Context files may be absent; then evaluate the document on its own terms and note the missing cross-checks as limitations.

## Step 3 — Apply the quality rubric

Read the applicable rubric file completely and score every dimension, module/section, and (where defined) WZW or dispute category it lists. For each score:

- Cite concrete evidence from the document (section number, quoted fragment) — no unexplained numbers.
- Check the rubric's "critical issues" list explicitly; a critical issue must appear in the report even if the affected section otherwise scores well.
- Systematically hunt for unresolved placeholders (`[Bitte hier eintragen]`, `{{...}}`, `[Veuillez compléter]`, `[Da compilare]`, empty table cells) — these are always at least a missing-field finding.
- Verify data against the dossier: PRISMA counts in the form vs. `prisma/`, economic figures vs. `models/runs/`, intervention facts vs. `dossier.yaml`. Any mismatch is a critical issue.

## Step 4 — Apply the consistency rubric

Read `references/rubrics/consistency.md`, pick the document-type-specific check block, and work through it plus the general principles. Focus on cross-section agreement: comparator and population definitions, PICOT (for Antrag), repeated numerical values, terminology, CE/regulatory status, and citation-reference integrity. Score consistency 1–10 on the applicable scale (German rubric for BAG forms).

## Step 5 — Write the review report

Write a structured Markdown report next to the reviewed document as `<name>.review.md` (e.g., `applications/ch/migel/de.review.md`); do not modify the reviewed document itself. If a review already exists, write a new dated one or diff — never blind-overwrite. Structure:

1. **Header:** document reviewed, date, rubrics applied.
2. **Scores at a glance:** overall quality score, consistency score, readiness level — as a table.
3. **Dimension / module / section scores:** table per the rubric's output structure, each with a one-line justification.
4. **WZW / dispute-category assessment** (where the rubric defines one).
5. **Critical issues** — must-fix before submission.
6. **Missing fields / open placeholders** — exhaustive list.
7. **Consistency findings** — per-section issues, recommendations, strengths.
8. **Recommendations** — prioritized, specific, actionable.

Summarize the top findings to the user in chat (scores, readiness level, the 3–5 most important fixes).

## Step 6 — Mandatory expert review disclaimer

End the report with, and repeat to the user:

> **Hinweis / Disclaimer:** Diese Bewertung wurde automatisiert erstellt und ist eine Entscheidungshilfe, keine behördliche oder fachliche Prüfung. Scores und Bereitschaftseinschätzung ersetzen nicht die Beurteilung durch qualifizierte Fachpersonen; vor einer Einreichung beim BAG/ELGK/EAMGK ist eine Expertenprüfung zwingend.

This step is not optional.

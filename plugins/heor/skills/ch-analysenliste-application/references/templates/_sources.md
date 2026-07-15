# Template sources — Analysenliste notification form (Meldeformular)

Official form: «Meldung einer neuen Laboranalyse zur Prüfung der Leistungspflicht der obligatorischen Krankenpflegeversicherung (OKP)» / «Déclaration d'une nouvelle analyse de laboratoire en vue de l'évaluation de sa prise en charge par l'assurance obligatoire des soins (AOS)», published by the Swiss Federal Office of Public Health (BAG/OFSP) for the EAMGK-AL / CFAMA-LA.

Landing pages (language-parallel):
- de: https://www.bag.admin.ch/de/antragsprozesse-analysenliste
- fr: https://www.bag.admin.ch/fr/demande-dadmission-dans-la-liste-des-analyses
- it: https://www.bag.admin.ch/it/procedure-di-domanda-elenco-delle-analisi

| Template | Source document | Document version | Source URL | Fetched | Converted with |
| --- | --- | --- | --- | --- | --- |
| `de.md` | `02_Meldeformular Analysenliste_2025.docx` | Version März 2025 (page updated 18.07.2025) | https://www.bag.admin.ch/dam/de/sd-web/EJ3iaVhE498E/02_Meldeformular%20Analysenliste_2025.docx | 2026-07-15 | markitdown (docx → markdown), manual re-annotation |
| `fr.md` | `02_Formulaire d'annonce liste des analyses_2025.docx` | Version mars 2025 (page updated 18.07.2025) | https://www.bag.admin.ch/dam/fr/sd-web/EJ3iaVhE498E/02_Formulaire%20d%27annonce%20liste%20des%20analyses_2025.docx | 2026-07-15 | markitdown (docx → markdown), manual re-annotation |
| `it.md` | — not provided | — | — | 2026-07-15 | — |

## Italian language gap

BAG does not publish an Italian version of the Analysenliste notification form. The Italian landing page (`/it/procedure-di-domanda-elenco-delle-analisi`) links `/dam/it/sd-web/EJ3iaVhE498E/02_Formulaire%20d%27annonce%20liste%20des%20analyses_2025.docx`, which is byte-identical (same MD5, `ba90415696f0aafca735d9876b8ed596`) to the French file served from `/dam/fr/...`. Per repository policy no machine translation was created; Italian drafts should follow the French structure and be flagged for verification (see SKILL.md Step 0).

## Notes

- This skill templates the **Meldeformular** (notification form), which is the form its workflow drafts. The BAG pages also host a separate **Antragsformular** («01_Antragsformular Analysenliste_2025.docx», de: https://www.bag.admin.ch/dam/de/sd-web/YIJup1RUY3RF/01_Antragsformular%20Analysenliste_2025.docx ; fr: `01_Formulaire de requête liste des analyses_2025.docx`, same id `YIJup1RUY3RF`) plus an Anhang-1 position template (id `7xQ1RN4bSOWM`), which are not templated here.
- The official form's trailing "Redaktionelle Hilfe" / "Aide à la rédaction" section (guidance, glossary) is not reproduced in the templates; its field-level expectations are captured in SKILL.md Step 3 guidance.

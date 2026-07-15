# Template sources — MiGeL application form (Antragsformular)

Official form: «Antrag auf Aufnahme ... auf die Mittel- und Gegenständeliste (MiGeL) oder Anpassung ...» / «Demande d'inscription ou de modification ... sur la liste des moyens et appareils (LiMA)», published by the Swiss Federal Office of Public Health (BAG/OFSP).

Landing pages (language-parallel):
- de: https://www.bag.admin.ch/de/antragsprozesse-mittel-und-gegenstaendeliste
- fr: https://www.bag.admin.ch/fr/admission-dans-la-liste-des-moyens-et-appareils
- it: https://www.bag.admin.ch/it/procedure-di-domanda-elenco-dei-mezzi-e-degli-apparecchi

| Template | Source document | Document version | Source URL | Fetched | Converted with |
| --- | --- | --- | --- | --- | --- |
| `de.md` | `MiGeL_Antragsformular_DE_06_2025.docx` | June 2025 (page updated 22.07.2025) | https://www.bag.admin.ch/dam/de/sd-web/Jao7hZuPal5t/MiGeL_Antragsformular_DE_06_2025.docx | 2026-07-15 | markitdown (docx → markdown), manual re-annotation |
| `fr.md` | `LiMA_Formulaire de demande_FR_06_2025.docx` | June 2025 (page updated 22.07.2025) | https://www.bag.admin.ch/dam/fr/sd-web/Jao7hZuPal5t/LiMA_Formulaire%20de%20demande_FR_06_2025.docx | 2026-07-15 | markitdown (docx → markdown), manual re-annotation |
| `it.md` | — not provided | — | — | 2026-07-15 | — |

## Italian language gap

BAG does not publish an Italian version of the MiGeL application form. The Italian landing page (`/it/procedure-di-domanda-elenco-dei-mezzi-e-degli-apparecchi`) links `/dam/it/sd-web/Jao7hZuPal5t/LiMA_Formulaire%20de%20demande_FR_06_2025.docx`, which is byte-identical (same MD5, `d4ebcef0dde741480aa0215d4c4c4080`) to the French file served from `/dam/fr/...`. The same applies to the MiGeL notification form (`Meldeformular`, document id `JaKukg5FFPyx`): the Italian page serves the French file. Per repository policy no machine translation was created; Italian drafts should follow the French structure and be flagged for verification (see SKILL.md Step 0).

## Notes

- Section 5.6.5 (model-parameter source table) in `de.md`/`fr.md` is a skill-added annex, not part of the official form; it is marked as such inline.
- The official form carries no version string in the document body ("Datum der Version" is filled by the applicant); the version above is taken from the filename and the BAG page metadata.
- Related official material (not templated): Handbuch zum Antragsformular «Mittel und Gegenstände», Version Juni 2025 — https://www.bag.admin.ch/dam/de/sd-web/UxXTVdp7seTq/Handbuch_Antragsformular_MiGeL_06_2025.pdf (fr: Manuel_utilisation_formulaire de demande LiMA_06_2025.pdf, same id `UxXTVdp7seTq`).

# Template sources — KLV/OKP service forms (Antragsprozesse Allgemeine Leistungen)

Official forms published by the Swiss Federal Office of Public Health (BAG/OFSP/UFSP) for the ELGK/CFPP.

Landing pages (language-parallel):
- de: https://www.bag.admin.ch/de/antragsprozesse-allgemeine-leistungen
- fr: https://www.bag.admin.ch/fr/processus-de-demande-pour-prestations-generales
- it: https://www.bag.admin.ch/it/procedure-di-domanda-prestazioni-generali

All files fetched 2026-07-15 and converted with markitdown (docx → markdown), then manually re-annotated with `{{slot}}` placeholders.

## meldung-neue-leistung (Meldeformular / Formulaire de déclaration)

| Template | Source document | Form version | Source URL |
| --- | --- | --- | --- |
| `de.md` | `03_Meldeformular.docx` | Version 22.07.2025 (page updated 18.03.2026) | https://www.bag.admin.ch/dam/de/sd-web/w4J99R2SPg4E/03_Meldeformular.docx |
| `fr.md` | `03_Formulaire de déclaration.docx` | Version 22.07.2025 | https://www.bag.admin.ch/dam/fr/sd-web/w4J99R2SPg4E/03_Formulaire%20de%20d%C3%A9claration.docx |
| `it.md` | — not provided | — | — |

## antrag-neue-leistung (Antragsformular / Formulaire de demande)

| Template | Source document | Form version | Source URL |
| --- | --- | --- | --- |
| `de.md` | `04_Antragsformular.docx` | Version 22.07.2025 (page updated 05.08.2025) | https://www.bag.admin.ch/dam/de/sd-web/l1YXE04TKni8/04_Antragsformular.docx |
| `fr.md` | `04_Formulaire de demande.docx` | Version 22.07.2025 | https://www.bag.admin.ch/dam/fr/sd-web/l1YXE04TKni8/04_Formulaire%20de%20demande.docx |
| `it.md` | — not provided | — | — |

## umstrittenheit (Formular Umstrittenheitsabklärung / Formulaire clarification du caractère controversé / Formulario chiarificazione del carattere controverso)

| Template | Source document | Form version | Source URL |
| --- | --- | --- | --- |
| `de.md` | `02_Formular_Umstrittenheitsabklärung.docx` | Version 22.07.2025 (page updated 05.08.2025) | https://www.bag.admin.ch/dam/de/sd-web/Un4CMYjEeoAX/02_Formular_Umstrittenheitsabkl%C3%A4rung.docx |
| `fr.md` | `02_Formulaire clarification du caractère controversé.docx` | Version 22 juillet 2025 | https://www.bag.admin.ch/dam/fr/sd-web/Un4CMYjEeoAX/02_Formulaire%20clarification%20du%20caract%C3%A8re%20controvers%C3%A9.docx |
| `it.md` | `02_Formulario chiarificazione del carattere controverso.docx` | Versione 22.07.2025 | https://www.bag.admin.ch/dam/it/sd-web/Un4CMYjEeoAX/02_Formulario%20chiarificazione%20del%20carattere%20controverso.docx |

## Italian language gap (Meldeformular and Antragsformular)

BAG publishes the **Umstrittenheit** form in all three languages, but **no Italian version** of the Meldeformular (`03`) or the Antragsformular (`04`): the Italian landing page links `/dam/it/sd-web/w4J99R2SPg4E/03_Formulaire%20de%20déclaration.docx` and `/dam/it/sd-web/l1YXE04TKni8/04_Formulaire%20de%20demande.docx`, which are byte-identical to the French files (MD5 `f1c0faecda7100e16ef555da0dcac94d` and `7b316d37f4ce0f8bc9e9945a1aa2cef0` respectively, same as `/dam/fr/...`). Per repository policy no machine translation was created; Italian drafts of these two forms should follow the French structure and be flagged for verification (see SKILL.md Step 1).

## Notes

- Slot names (`{{...}}`) are identical across the language variants of each form so the skill fills them uniformly.
- The official forms embed extensive italic guidance text; the templates reproduce it as `> *...*` blockquotes where it is needed to fill the field correctly.
- Related official material (not templated): «05_Erläuterungen zum Antragsformular_07.2025.docx» (id `3Lk8HhJxJanw`), «Formular Interessenkonflikte» (id `2yJjpSFEJ59p`), WZW-Operationalisierung (id `dmmbS5sv9sve`).

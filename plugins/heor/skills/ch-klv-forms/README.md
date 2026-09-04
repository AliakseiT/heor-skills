# ch-klv-forms

Drafts three Swiss BAG/OKP service forms: Meldung neue Leistung
(notification), Antrag neue Leistung (full application), and
Umstrittenheitsabklarung (dispute).

## When to use

- "Draft the KLV Antrag"
- "File a Meldung neue Leistung"
- "Write an Umstrittenheit form"
- "Swiss new service application"

## What it produces

`applications/ch/klv/<form>/<lang>.md` — one of three forms, each with its
own template:

| Form | Purpose | Template |
|---|---|---|
| Meldung neue Leistung | Preliminary notification of a new service | `references/templates/meldung-neue-leistung/` |
| Antrag neue Leistung | Full application for KLV Anhang 1 listing | `references/templates/antrag-neue-leistung/` |
| Umstrittenheitsabklarung | Dispute of an existing coverage decision | `references/templates/umstrittenheit/` |

All forms assess against WZW criteria (effectiveness, appropriateness,
economic efficiency). Economic figures come from `models/runs/`.

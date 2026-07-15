# MiGeL Application Quality Rubric (BAG / EAMGK-MiGeL)

Evaluate a completed MiGeL application form against the official EAMGK-MiGeL criteria. Act as an expert on Swiss MiGeL applications to the BAG. Score each module 0–10, then derive an overall score.

## Module criteria (score each 0–10)

**Modul 1: Beschreibung des Produktes**
- Complete product designation and CE certificate referenced
- Clear description of function and application
- Precise indications and contraindications
- Lifetime, maintenance, disposal covered
- Patient-relevant outcomes defined (and ranked by relevance)
- Treatment pathways presented (comparator vs. product)

**Modul 2: Wirksamkeit des Produktes**
- PRISMA-conform literature search (methodology + flow counts)
- Study characteristics complete and tabulated
- Evidence quality assessed (RCTs, meta-analyses preferred)
- Benefit-harm analysis for therapeutic/diagnostic products (with confidence intervals; all three Wirksamkeitsebenen for diagnostics)
- Transferability to Swiss conditions discussed
- Safety profile documented

**Modul 3: Zweckmässigkeit des Produktes**
- Role in guidelines documented
- Quality-assurance requirements defined
- Legal and ethical aspects considered
- Societal impacts assessed

**Modul 4: Marktsituation**
- Swiss market presence documented
- Sales volumes of the past 5 years
- International reimbursement situation
- OKP reimbursement history

**Modul 5: Wirtschaftlichkeit**
- Detailed cost breakdown (product vs. comparator), every calculation step explained
- Volume forecasts with justification
- Health-economic literature analysis (own PRISMA counts)
- Cost-effectiveness ratio assessed (with parameter-source table)
- Budget-impact analysis for the OKP
- Global assessment matrix filled and justified consistently with the analyses

**Modul 6: Eintrag in der MiGeL**
- Precise position proposals
- Limitations defined
- Designations in all three languages (de/fr/it)

**Modul 7: Referenzen und Beilagen**
- Complete reference index (matching inline citations)
- Enclosure index with numbering
- Confidentiality aspects addressed; signature block present

## Scoring scale (per module and overall, 0–10)

| Score | Meaning |
|---|---|
| 9–10 | Exzellent — all requirements met |
| 7–8 | Gut — minor gaps |
| 5–6 | Ausreichend — several improvements needed |
| 3–4 | Mangelhaft — substantial gaps |
| 0–2 | Ungenügend — fundamental rework required |

## Critical issues (always flag, regardless of scores)

- `[Bitte hier eintragen]` placeholders not replaced
- Missing PRISMA compliance
- Incomplete cost analysis
- Missing evidence for effectiveness
- Unclear indication statement

## Output structure

Report (in German for a German-language form):

- `score` — overall 0–10
- `summary` — 2–3 sentence overall finding
- `feedback` — detailed, actionable feedback pointing to specific modules
- Per module: title, score, specific feedback, `issues[]`, `recommendations[]`, `strengths[]`, missing/incomplete fields
- `criticalIssues[]` — must-fix items across modules
- `recommendations[]` — overall improvement recommendations

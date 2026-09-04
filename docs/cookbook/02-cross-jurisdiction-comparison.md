# Recipe 02: Cross-jurisdiction comparison

Compare reimbursement pathways and tariff codes across CH, DE, FR, US for
the same product.

## Scenario

You have a digital therapeutic and want to know which countries offer the
fastest and most rigorous market-access routes.

## Steps

### 1. Compare pathways

```bash
echo '[
  {"jurisdiction": "ch", "category": "digital-health", "riskClass": "IIa", "hasAI": true},
  {"jurisdiction": "de", "category": "digital-health", "riskClass": "IIa", "hasAI": true},
  {"jurisdiction": "fr", "category": "digital-health", "riskClass": "IIa", "hasAI": true},
  {"jurisdiction": "us", "category": "digital-health", "riskClass": "IIa", "hasAI": true}
]' | npx tsx plugins/heor/skills/regulation-navigator/scripts/evaluate.ts
```

The script outputs a comparison block with the fastest vs. most rigorous
pathway and a sequencing recommendation.

### 2. Search for existing codes in each country

```bash
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "depression digital therapy" --jurisdiction ch

npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "depression digital therapy" --jurisdiction de
```

Repeat for fr and us. Classify hits per country: exact code, similar
product, or gap.

### 3. Decision matrix

Build a table:

| Country | Pathway | Timeline | Existing code? | Action |
|---|---|---|---|---|
| CH | dGA fast-track | 3-6 months | No | File MiGeL application |
| DE | DiGA BfArM | 12 months | Yes (DiGA listed) | Check if product qualifies |
| FR | LPP CNAM | 12-18 months | No | File LPP application |
| US | CMS coverage | 18-24 months | Partial (HCPCS) | Seek coverage determination |

The regulation-navigator output gives you the pathway names and timelines.
The tariff-scout output tells you whether existing codes cover the product.

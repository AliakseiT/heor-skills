# Recipe 05: Tariff search and gap analysis

Search reimbursement lists for existing codes, classify hits, and decide
whether to bill an existing code or file a new application.

## Scenario

You have a new medical device and want to know if an existing reimbursement
code already covers it, or if you need to file a new application.

## Steps

### 1. Extract search terms

Identify the device name, its function, synonyms, and the local-language
term. Swiss lists are in German, French, and Italian, so try the German or
French term too.

### 2. Search

```bash
# English term
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "blood pressure monitor" --jurisdiction ch --limit 10

# German term (often better for MiGeL)
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "Blutdruckmessgeraet" --jurisdiction ch --limit 10

# French term
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "tensiomètre" --jurisdiction ch --limit 10

# Narrow to one list
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "Blutdruckmessgeraet" --jurisdiction ch --list ch/migel --lang de

# Machine-readable output
npx tsx plugins/heor/skills/tariff-scout/scripts/search.ts \
  --query "Blutdruckmessgeraet" --jurisdiction ch --json
```

### 3. Classify hits

The search script returns ranked results. Classify them:

- **Exact match:** A listed code that already covers this exact product.
  High score, name clearly the same thing. Action: bill under this code.
- **Similar / analogous:** Listed items in the same category. Useful as
  pricing anchors and precedent. Action: new application likely needed.
- **Gap:** The function appears unlisted. Action: file a new application.

### 4. Decision

| Classification | Action |
|---|---|
| Exact code exists | Bill under it. Report code, list, price, limitations. |
| Only analogs exist | File a new application. Cite analogs as precedent. |
| No data for jurisdiction | Run the data pipeline first, then search. |

### 5. Hand off to the application skill

If a new application is needed:

- MiGeL (devices and aids): trigger `ch-migel-application`
- Analysenliste (laboratory tests): trigger `ch-analysenliste-application`
- KLV (new service): trigger `ch-klv-forms`

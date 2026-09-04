# tariff-scout

Searches official reimbursement lists for existing codes and comparable
products. Helps decide whether to bill an existing code or file a new
application.

## When to use

- "Is there already a reimbursement code for our product?"
- "What do comparable devices bill under?"
- "Find similar products in the MiGeL"
- "Search for glucose monitor codes in HCPCS"

## What it produces

Ranked search hits classified as exact matches, similar/analogous products,
or gaps. Each hit includes the code, list name, price/tariff, and
limitations.

## Key script

```bash
npx tsx scripts/search.ts --query "depression app" --jurisdiction ch --limit 10
```

Search is lexical (no embeddings). Runs over the normalized JSON in
`data/<jurisdiction>/<list>/<version>/`.

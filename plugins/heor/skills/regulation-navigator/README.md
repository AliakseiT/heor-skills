# regulation-navigator

Maps a medical device or digital-health product to its market-access
pathway across Switzerland, Germany, France, the UK, and the USA.

## When to use

- "How do we get reimbursed in Switzerland?"
- "Which regulatory pathway applies to our device?"
- "Compare CH and DE market-access routes"
- "What prerequisites does a DiGA listing need?"

## What it produces

A pathway evaluation with: pathway name, authority, status (fast-track or
standard), timeline, key stopper, prerequisites vs. deliverables, warnings,
and country insights. For multi-jurisdiction queries, a comparison block.

## Key script

```bash
npx tsx scripts/evaluate.ts --jurisdiction ch --category digital-health --riskClass IIa --hasAI
```

Rules are pure data in `references/rules.json` (versioned, last verified
2025-12-10). The script evaluates them deterministically.

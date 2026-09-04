# Recipe 04: Literature review to HTA report

Run a PRISMA systematic review, then draft a EUnetHTA Core Model HTA report
chapter by chapter.

## Scenario

You need a full HTA report for a EUnetHTA submission, grounded in a
systematic literature review.

## Steps

### 1. Run the PRISMA review

```
Prompt: "Run a systematic literature review for this dossier."
```

The prisma-review skill walks through all six steps. When done, you have:
`prisma/pico.yaml`, `prisma/queries.yaml`, `prisma/search-results.json`,
`prisma/screening.json`, `prisma/included-studies.json`,
`prisma/prisma-diagram.md`, and `chapters/05-literature-research.en.md`.

### 2. Build the economic model (if needed)

```
Prompt: "Build a cost-effectiveness model and run it."
```

The HTA report's Economic Evaluation chapter (08) needs model results.
See recipe 03 for details.

### 3. Draft the report chapters

```
Prompt: "Draft the HTA report."
```

The eurhta-report skill drafts chapters in dependency order: Literature
Research (05) first, then 02, 03, 04, 06, 07, 08, 09, 10, 11, 12, 13, and
the Executive Summary (01) last. Each chapter reads PRISMA numbers, economic
results, and included studies from the dossier.

You can also draft individual chapters:

```
Prompt: "Draft the clinical effectiveness chapter."
```

### 4. Verify consistency

```
Prompt: "Check consistency across all chapters."
```

The hta-quality-check skill verifies that comparator naming is consistent,
PRISMA counts in chapters 05/06 match the diagram, and ICER/BIA figures in
chapters 01, 08, 13 match `models/runs/`.

## Output

```
chapters/
  01-executive-summary.en.md
  02-introduction-and-problem-description.en.md
  03-technology-description.en.md
  04-health-problem-and-current-use.en.md
  05-literature-research.en.md
  06-clinical-effectiveness.en.md
  07-safety.en.md
  08-economic-evaluation.en.md
  09-ethical-aspects.en.md
  10-organisational-aspects.en.md
  11-social-aspects.en.md
  12-legal-aspects.en.md
  13-discussion-and-conclusions.en.md
```

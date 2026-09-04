# Recipe 01: MiGeL application from scratch

The full Swiss MiGeL listing pipeline, end to end.

## Scenario

You have a Class IIa medical device and want to file a MiGeL application
for reimbursement in Switzerland.

## Prerequisites

- A dossier directory with a `dossier.yaml` describing your product
- Claude Code with the heor plugin loaded

## Steps

### 1. Determine the pathway

```
Prompt: "Which market-access pathway applies to this device in Switzerland?"
```

This triggers regulation-navigator. It runs `scripts/evaluate.ts` with
your jurisdiction and category, and reports the pathway name, authority,
status, timeline, and prerequisites. For a digital health app targeting
Switzerland, expect the dGA MiGeL fast-track.

### 2. Check for existing codes

```
Prompt: "Are there existing Swiss reimbursement codes for our type of product?"
```

This triggers tariff-scout. It runs `scripts/search.ts` over the MiGeL and
Analysenliste data and classifies hits as exact, similar, or gaps. If an
exact code exists, you may not need a new application.

### 3. Build the evidence base

```
Prompt: "Run a systematic literature review for this dossier."
```

This triggers prisma-review. Six steps, each producing files under `prisma/`:
PICO, queries, search results, screening, flow diagram, narrative synthesis.
The skill pauses for your confirmation at PICO, queries, and screening.

### 4. Build the economic model

```
Prompt: "Build a cost-effectiveness model and run it."
```

This triggers economic-modeling. It selects a model type, populates
parameters from your literature and documents with source tracking, and
runs the engine CLI. Output: `models/inputs/<model>.json` and
`models/runs/<date>-<model>.json`.

### 5. Add sensitivity analysis

```
Prompt: "Add a PSA to the model."
```

The skill adds a `psa` block to the inputs file and runs `run-psa.ts`.
Output: `models/runs/<date>-<model>-psa.json` with ICER distribution, CEAC
curve, and tornado diagram.

### 6. Draft the application

```
Prompt: "Draft the MiGeL application in German."
```

This triggers ch-migel-application. It reads your dossier, PRISMA results,
and model runs, and fills the 7-module template. Output:
`applications/ch/migel/de.md`.

### 7. Quality check

```
Prompt: "Quality-check the MiGeL draft."
```

This triggers hta-quality-check. It reads the drafted application and
scores it against the BAG rubric (0-10 per module), checks consistency
(PRISMA counts, economic figures vs. model runs), and writes a review
file.

## Verification

- Every economic number in the application traces to a `models/runs/` file
- PRISMA counts match `scripts/prisma-counts.ts` output
- No template placeholders remain unfilled (or are explicitly listed)
- The application ends with the expert-review disclaimer

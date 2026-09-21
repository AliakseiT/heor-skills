# jev-screen

Jev-powered abstract screening for `prisma-review` step 4. One atomic yes/no
judgment per PICO dimension, composed in code to
`include`/`exclude`/`maybe`.

```bash
# needs TYPESAFE_API_KEY (https://console.typesafe.ai/)
npx tsx scripts/jev-screen.ts --dossier <dossier-dir> --dry-run   # preview battery
npx tsx scripts/jev-screen.ts --dossier <dossier-dir> --limit 25  # pilot batch
npx tsx scripts/jev-screen.ts --dossier <dossier-dir>             # full run (resumes)
npx tsx scripts/jev-screen.ts --self-test                        # offline unit checks
```

Reads `prisma/pico.yaml` + `prisma/search-results.json`; writes
`prisma/screening.json` (dossier schema) and `prisma/screening-probs.json`
sidecar. `maybe` records need human resolution before the PRISMA diagram.

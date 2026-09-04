# Contributing to HEOR Skills

Thanks for your interest. This repo welcomes contributions that add
skills, fix data pipeline issues, or improve the economic engine.

## Quick start

```bash
git clone https://github.com/AliakseiT/heor-skills.git
cd heor-skills
pnpm install

# Verify everything works
pnpm -r test              # engine characterization tests
pnpm -r typecheck         # strict tsc
npx vitest run --config vitest.config.ts  # all 71+ tests
```

## What you can contribute

| Area | Where | How |
|---|---|---|
| New skill | `plugins/heor/skills/<name>/SKILL.md` | Follow an existing skill's structure (frontmatter, references, scripts) |
| Engine calculator | `packages/heor-engine/src/ce-models.ts` | Add a function, export it, write characterization tests |
| Data pipeline | `tools/data-pipeline/normalizers/` | Add a normalizer + schema, register in `sources.json` |
| Bug fix | anywhere | Reproduce with a test, fix, verify all tests pass |
| Documentation | `docs/cookbook/`, READMEs, SKILL.md | Keep it accurate, remove stale content |

## Rules (from CONVENTIONS.md)

1. **Country first, language second.** Data and templates are organized
   by jurisdiction. Language is a variant, not the primary axis.
2. **The engine does the math.** Skills must never compute economic
   model results. Always delegate to `@heor/engine` CLI scripts.
3. **No servers, no databases.** Markdown, JSON, and dependency-free
   TypeScript only.
4. **Data files are regenerated, never hand-edited.** Fix the pipeline,
   not the data.
5. **Drafts, not submissions.** Every skill that drafts regulatory
   content ends with a human-review disclaimer.
6. **Behavior changes require test changes.** Engine calculators are
   pinned by characterization tests — change the test in the same commit.

## Pull request checklist

- [ ] Tests pass: `npx vitest run --config vitest.config.ts`
- [ ] Typecheck passes: `pnpm --filter @heor/engine typecheck`
- [ ] No new runtime dependencies in `@heor/engine` (zero-dependency policy)
- [ ] New data files have a schema in `tools/data-pipeline/schemas/`
- [ ] New skills have a `SKILL.md` with frontmatter (`name`, `description`, `metadata`)
- [ ] Documentation updated if behavior changed

## Commit messages

Keep them short and imperative:

```
Add UK NICE pathway to regulation-navigator
Fix HMV normalizer for empty product descriptions
Implement partitioned survival Weibull curve
```

## License

By contributing you agree your work is licensed Apache-2.0.

# Jev Question Battery

How `scripts/jev-screen.ts` turns the confirmed PICO into Jev `noul`
questions. One narrow judgment per dimension, asked together in one request
per record, evaluated in parallel. Code composes; the model only judges.

## The questions

| id | asked when | instruction |
| --- | --- | --- |
| `population` | always | patients/problem/population in `item.text` matches ALL of the PICO population |
| `investigated` | always | investigated condition matches ALL of the PICO intervention |
| `outcome` | always | an outcome matching ANY of the PICO outcomes is reported |
| `comparison` | comparison text present | the comparator matches ANY of the PICO comparison, **or is unspecified** (common in abstracts — yes); no only on a clearly different comparator |
| `timing` | `--timing` given | timing consistent with ALL of the given text |
| `study_type` | `--study-type` given | study type matches; pilots of that type count as yes; protocols/reviews/editorials/case reports count as no |
| `no_primary_data` | always | protocol/review/editorial/case report with no primary results |

`item.text` is `title + abstract`. Empty optionals are skipped, never judged —
there is no question the model could answer honestly about them.

## Composition (in code, not in the model)

Thresholds `--low`/`--high` (default 0.4/0.6). Per dimension: at or below
low counts as NO, at or above high as YES, between is borderline.

- `no_primary_data` ≥ high → `exclude` (protocol/review/case report).
- Any borderline dimension → `maybe` (human decides).
- Any NO dimension, rest YES → `exclude` with per-dimension reasons.
- All YES → `include`.

Narrower bands decide more automatically; wider bands send more to the
reviewer. Tune on labeled data, not by feel: the `--self-test` path pins the
matrix, and pilot `--limit` batches show the real `maybe` rate before a full
run.

## Why this shape

A broad "does this match the PICO?" question hides five judgments behind one
answer and drifts between batches. Atomic questions stay stable across
thousands of records, their probabilities are comparable and sortable, and
changing policy (a threshold, the comparison rule) is a code edit, not a
prompt rewrite. See https://docs.typesafe.ai/concepts/how-to-build-with-system-one
for the underlying guidance.

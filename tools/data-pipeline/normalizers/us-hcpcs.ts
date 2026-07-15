/**
 * Normalizer: us/hcpcs — US HCPCS Level II codes, CMS.
 *
 * STATUS: scaffold — not yet implemented.
 *
 * Source: quarterly ZIP archives from
 * https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system/quarterly-update
 * (e.g. hcpc2025_oct_anweb_v4.zip, containing the main Excel workbook).
 * Download links are versioned per quarter — verify per release (see sources.json).
 *
 * Format (from the upstream ingest script): the largest .xlsx in the ZIP,
 * with "HCPCS Code" and "Long Description" columns; codes match /^[A-Z]\d{4}$/,
 * first letter = category.
 *
 * TODO when implementing:
 *  1. Add ZIP extraction (devDep adm-zip) + reuse the xlsx devDependency.
 *  2. Planned shape: index.json entries { code, category } — the code file
 *     carries no prices (fee schedules are separate CMS datasets) — and
 *     en.json labels { name (long description), shortName }.
 *  3. Version from the quarter in the filename (YYYY-MM).
 *
 * No Firestore, no embeddings (stripped by design — CONVENTIONS.md §2).
 */
import { NotImplementedError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

export async function normalize(_ctx: NormalizeContext): Promise<NormalizeResult> {
  throw new NotImplementedError(
    'us/hcpcs: normalizer is scaffolded but not implemented. ' +
      'Provide the CMS quarterly ZIP with --local once implemented (see sources.json).'
  );
}

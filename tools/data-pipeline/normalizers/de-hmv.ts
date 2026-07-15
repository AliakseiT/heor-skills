/**
 * Normalizer: de/hmv — German Hilfsmittelverzeichnis (HMV), GKV-Spitzenverband.
 *
 * STATUS: scaffold — not yet implemented.
 *
 * Source: XML inside a ZIP archive, published on
 * https://hilfsmittel.gkv-spitzenverband.de/ (download link is versioned,
 * e.g. YYYYMMDD_HMV.zip — verify the stable download path, see sources.json).
 *
 * Format (from the upstream ingest script): root element hv:HMV with
 * hv:HMV_GRUPPE / hv:HMV_ORT / hv:HMV_UNTERGRUPPE / hv:HMV_ART / hv:HMV_PRODUKT
 * levels; the 10-digit product code is GG.OO.UU.APPP
 * (e.g. 01.24.01.0001). Each level carries hv:BEZEICHNUNG plus optional
 * hv:INDIKATION and hv:QUALITAETSSTANDARD; placeholder products are named
 * "Nicht besetzt" and must be skipped.
 *
 * TODO when implementing:
 *  1. Add ZIP + XML parsing. Keep dependencies minimal (e.g. devDeps adm-zip +
 *     fast-xml-parser at the workspace root, like the upstream script used).
 *  2. Planned shape: index.json { hierarchy: [{id, level, parent}], entries:
 *     [{ code, parent }] } — the HMV carries no prices — and de.json labels
 *     { name, indication, qualityStandard } for hierarchy nodes and products.
 *  3. Version from the archive filename date (YYYY-MM).
 *
 * No Firestore, no embeddings (stripped by design — CONVENTIONS.md §2).
 */
import { NotImplementedError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

export async function normalize(_ctx: NormalizeContext): Promise<NormalizeResult> {
  throw new NotImplementedError(
    'de/hmv: normalizer is scaffolded but not implemented. ' +
      'Provide the HMV XML ZIP with --local once implemented (see sources.json).'
  );
}

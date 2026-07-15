/**
 * Normalizer: fr/lpp — French Liste des Produits et Prestations (LPP), Assurance Maladie.
 *
 * STATUS: scaffold — not yet implemented.
 *
 * Source: DBF files inside a ZIP archive (LPP<nnn>.zip) published via the
 * Assurance Maladie codage portal
 * (http://www.codage.ext.cnamts.fr/codif/tips//telecharge/index_tele.php?p_site=AMELI).
 * The archive number increments per release — verify the exact download URL
 * per release (see sources.json).
 *
 * Format (from the upstream ingest script): two DBF tables —
 *   *fiche*.dbf : CODE_TIPS (code), NOM_COURT (short name), DATE_FIN (end of validity)
 *   *histo*.dbf : CODE_TIPS, TARIF (EUR), DEBUTVALID / FINHISTO (price validity window)
 * Active price = most recent DEBUTVALID whose FINHISTO is empty or in the future.
 *
 * TODO when implementing:
 *  1. Add ZIP + DBF parsing (devDeps adm-zip + dbffile at the workspace root,
 *     like the upstream script used).
 *  2. Planned shape: index.json entries { code, tariff, currency: "EUR",
 *     validUntil } and fr.json labels { name }.
 *  3. Version from the archive number or release date (YYYY-MM).
 *
 * No Firestore, no embeddings (stripped by design — CONVENTIONS.md §2).
 */
import { NotImplementedError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

export async function normalize(_ctx: NormalizeContext): Promise<NormalizeResult> {
  throw new NotImplementedError(
    'fr/lpp: normalizer is scaffolded but not implemented. ' +
      'Provide the LPP<nnn>.zip with --local once implemented (see sources.json).'
  );
}

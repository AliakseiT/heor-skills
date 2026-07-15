/**
 * Normalizer: de/diga — German DiGA-Verzeichnis (digital health applications), BfArM.
 *
 * STATUS: scaffold — not yet implemented.
 *
 * Source: the DiGA directory at https://diga.bfarm.de/de/verzeichnis exposes a
 * FHIR API at https://diga.bfarm.de/api/fhir/v3.0 (discovered from the site's
 * JS bundle; a bare GET returns 401 Unauthorized, so access requirements —
 * headers, API key, or specific FHIR search paths — need to be verified,
 * see sources.json status "verify"). The upstream app previously scraped the
 * HTML directory with Puppeteer (scripts/scrape-diga.ts) as a fallback.
 *
 * TODO when implementing:
 *  1. Verify FHIR API access (CatalogEntry / DeviceDefinition resources) and
 *     record the working endpoint + auth in sources.json.
 *  2. Map to planned shape: index.json entries
 *     { code (DiGA-VZ id), status (active|deleted), prices { manufacturerPrice },
 *       currency: "EUR", icdCodes[], validFrom } and de.json labels
 *     { name, description, manufacturer, indication, url }.
 *  3. Version = snapshot date (YYYY-MM), since the directory changes continuously.
 *
 * No Firestore, no embeddings (stripped by design — CONVENTIONS.md §2).
 */
import { NotImplementedError } from '../lib/util';
import type { NormalizeContext, NormalizeResult } from '../lib/types';

export async function normalize(_ctx: NormalizeContext): Promise<NormalizeResult> {
  throw new NotImplementedError(
    'de/diga: normalizer is scaffolded but not implemented. ' +
      'The BfArM FHIR API (https://diga.bfarm.de/api/fhir/v3.0) returns 401 without credentials; ' +
      'verify access requirements first (see sources.json).'
  );
}

/**
 * Normalizer: de/diga — DiGA-Verzeichnis (digital health applications), BfArM.
 *
 * Source: the directory's FHIR API at https://diga.bfarm.de/api/fhir/v3.0.
 * Access recipe (verified 2026-07): POST {"data":{"type":"tokens","attributes":{}}}
 * with Content-Type application/vnd.api+json + Origin/Referer headers to
 * /api/diga-vz/tokens; the returned data.id is then sent as
 * `Authorization: Bearer <id>` — a Referer header MUST accompany every FHIR
 * request or the API answers 401.
 *
 * Resources used (by _profile):
 *   DeviceDefinition / HealthApp              — the apps (DiGA id, name)
 *   CatalogEntry / HealthAppCatalogEntry      — listing status + validity
 *   Organization / HealthAppManufacturer      — manufacturer names
 *   ChargeItemDefinition / HealthAppPrescriptionUnit — prices (publisher-price, EUR) + ICD-10 use contexts
 *   DeviceDefinition / HealthAppModule        — links prescription units to apps (parentDevice)
 *
 * With --local, pass a DIRECTORY containing diga-<Profile>.json bundle files
 * (raw responses, one per profile, as produced by the download step).
 */
import * as fs from 'fs';
import * as path from 'path';
import { USER_AGENT, fetchJson, fetchRaw } from '../lib/fetch';
import type { NormalizeContext, NormalizeResult } from '../lib/types';
import { NeedsLocalFileError } from '../lib/util';

const SITE = 'https://diga.bfarm.de';
const PROFILES: Array<[resourceType: string, profile: string]> = [
  ['DeviceDefinition', 'HealthApp'],
  ['CatalogEntry', 'HealthAppCatalogEntry'],
  ['Organization', 'HealthAppManufacturer'],
  ['ChargeItemDefinition', 'HealthAppPrescriptionUnit'],
  ['DeviceDefinition', 'HealthAppModule'],
];

type FhirResource = Record<string, any>;
type Bundles = Record<string, FhirResource[]>;

async function loadBundles(ctx: NormalizeContext): Promise<Bundles> {
  const bundles: Bundles = {};
  if (ctx.localPath) {
    for (const [, profile] of PROFILES) {
      const raw = JSON.parse(fs.readFileSync(path.join(ctx.localPath, `diga-${profile}.json`), 'utf-8'));
      bundles[profile] = (raw.entry ?? []).map((e: any) => e.resource);
    }
    return bundles;
  }
  if (!ctx.download) {
    throw new NeedsLocalFileError('de/diga: pass --local <dir with diga-<Profile>.json bundles> or --download');
  }
  const tokenResponse = await fetchJson<{ data: { id: string } }>(`${SITE}/api/diga-vz/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
      Origin: SITE,
      Referer: `${SITE}/de/verzeichnis`,
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({ data: { type: 'tokens', attributes: {} } }),
  });
  const token = tokenResponse.data.id;
  for (const [resourceType, profile] of PROFILES) {
    const url =
      `${SITE}/api/fhir/v3.0/${resourceType}?_count=1000&_profile=` +
      encodeURIComponent(`https://fhir.bfarm.de/StructureDefinition/${profile}`);
    const response = await fetchRaw(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Referer: `${SITE}/de/verzeichnis`,
        Accept: 'application/fhir+json',
      },
    });
    const bundle = (await response.json()) as { entry?: Array<{ resource: FhirResource }> };
    bundles[profile] = (bundle.entry ?? []).map((e) => e.resource);
  }
  return bundles;
}

function refId(reference: string | undefined): string | null {
  return reference ? reference.split('/').pop() ?? null : null;
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  const notes: string[] = [];
  const bundles = await loadBundles(ctx);
  const version = ctx.version ?? new Date().toISOString().slice(0, 7);

  const manufacturers = new Map<string, string>();
  for (const org of bundles.HealthAppManufacturer ?? []) {
    if (org.id) manufacturers.set(String(org.id), org.name ?? '');
  }

  // module fhir-id -> app fhir-id
  const moduleToApp = new Map<string, string>();
  for (const module of bundles.HealthAppModule ?? []) {
    const appId = refId(module.parentDevice?.reference);
    if (module.id && appId) moduleToApp.set(String(module.id), appId);
  }

  // status + validity per app fhir-id (from CatalogEntry)
  const statusByApp = new Map<string, { status: string; validFrom?: string }>();
  for (const ce of bundles.HealthAppCatalogEntry ?? []) {
    const link = (ce.referencedItem?.extension ?? []).find((x: any) =>
      String(x.url).endsWith('HealthAppCatalogEntryHealthAppLink')
    );
    const appId = refId(link?.valueReference?.reference);
    if (!appId) continue;
    statusByApp.set(appId, { status: ce.status ?? 'unknown', validFrom: ce.validityPeriod?.start });
  }

  // prices + ICD codes per app fhir-id (from prescription units, via modules)
  const pricesByApp = new Map<string, Array<Record<string, unknown>>>();
  const icdByApp = new Map<string, Set<string>>();
  for (const unit of bundles.HealthAppPrescriptionUnit ?? []) {
    const moduleId = refId(
      (unit.instance?.[0]?.extension ?? []).find((x: any) => String(x.url).endsWith('ModuleLink'))?.valueReference
        ?.reference
    );
    const appId = moduleId ? moduleToApp.get(moduleId) : null;
    if (!appId) continue;
    const pzn = (unit.code?.coding ?? []).find((c: any) => String(c.system).includes('pzn'))?.code;
    for (const group of unit.propertyGroup ?? []) {
      for (const component of group.priceComponent ?? []) {
        if (component.amount?.value === undefined) continue;
        const priceCode = (component.code?.coding ?? [])[0]?.code ?? 'price';
        const list = pricesByApp.get(appId) ?? [];
        list.push({
          type: priceCode,
          amount: component.amount.value,
          currency: component.amount.currency ?? 'EUR',
          unit: unit.title ?? undefined,
          pzn: pzn ?? undefined,
        });
        pricesByApp.set(appId, list);
      }
    }
    for (const uc of unit.useContext ?? []) {
      for (const coding of uc.valueCodeableConcept?.coding ?? []) {
        if (String(coding.system).includes('icd-10')) {
          const set = icdByApp.get(appId) ?? new Set<string>();
          set.add(coding.code);
          icdByApp.set(appId, set);
        }
      }
    }
  }

  const entries: Array<Record<string, unknown>> = [];
  const labels: Record<string, unknown> = {};
  for (const app of bundles.HealthApp ?? []) {
    const appId = String(app.id ?? '');
    const digaId = (app.identifier ?? []).find((i: any) => String(i.system).endsWith('DigaId'))?.value;
    if (!digaId) continue;
    const status = statusByApp.get(appId);
    const entry: Record<string, unknown> = {
      code: digaId,
      status: status?.status ?? 'unknown',
    };
    if (status?.validFrom) entry.validFrom = status.validFrom;
    const prices = pricesByApp.get(appId);
    if (prices?.length) entry.prices = prices;
    const icd = icdByApp.get(appId);
    if (icd?.size) entry.icdCodes = [...icd].sort();
    entries.push(entry);
    const manufacturerId = refId(app.manufacturerReference?.reference);
    labels[digaId] = {
      name: (app.deviceName ?? []).find((n: any) => n.type === 'user-friendly-name')?.name ?? '',
      manufacturer: manufacturerId ? manufacturers.get(manufacturerId) || undefined : undefined,
      url: app.onlineInformation ?? undefined,
    };
  }
  entries.sort((a, b) => String(a.code).localeCompare(String(b.code)));
  notes.push(
    `${entries.length} apps; ${bundles.HealthAppPrescriptionUnit?.length ?? 0} prescription units; version is the snapshot month (directory changes continuously)`
  );

  return {
    version,
    entryCount: entries.length,
    notes,
    files: {
      'index.json': {
        list: 'diga',
        jurisdiction: 'de',
        version,
        currency: 'EUR',
        languages: ['de'],
        source: { api: `${SITE}/api/fhir/v3.0`, landingUrl: ctx.sourceEntry.landingUrl },
        entries,
      },
      'de.json': {
        list: 'diga',
        jurisdiction: 'de',
        version,
        language: 'de',
        entries: labels,
      },
    },
  };
}

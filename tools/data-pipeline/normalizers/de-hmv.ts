/**
 * Normalizer: de/hmv — German Hilfsmittelverzeichnis (HMV, §139 SGB V),
 * GKV-Spitzenverband.
 *
 * Source: the directory site's REST API (discovered from the SPA bundle):
 *   https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis/Produkt        (all products)
 *   https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis/VerzeichnisTree (group hierarchy)
 * With --local, pass a DIRECTORY containing produkte.json and tree.json
 * (raw responses of the two endpoints).
 *
 * Products carry the 10-digit code GG.OO.UU.APPP as `zehnSteller`; placeholder
 * rows are named "Nicht besetzt" and delisted rows have `istHerausgenommen`;
 * both are skipped (counts reported in notes). The HMV carries no prices.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fetchJson } from '../lib/fetch';
import type { NormalizeContext, NormalizeResult } from '../lib/types';
import { NeedsLocalFileError } from '../lib/util';

const API_BASE = 'https://hilfsmittel-api.gkv-spitzenverband.de/api/verzeichnis';

interface HmvProduct {
  zehnSteller?: string | null;
  name?: string | null;
  herstellerName?: string | null;
  aufnahmeDatum?: string | null;
  istHerausgenommen?: boolean | null;
}

interface HmvTreeNode {
  xSteller?: string | null;
  displayValue?: string | null;
  level?: number | null;
  parentId?: string | null;
  id?: string | null;
}

async function loadSources(ctx: NormalizeContext): Promise<{ products: HmvProduct[]; tree: HmvTreeNode[] }> {
  if (ctx.localPath) {
    const dir = ctx.localPath;
    const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
    return { products: read('produkte.json'), tree: read('tree.json') };
  }
  if (!ctx.download) {
    throw new NeedsLocalFileError('de/hmv: pass --local <dir with produkte.json + tree.json> or --download');
  }
  const [products, tree] = await Promise.all([
    fetchJson<HmvProduct[]>(`${API_BASE}/Produkt`, { headers: { Accept: 'application/json' } }),
    // The /4 path segment is the tree depth (1=Gruppe … 4=Art); 4 returns the full hierarchy.
    fetchJson<HmvTreeNode[]>(`${API_BASE}/VerzeichnisTree/4`, { headers: { Accept: 'application/json' } }),
  ]);
  return { products, tree };
}

export async function normalize(ctx: NormalizeContext): Promise<NormalizeResult> {
  const notes: string[] = [];
  const { products, tree } = await loadSources(ctx);
  const version = ctx.version ?? new Date().toISOString().slice(0, 7);

  // Hierarchy from the tree endpoint: nodes keyed by their x-digit code prefix.
  const idToCode = new Map<string, string>();
  for (const node of tree) {
    if (node.id && node.xSteller) idToCode.set(node.id, node.xSteller);
  }
  const hierarchy: Array<Record<string, unknown>> = [];
  const hierarchyLabels: Record<string, unknown> = {};
  for (const node of tree) {
    if (!node.xSteller) continue;
    hierarchy.push({
      id: node.xSteller,
      level: node.level ?? node.xSteller.split('.').length,
      parent: node.parentId ? idToCode.get(node.parentId) ?? null : null,
    });
    const label = (node.displayValue ?? '').replace(/^[\d.]+\s*-\s*/, '');
    hierarchyLabels[node.xSteller] = { name: label };
  }

  let skippedPlaceholders = 0;
  let skippedDelisted = 0;
  const entries: Array<Record<string, unknown>> = [];
  const labels: Record<string, unknown> = {};
  for (const product of products) {
    const code = (product.zehnSteller ?? '').trim();
    if (!code) continue;
    if ((product.name ?? '').trim() === 'Nicht besetzt') {
      skippedPlaceholders++;
      continue;
    }
    if (product.istHerausgenommen) {
      skippedDelisted++;
      continue;
    }
    const entry: Record<string, unknown> = {
      code,
      parent: code.split('.').slice(0, 3).join('.'),
    };
    if (product.aufnahmeDatum) entry.validFrom = String(product.aufnahmeDatum).slice(0, 10);
    entries.push(entry);
    labels[code] = {
      name: (product.name ?? '').trim(),
      manufacturer: (product.herstellerName ?? '').trim() || undefined,
    };
  }
  notes.push(
    `${products.length} products from source; skipped ${skippedPlaceholders} placeholders ("Nicht besetzt") and ${skippedDelisted} delisted (istHerausgenommen)`
  );
  notes.push('HMV carries no prices; version is the snapshot month (API serves live state)');

  return {
    version,
    entryCount: entries.length,
    notes,
    files: {
      'index.json': {
        list: 'hmv',
        jurisdiction: 'de',
        version,
        languages: ['de'],
        source: { api: API_BASE, landingUrl: ctx.sourceEntry.landingUrl },
        hierarchy,
        entries,
      },
      'de.json': {
        list: 'hmv',
        jurisdiction: 'de',
        version,
        language: 'de',
        hierarchy: hierarchyLabels,
        entries: labels,
      },
    },
  };
}

/** Shared contract between refresh.ts and the per-list normalizers. */

export interface SourceEntry {
  name: string;
  jurisdiction: string;
  list: string;
  authority: string;
  landingUrl: string;
  downloadUrl: string | null;
  apiUrl?: string | null;
  format: string;
  languages: string[];
  updateCadence: string;
  status: 'download-verified' | 'landing-verified' | 'verify';
  notes?: string;
}

export interface NormalizeContext {
  /** Path to a manually downloaded source file (--local). */
  localPath?: string;
  /** Explicit version override (--version), e.g. "2025-07". */
  version?: string;
  /** Whether refresh.ts was allowed to download from the network (--download). */
  download: boolean;
  sourceEntry: SourceEntry;
}

export interface NormalizeResult {
  /** Version directory name, e.g. "2025-07". */
  version: string;
  /** Files to write under data/<jurisdiction>/<list>/<version>/, keyed by filename. */
  files: Record<string, unknown>;
  /** Number of list entries (positions/codes) produced. */
  entryCount: number;
  /** Free-form warnings/observations surfaced in the change summary. */
  notes: string[];
}

export type Normalizer = (ctx: NormalizeContext) => Promise<NormalizeResult>;

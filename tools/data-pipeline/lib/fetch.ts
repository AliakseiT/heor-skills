/** Network + archive helpers for normalizers that fetch their own sources. */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/** Some official portals (BfArM, GKV) reject requests without a browser-ish UA. */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 heor-skills-data-pipeline';

export async function fetchRaw(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = { 'User-Agent': USER_AGENT, ...(init.headers as Record<string, string> | undefined) };
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response;
}

export async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  return (await fetchRaw(url, init)).text();
}

export async function fetchJson<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  return (await fetchRaw(url, init)).json() as Promise<T>;
}

export async function fetchToFile(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetchRaw(url, init);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heor-fetch-'));
  const name = path.basename(new URL(url).pathname) || 'download.bin';
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

/** Extract a ZIP with the system unzip (present on macOS and ubuntu CI runners). */
export function unzipToTemp(zipPath: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'heor-unzip-'));
  execFileSync('unzip', ['-oq', zipPath, '-d', dir]);
  return dir;
}

/** First file under dir whose basename matches, searched non-recursively. */
export function findFile(dir: string, pattern: RegExp, exclude?: RegExp): string {
  const match = fs
    .readdirSync(dir)
    .filter((f) => pattern.test(f) && !(exclude && exclude.test(f)))
    .sort()[0];
  if (!match) throw new Error(`no file matching ${pattern} in ${dir}`);
  return path.join(dir, match);
}

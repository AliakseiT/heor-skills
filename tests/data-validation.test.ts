/**
 * Schema validation tests for bundled reimbursement data.
 *
 * Every JSON file under data/ must validate against its schema.
 * This catches pipeline regressions and malformed data before merge.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validate, type SchemaObject } from '../tools/data-pipeline/lib/validate';

const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const SCHEMAS_DIR = path.join(REPO_ROOT, 'tools', 'data-pipeline', 'schemas');

function loadSchema(list: string): SchemaObject {
  return JSON.parse(
    fs.readFileSync(path.join(SCHEMAS_DIR, `${list}.schema.json`), 'utf8')
  ) as SchemaObject;
}

function listDataFiles(): Array<{ file: string; list: string; lang: string }> {
  if (!fs.existsSync(DATA_DIR)) return [];
  const results: Array<{ file: string; list: string; lang: string }> = [];
  for (const jur of fs.readdirSync(DATA_DIR, { withFileTypes: true })) {
    if (!jur.isDirectory()) continue;
    const jurDir = path.join(DATA_DIR, jur.name);
    for (const list of fs.readdirSync(jurDir, { withFileTypes: true })) {
      if (!list.isDirectory()) continue;
      const listDir = path.join(jurDir, list.name);
      for (const version of fs.readdirSync(listDir, { withFileTypes: true })) {
        if (!version.isDirectory()) continue;
        const versionDir = path.join(listDir, version.name);
        for (const file of fs.readdirSync(versionDir)) {
          if (file.endsWith('.json')) {
            const lang = file.replace('.json', '');
            results.push({
              file: path.join(versionDir, file),
              list: list.name,
              lang,
            });
          }
        }
      }
    }
  }
  return results;
}

describe('bundled data validates against schemas', () => {
  const dataFiles = listDataFiles();

  if (dataFiles.length === 0) {
    it.skip('no data files found under data/');
    return;
  }

  for (const { file, list, lang } of dataFiles) {
    it(`${path.relative(REPO_ROOT, file)} validates against ${list} schema`, () => {
      const schema = loadSchema(list);
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      const defs = (schema.$defs ?? {}) as Record<string, SchemaObject>;
      const defName = lang === 'index' ? 'index' : 'labels';
      const def = defs[defName];
      expect(def, `schema for ${list} must have $defs.${defName}`).toBeDefined();
      const errors = validate(def, content, schema);
      expect(errors, errors.join('\n')).toHaveLength(0);
    });
  }
});

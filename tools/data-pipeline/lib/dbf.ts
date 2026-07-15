/**
 * Minimal dBase III/IV (.dbf) reader — enough for the CNAM LPP tables.
 * Pure TS, no dependencies (CONVENTIONS.md §2). Text is decoded as latin1
 * (the CNAM files use a Western single-byte codepage for French labels).
 */
import * as fs from 'fs';

export interface DbfField {
  name: string;
  type: string; // C=character, N=numeric, D=date (YYYYMMDD), L=logical
  length: number;
  decimals: number;
}

export type DbfValue = string | number | null;

export interface DbfTable {
  fields: DbfField[];
  records: Array<Record<string, DbfValue>>;
}

export function readDbf(filePath: string): DbfTable {
  const buf = fs.readFileSync(filePath);
  const recordCount = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);

  const fields: DbfField[] = [];
  let offset = 32;
  while (buf[offset] !== 0x0d) {
    const name = buf
      .subarray(offset, offset + 11)
      .toString('ascii')
      .replace(/\0.*$/, '');
    fields.push({
      name,
      type: String.fromCharCode(buf[offset + 11]),
      length: buf[offset + 16],
      decimals: buf[offset + 17],
    });
    offset += 32;
    if (offset >= headerLength) break;
  }

  const records: Array<Record<string, DbfValue>> = [];
  for (let i = 0; i < recordCount; i++) {
    const start = headerLength + i * recordLength;
    if (start + recordLength > buf.length) break;
    if (buf[start] === 0x2a) continue; // deleted record
    const record: Record<string, DbfValue> = {};
    let pos = start + 1;
    for (const field of fields) {
      const raw = buf.subarray(pos, pos + field.length).toString('latin1').trim();
      pos += field.length;
      if (raw === '') {
        record[field.name] = null;
      } else if (field.type === 'N') {
        const num = Number(raw);
        record[field.name] = Number.isFinite(num) ? num : null;
      } else if (field.type === 'D') {
        record[field.name] = /^\d{8}$/.test(raw)
          ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          : null;
      } else {
        record[field.name] = raw;
      }
    }
    records.push(record);
  }
  return { fields, records };
}

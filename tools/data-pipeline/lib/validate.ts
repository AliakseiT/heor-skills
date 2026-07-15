/**
 * Minimal JSON Schema validator — dependency-free by design (see CONVENTIONS.md §2).
 *
 * Supports the subset used by the schemas in tools/data-pipeline/schemas/:
 *   type (string or array of strings), properties, patternProperties,
 *   additionalProperties (boolean), required, items, enum, const, pattern,
 *   minimum, maximum, minItems, minLength, and local $ref ("#/$defs/...").
 *
 * Returns a list of human-readable error strings; empty list means valid.
 */

export type SchemaObject = { [key: string]: unknown };

function typeOf(data: unknown): string {
  if (data === null) return 'null';
  if (Array.isArray(data)) return 'array';
  if (typeof data === 'number') return Number.isInteger(data) ? 'integer' : 'number';
  return typeof data;
}

function typeMatches(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  if (expected === 'number' && actual === 'integer') return true;
  return false;
}

function resolveRef(ref: string, root: SchemaObject): SchemaObject {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref supported, got: ${ref}`);
  let node: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    if (node === null || typeof node !== 'object') throw new Error(`Cannot resolve $ref: ${ref}`);
    node = (node as SchemaObject)[part.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  if (node === null || typeof node !== 'object') throw new Error(`$ref does not resolve to a schema: ${ref}`);
  return node as SchemaObject;
}

export function validate(
  schema: SchemaObject,
  data: unknown,
  root?: SchemaObject,
  path = '$',
  errors: string[] = []
): string[] {
  const rootSchema = root ?? schema;

  if (typeof schema.$ref === 'string') {
    return validate(resolveRef(schema.$ref, rootSchema), data, rootSchema, path, errors);
  }

  const actualType = typeOf(data);

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!expected.some((t) => typeMatches(t, actualType))) {
      errors.push(`${path}: expected type ${expected.join('|')}, got ${actualType}`);
      return errors; // no point checking further constraints on wrong type
    }
  }

  if (schema.enum !== undefined) {
    const allowed = schema.enum as unknown[];
    if (!allowed.some((v) => JSON.stringify(v) === JSON.stringify(data))) {
      errors.push(`${path}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(allowed)}`);
    }
  }
  if (schema.const !== undefined && JSON.stringify(schema.const) !== JSON.stringify(data)) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
  }

  if (typeof data === 'string') {
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: string does not match pattern ${schema.pattern}`);
    }
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) {
      errors.push(`${path}: ${data} below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && data > schema.maximum) {
      errors.push(`${path}: ${data} above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(data)) {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push(`${path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.items && typeof schema.items === 'object') {
      data.forEach((item, i) => validate(schema.items as SchemaObject, item, rootSchema, `${path}[${i}]`, errors));
    }
  }

  if (actualType === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, SchemaObject>;
    const patternProperties = (schema.patternProperties ?? {}) as Record<string, SchemaObject>;

    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in obj)) errors.push(`${path}: missing required property "${key}"`);
    }

    for (const [key, value] of Object.entries(obj)) {
      let matched = false;
      if (key in properties) {
        matched = true;
        validate(properties[key], value, rootSchema, `${path}.${key}`, errors);
      }
      for (const [pattern, subschema] of Object.entries(patternProperties)) {
        if (new RegExp(pattern).test(key)) {
          matched = true;
          validate(subschema, value, rootSchema, `${path}.${key}`, errors);
        }
      }
      if (!matched && schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`);
      }
    }
  }

  return errors;
}

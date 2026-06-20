/**
 * validate-schema — Lightweight JSON-schema validator (no external deps).
 *
 * Supports the subset of JSON Schema draft-07 used by this project's schemas:
 *   - type (string, number, integer, boolean, array, object, null)
 *   - type as union array (e.g. ["string", "null"])
 *   - required (array of property names)
 *   - enum (array of allowed values)
 *   - properties (nested object schema)
 *   - items (schema for array elements)
 *   - minimum (number)
 *
 * Intentionally minimal — not a general-purpose validator. Schemas live in
 * /schema at the project root and are loaded by absolute path.
 *
 * Usage:
 *   import { validateAgainstSchema } from './validate-schema.mjs';
 *   const result = validateAgainstSchema(obj, '/path/to/schema.json');
 *   if (!result.ok) console.error(result.errors);
 */
import { readFileSync } from 'node:fs';

// Cache loaded schemas by path to avoid re-reading on every load.
const schemaCache = new Map();

/**
 * Load a JSON schema from disk (cached).
 * @param {string} schemaPath — absolute path to the .schema.json file
 * @returns {object|null}
 */
function loadSchema(schemaPath) {
  if (schemaCache.has(schemaPath)) {
    return schemaCache.get(schemaPath);
  }
  try {
    const raw = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(raw);
    schemaCache.set(schemaPath, schema);
    return schema;
  } catch {
    return null;
  }
}

/**
 * Check a value against a single type string.
 * @param {*} value
 * @param {string} type
 * @returns {boolean}
 */
function matchesType(value, type) {
  switch (type) {
    case 'string':  return typeof value === 'string';
    case 'number':  return typeof value === 'number' && !Number.isNaN(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array':   return Array.isArray(value);
    case 'object':  return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'null':    return value === null;
    default:        return true; // unknown types pass (forward-compat)
  }
}

/**
 * Validate a value against a schema node, collecting errors.
 * @param {*} value
 * @param {object} schema
 * @param {string} path — dotted path for error messages (e.g. "root.gates.enabled")
 * @param {string[]} errors — accumulator
 */
function validateNode(value, schema, path, errors) {
  // type
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = types.some((t) => matchesType(value, t));
    if (!ok) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${Array.isArray(value) ? 'array' : typeof value}`);
      return; // no point checking further on a type mismatch
    }
  }

  // enum
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value "${value}" not in enum [${schema.enum.join(', ')}]`);
  }

  // minimum
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) {
    errors.push(`${path}: value ${value} below minimum ${schema.minimum}`);
  }

  // object properties + required
  if (matchesType(value, 'object') && schema.properties) {
    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in value)) {
          errors.push(`${path}: missing required property "${req}"`);
        }
      }
    }
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        validateNode(value[key], subSchema, `${path}.${key}`, errors);
      }
    }
  }

  // array items
  if (matchesType(value, 'array') && schema.items) {
    for (let i = 0; i < value.length; i++) {
      validateNode(value[i], schema.items, `${path}[${i}]`, errors);
    }
  }
}

/**
 * Validate an object against a JSON schema loaded from disk.
 * @param {object} obj — the value to validate
 * @param {string} schemaPath — absolute path to the schema file
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateAgainstSchema(obj, schemaPath) {
  const schema = loadSchema(schemaPath);
  if (!schema) {
    // Schema missing/unreadable — fail open (don't block on missing schema).
    return { ok: true, errors: [] };
  }
  const errors = [];
  validateNode(obj, schema, 'config', errors);
  return { ok: errors.length === 0, errors };
}

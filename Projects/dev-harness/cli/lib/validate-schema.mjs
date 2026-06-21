/**
 * validate-schema — JSON-schema validator backed by ajv.
 *
 * Replaces the hand-rolled minimal validator with a full draft-07
 * implementation via `ajv`. Supports the complete JSON Schema draft-07
 * vocabulary: type, required, enum, properties, items, minimum, $ref,
 * format, oneOf/anyOf/allOf, if/then/else, pattern, minLength, etc.
 *
 * Public API is unchanged from the previous hand-rolled version so
 * callers (state.mjs, ralph-inner.mjs) need no edits:
 *
 *   import { validateAgainstSchema } from './validate-schema.mjs';
 *   const result = validateAgainstSchema(obj, '/path/to/schema.json');
 *   if (!result.ok) console.error(result.errors);
 *
 * Schemas live in /schema at the project root and are loaded by absolute path.
 * Loaded schemas are cached by path to avoid re-compiling on every call.
 */
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';

// ── Schema cache ─────────────────────────────────────────────────────────────
// Compiling a schema is expensive; cache the compiled validator per path.
const validatorCache = new Map();
const schemaObjectCache = new Map();

/**
 * Load a JSON schema from disk (cached).
 * @param {string} schemaPath — absolute path to the .schema.json file
 * @returns {object|null}
 */
function loadSchemaObject(schemaPath) {
  if (schemaObjectCache.has(schemaPath)) {
    return schemaObjectCache.get(schemaPath);
  }
  try {
    const raw = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(raw);
    schemaObjectCache.set(schemaPath, schema);
    return schema;
  } catch {
    return null;
  }
}

/**
 * Get (or compile+cache) an ajv validator for the schema at the given path.
 * @param {string} schemaPath
 * @returns {import('ajv').ValidateFunction|null}
 */
function getValidator(schemaPath) {
  if (validatorCache.has(schemaPath)) {
    return validatorCache.get(schemaPath);
  }
  const schema = loadSchemaObject(schemaPath);
  if (!schema) {
    return null;
  }
  // allErrors=true so we collect every violation, matching the old
  // validator's behavior of returning a full errors[] array.
  // strict=false to tolerate schemas that use unknown keywords
  // (forward-compat with draft 2019-09+ keywords the project may adopt).
  const ajv = new Ajv({ allErrors: true, strict: false });
  try {
    const validate = ajv.compile(schema);
    validatorCache.set(schemaPath, validate);
    return validate;
  } catch {
    // Schema itself is malformed — treat as "no validator" so we fail open,
    // matching the previous behavior of "fail open on missing schema".
    return null;
  }
}

/**
 * Format an ajv error object into a human-readable string compatible with
 * the previous hand-rolled validator's error format:
 *   "<path>: <message>"
 * ajv uses `instancePath` (e.g. "/gates/enabled") — convert to dotted form.
 * @param {import('ajv').ErrorObject} err
 * @returns {string}
 */
function formatAjvError(err) {
  // Convert "/gates/enabled" → "config.gates.enabled" (root is "config" in
  // the old validator's convention).
  const dotted = err.instancePath
    ? 'config' + err.instancePath.replace(/\//g, '.')
    : 'config';
  // For missing required properties ajv reports `missingProperty` in params
  // and an empty instancePath on the *parent* — surface the property name.
  let message = err.message || 'invalid';
  if (err.params && err.params.missingProperty) {
    message = `missing required property "${err.params.missingProperty}"`;
  }
  return `${dotted}: ${message}`;
}

/**
 * Validate an object against a JSON schema loaded from disk.
 * @param {object} obj — the value to validate
 * @param {string} schemaPath — absolute path to the schema file
 * @returns {{ ok: boolean, errors: string[] }}
 *
 * Behavior parity with the previous hand-rolled validator:
 *   - Schema missing/unreadable → fail open: { ok: true, errors: [] }
 *   - Schema malformed → fail open: { ok: true, errors: [] }
 *   - Validation passes → { ok: true, errors: [] }
 *   - Validation fails → { ok: false, errors: [...] }
 */
export function validateAgainstSchema(obj, schemaPath) {
  const validate = getValidator(schemaPath);
  if (!validate) {
    // Schema missing/unreadable/malformed — fail open (don't block on
    // missing schema). This matches the previous hand-rolled behavior.
    return { ok: true, errors: [] };
  }
  const valid = validate(obj);
  if (valid) {
    return { ok: true, errors: [] };
  }
  const errors = (validate.errors || []).map(formatAjvError);
  return { ok: errors.length === 0, errors };
}

// ── Internal helpers exported for testing ────────────────────────────────────
// These mirror the previous module's internal helpers so any tests that
// imported them continue to work.

/**
 * Check a value against a single type string.
 * Kept for backward compatibility with tests that may import it.
 * @param {*} value
 * @param {string} type
 * @returns {boolean}
 */
export function matchesType(value, type) {
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
 * Clear the schema cache. Useful for tests that swap schema files on disk.
 */
export function clearSchemaCache() {
  validatorCache.clear();
  schemaObjectCache.clear();
}

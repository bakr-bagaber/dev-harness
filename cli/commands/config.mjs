/**
 * config — Get/set/list harness-config.json values.
 *
 * Uses state.mjs for dot-notation read/write with persistence.
 *
 * Usage:
 *   dev-harness config list              — list all parameters with descriptions
 *   dev-harness config get [key]         — get a value or all config
 *   dev-harness config set <key> <value> — set a value
 *
 * Examples:
 *   dev-harness config list
 *   dev-harness config list --json
 *   dev-harness config get gates.enabled
 *   dev-harness config set gates.enabled true
 *   dev-harness config set maxRetries 5
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { get as stateGet, set as stateSet, loadConfig } from '../lib/state.mjs';
import { CONFIG_PARAMS, getGroups, getParamsByGroup, getParamMeta } from '../lib/config-registry.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function configCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const sub = args.subcommand; // 'get', 'set', or 'list'
  const pos = args.positionals; // key[, value] for set
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();

  if (!sub || (sub !== 'get' && sub !== 'set' && sub !== 'list')) {
    die(new CliError(
      'Usage: dev-harness config list | config get [key] | config set <key> <value>',
      EXIT.USAGE_ERROR,
    ), json);
    return;
  }

  // ── list ─────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const { config, ok } = loadConfig(targetDir);

    // Helper to resolve current value from config via dot-notation
    function resolveValue(key) {
      if (!ok) { return null; }
      const parts = key.split('.');
      let val = config;
      for (const p of parts) {
        val = val?.[p];
      }
      return val ?? null;
    }

    if (json) {
      const params = CONFIG_PARAMS.map(p => ({
        key: p.key,
        group: p.group,
        label: p.label,
        type: p.type,
        description: p.description,
        default: p.default,
        options: p.options || null,
        editable: p.editable,
        value: resolveValue(p.key),
      }));
      emitJson({
        command: 'config',
        subcommand: 'list',
        status: 'ok',
        message: `${params.length} configuration parameters`,
        params,
      });
      return;
    }

    // Human output — grouped table
    emitHuman('═══ Harness Configuration ═══\n\n');
    if (!ok) {
      emitHuman('  No harness/config.json found. Run: dev-harness init\n\n');
      return;
    }

    for (const group of getGroups()) {
      const params = getParamsByGroup(group);
      const readOnly = params[0]?.editable === false;
      emitHuman(`── ${group}${readOnly ? ' (read-only)' : ''} ──\n`);

      // Calculate column widths
      const maxKey = Math.max(...params.map(p => p.key.length), 10);
      const maxVal = Math.max(...params.map(p => {
        const v = resolveValue(p.key);
        return JSON.stringify(v)?.length ?? 4;
      }), 7);

      for (const p of params) {
        const val = resolveValue(p.key);
        const valStr = JSON.stringify(val) ?? 'null';
        const opts = p.options ? `[${p.options.filter(o => o !== null).slice(0, 4).join('|')}${p.options.length > 4 ? '|...' : ''}]` : `[${p.type}]`;
        const padKey = p.key.padEnd(maxKey);
        const padVal = valStr.padEnd(Math.min(maxVal, 20));
        emitHuman(`  ${padKey}  ${padVal}  ${opts.padEnd(16)} ${p.description.slice(0, 60)}\n`);
      }
      emitHuman('\n');
    }

    emitHuman('Edit with: dev-harness config set <key> <value>\n');
    emitHuman('Full docs: docs/CONFIGURATION.md\n');
    return;
  }

  // ── get ──────────────────────────────────────────────────────────────────
  if (sub === 'get') {
    const key = pos[0] || null;
    const { value, ok, error } = stateGet(targetDir, key);

    if (json) {
      emitJson({
        command: 'config',
        subcommand: 'get',
        key,
        value: ok ? value : null,
        status: ok ? 'ok' : 'error',
        message: ok ? null : (error || 'Unknown error'),
      });
      return;
    }

    // Human output
    if (!ok) {
      emitHuman(`Config not available: ${error}\n`);
      return;
    }
    if (key === null) {
      emitHuman(JSON.stringify(value, null, 2) + '\n');
    } else {
      emitHuman(`${key} = ${JSON.stringify(value)}\n`);
    }
    return;
  }

  // ── set ──────────────────────────────────────────────────────────────────
  if (sub === 'set') {
    // G2 fix: --json-value flag reads array/object values from stdin or @file,
    // bypassing shell quoting issues (e.g. `config set phases.enabled --json-value '["a","b"]'`).
    const jsonValueFlag = args.flags?.['json-value'];
    const usingJsonValue = jsonValueFlag !== undefined;

    if (usingJsonValue) {
      if (pos.length < 1) {
        die(new CliError(
          'Usage: dev-harness config set <key> --json-value <json>\n' +
          '  <json> can be a JSON string, @file to read from a file, or - to read from stdin',
          EXIT.USAGE_ERROR,
        ), json);
        return;
      }
    } else if (pos.length < 2) {
      die(new CliError(
        'Usage: dev-harness config set <key> <value>\n' +
        '  String values: config set mode copilot\n' +
        '  Boolean values: config set gates.enabled true\n' +
        '  Numeric values: config set maxRetries 5\n' +
        '  Array/object values: config set phases.enabled --json-value \'["define","plan"]\'\n' +
        '  Or read from file: config set stackMeta --json-value @config.json',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const key = pos[0];
    let rawValue;
    let parsedValue;
    // Get parameter metadata for type-aware coercion (used by both branches)
    const meta = getParamMeta(key);

    if (usingJsonValue) {
      const jsonSpec = jsonValueFlag === true ? '-' : String(jsonValueFlag);
      if (jsonSpec === '-') {
        // Read from stdin
        try {
          const { readFileSync } = await import('node:fs');
          rawValue = readFileSync(0, 'utf-8').trim();
        } catch (err) {
          emitCmdError({ command: 'config', subcommand: 'set', json, key, message: `Failed to read JSON from stdin: ${err.message}` });
          process.exit(EXIT.INTERNAL_ERROR);
          return;
        }
      } else if (jsonSpec.startsWith('@')) {
        // Read from file
        try {
          const { readFileSync } = await import('node:fs');
          rawValue = readFileSync(jsonSpec.slice(1), 'utf-8').trim();
        } catch (err) {
          emitCmdError({ command: 'config', subcommand: 'set', json, key, message: `Failed to read JSON from file: ${err.message}` });
          process.exit(EXIT.INTERNAL_ERROR);
          return;
        }
      } else {
        rawValue = jsonSpec;
      }
      // Parse as JSON (strict — --json-value always means JSON)
      try {
        parsedValue = JSON.parse(rawValue);
      } catch (err) {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, message: `Invalid JSON: ${err.message}` });
        process.exit(EXIT.USAGE_ERROR);
        return;
      }
    } else {
      rawValue = pos.slice(1).join(' '); // support multi-word values

      // Type coercion: try JSON for arrays/objects, then numbers and booleans
      if (meta && (meta.type === 'array' || meta.type === 'object')) {
        // Array/object types: parse as JSON
        try {
          parsedValue = JSON.parse(rawValue);
        } catch {
          // If JSON parse fails, keep as string (let type check below catch it)
          parsedValue = rawValue;
        }
      } else if (rawValue === 'true') {
        parsedValue = true;
      } else if (rawValue === 'false') {
        parsedValue = false;
      } else if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
        parsedValue = Number(rawValue);
      } else if (rawValue === 'null') {
        parsedValue = null;
      } else {
        parsedValue = rawValue;
      }
    }

    // Validate against config-registry if parameter is known
    if (meta) {
      // Check editability
      if (!meta.editable) {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, message: `"${key}" is read-only (managed by harness). Cannot set manually.` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
      // Check enum options
      if (meta.options && !meta.options.includes(parsedValue)) {
        const opts = meta.options.map(o => o === null ? 'null' : `"${o}"`).join(', ');
        emitCmdError({ command: 'config', subcommand: 'set', json, key, value: parsedValue, message: `Invalid value for "${key}". Allowed: ${opts}` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
      // Check type for integers
      if (meta.type === 'integer' && typeof parsedValue !== 'number') {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, value: parsedValue, message: `"${key}" expects an integer, got ${typeof parsedValue}` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
      // Check type for booleans
      if (meta.type === 'boolean' && typeof parsedValue !== 'boolean') {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, value: parsedValue, message: `"${key}" expects a boolean (true/false), got ${typeof parsedValue}` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
      // Check type for arrays
      if (meta.type === 'array' && !Array.isArray(parsedValue)) {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, value: parsedValue, message: `"${key}" expects a JSON array, got ${typeof parsedValue}` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
      // Check type for objects
      if (meta.type === 'object' && (typeof parsedValue !== 'object' || Array.isArray(parsedValue) || parsedValue === null)) {
        emitCmdError({ command: 'config', subcommand: 'set', json, key, value: parsedValue, message: `"${key}" expects a JSON object, got ${Array.isArray(parsedValue) ? 'array' : typeof parsedValue}` });
        process.exit(EXIT.VALIDATION_FAILURE);
      }
    }

    const result = stateSet(targetDir, key, parsedValue);

    if (json) {
      emitJson({
        command: 'config',
        subcommand: 'set',
        key,
        value: parsedValue,
        status: result.ok ? 'ok' : 'error',
        message: result.ok
          ? `Set ${key} = ${JSON.stringify(parsedValue)}`
          : (result.error || 'Unknown error'),
      });
      return;
    }

    if (result.ok) {
      emitHuman(`✓ ${key} = ${JSON.stringify(parsedValue)}\n`);
    } else {
      emitCmdError({ command: 'config', subcommand: 'set', json, key, message: result.error || 'Unknown error' });
      process.exit(EXIT.VALIDATION_FAILURE);
    }
  }
}

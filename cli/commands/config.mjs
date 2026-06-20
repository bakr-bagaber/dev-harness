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
      process.stdout.write(JSON.stringify({
        command: 'config',
        subcommand: 'list',
        status: 'ok',
        message: `${params.length} configuration parameters`,
        params,
      }, null, 2) + '\n');
      return;
    }

    // Human output — grouped table
    process.stdout.write('═══ Harness Configuration ═══\n\n');
    if (!ok) {
      process.stdout.write('  No harness/config.json found. Run: dev-harness init\n\n');
      return;
    }

    for (const group of getGroups()) {
      const params = getParamsByGroup(group);
      const readOnly = params[0]?.editable === false;
      process.stdout.write(`── ${group}${readOnly ? ' (read-only)' : ''} ──\n`);

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
        process.stdout.write(`  ${padKey}  ${padVal}  ${opts.padEnd(16)} ${p.description.slice(0, 60)}\n`);
      }
      process.stdout.write('\n');
    }

    process.stdout.write('Edit with: dev-harness config set <key> <value>\n');
    process.stdout.write('Full docs: docs/CONFIGURATION.md\n');
    return;
  }

  // ── get ──────────────────────────────────────────────────────────────────
  if (sub === 'get') {
    const key = pos[0] || null;
    const { value, ok, error } = stateGet(targetDir, key);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'config',
        subcommand: 'get',
        key,
        value: ok ? value : null,
        status: ok ? 'ok' : 'error',
        message: ok ? null : (error || 'Unknown error'),
      }) + '\n');
      return;
    }

    // Human output
    if (!ok) {
      process.stdout.write(`Config not available: ${error}\n`);
      return;
    }
    if (key === null) {
      process.stdout.write(JSON.stringify(value, null, 2) + '\n');
    } else {
      process.stdout.write(`${key} = ${JSON.stringify(value)}\n`);
    }
    return;
  }

  // ── set ──────────────────────────────────────────────────────────────────
  if (sub === 'set') {
    if (pos.length < 2) {
      die(new CliError(
        'Usage: dev-harness config set <key> <value>\n' +
        '  String values: config set mode copilot\n' +
        '  Boolean values: config set gates.enabled true\n' +
        '  Numeric values: config set maxRetries 5',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const key = pos[0];
    const rawValue = pos.slice(1).join(' '); // support multi-word values

    // Get parameter metadata for type-aware coercion
    const meta = getParamMeta(key);

    // Type coercion: try JSON for arrays/objects, then numbers and booleans
    let parsedValue;
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

    // Validate against config-registry if parameter is known
    if (meta) {
      // Check editability
      if (!meta.editable) {
        const msg = `"${key}" is read-only (managed by harness). Cannot set manually.`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
      // Check enum options
      if (meta.options && !meta.options.includes(parsedValue)) {
        const opts = meta.options.map(o => o === null ? 'null' : `"${o}"`).join(', ');
        const msg = `Invalid value for "${key}". Allowed: ${opts}`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, value: parsedValue, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
      // Check type for integers
      if (meta.type === 'integer' && typeof parsedValue !== 'number') {
        const msg = `"${key}" expects an integer, got ${typeof parsedValue}`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, value: parsedValue, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
      // Check type for booleans
      if (meta.type === 'boolean' && typeof parsedValue !== 'boolean') {
        const msg = `"${key}" expects a boolean (true/false), got ${typeof parsedValue}`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, value: parsedValue, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
      // Check type for arrays
      if (meta.type === 'array' && !Array.isArray(parsedValue)) {
        const msg = `"${key}" expects a JSON array, got ${typeof parsedValue}`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, value: parsedValue, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
      // Check type for objects
      if (meta.type === 'object' && (typeof parsedValue !== 'object' || Array.isArray(parsedValue) || parsedValue === null)) {
        const msg = `"${key}" expects a JSON object, got ${Array.isArray(parsedValue) ? 'array' : typeof parsedValue}`;
        if (json) {
          process.stdout.write(JSON.stringify({ command: 'config', subcommand: 'set', key, value: parsedValue, status: 'error', message: msg }) + '\n');
        } else {
          process.stderr.write(`✗ ${msg}\n`);
        }
        return;
      }
    }

    const result = stateSet(targetDir, key, parsedValue);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'config',
        subcommand: 'set',
        key,
        value: parsedValue,
        status: result.ok ? 'ok' : 'error',
        message: result.ok
          ? `Set ${key} = ${JSON.stringify(parsedValue)}`
          : (result.error || 'Unknown error'),
      }) + '\n');
      return;
    }

    if (result.ok) {
      process.stdout.write(`✓ ${key} = ${JSON.stringify(parsedValue)}\n`);
    } else {
      process.stderr.write(`✗ ${result.error}\n`);
    }
  }
}

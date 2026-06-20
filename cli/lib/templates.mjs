#!/usr/bin/env node
/**
 * templates — Stack-aware template engine CLI.
 *
 * Processes templates/ files with {{VAR}} substitution using
 * stack-specific variables from stacks.json.
 *
 * Usage:
 *   node cli/lib/templates.mjs --stack python --target /tmp/out
 *   node cli/lib/templates.mjs --stack node  --target /tmp/out --override version=0.1.0
 *   node cli/lib/templates.mjs --stack go    --target /tmp/out --json
 *
 * Flags:
 *   --stack <name>     Required. One of: python, node, go, rust, c, cpp, vhdl, verilog
 *   --target <dir>     Required. Output directory (created if missing)
 *   --override k=v     Repeatable. Extra template variables
 *   --json             Machine-parseable JSON output
 *   --help             Show this message
 */

import { readFileSync, writeFileSync, mkdirSync, chmodSync, readdirSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStackVars, listStacks } from './vars.mjs';
import { TEMPLATES_DIR, PROJECT_ROOT } from './paths.mjs';
import { EXECUTABLE_MODE } from './constants.mjs';

const PACKAGE_PATH = resolve(PROJECT_ROOT, 'package.json');

// ── helpers ──────────────────────────────────────────────────────────────────

export function loadPackageVersion() {
  try {
    const raw = readFileSync(PACKAGE_PATH, 'utf-8');
    return JSON.parse(raw).version || '0.1.0';
  } catch {
    return '0.1.0';
  }
}

function parseOverrides(args) {
  const overrides = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--override=')) {
      // --override=k=v (equals between flag & value)
      const val = arg.slice('--override='.length);
      const eqIdx = val.indexOf('=');
      if (eqIdx !== -1) {
        overrides[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
      }
    } else if (arg === '--override' && i + 1 < args.length) {
      // --override key=value or --override key value
      const key = args[i + 1];
      const eqIdx = key.indexOf('=');
      if (eqIdx !== -1) {
        // --override key=value (one arg with =)
        overrides[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
        i++;
      } else if (i + 2 < args.length) {
        // --override key value (two separate args, no =)
        overrides[key] = args[i + 2];
        i += 2;
      }
    }
  }
  return overrides;
}

/**
 * Substitute {{VAR}} placeholders in text with actual values.
 * Unknown variables are left as-is (optional variables in templates).
 * @param {string} text
 * @param {Record<string, string>} vars
 * @returns {string}
 */
export function substitute(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

/**
 * Discover template files in the templates directory.
 * Returns sorted list of absolute paths, excluding dotfiles.
 * @returns {string[]}
 */
export function discoverTemplates() {
  try {
    const result = [];
    const walk = (dir) => {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const fullPath = join(dir, e.name);
        if (e.isDirectory() && !e.name.startsWith('.')) {
          walk(fullPath);
        } else if (e.isFile() && !e.name.startsWith('.')) {
          result.push(fullPath);
        }
      }
    };
    walk(TEMPLATES_DIR);
    return result.sort();
  } catch {
    return [];
  }
}

/**
 * Run the template engine.
 *
 * @param {object} opts
 * @param {string} opts.stack — stack name
 * @param {string} opts.target — output directory
 * @param {object} [opts.overrides] — extra template variables
 * @param {boolean} [opts.json] — JSON output mode
 * @returns {{ files: string[], errors: string[] }}
 */
export function generateTemplates(opts) {
  const { stack, target, overrides = {} } = opts;

  // Load stack variables
  const stackVars = getStackVars(stack, {
    harnessVersion: loadPackageVersion(),
    maxRetries: '3',
    ...overrides,
  });

  // Discover templates
  const templatePaths = discoverTemplates();
  if (templatePaths.length === 0) {
    return { files: [], errors: ['No templates found in ' + TEMPLATES_DIR] };
  }

  // Ensure target directory exists
  mkdirSync(target, { recursive: true });

  const created = [];
  const errors = [];

  for (const tmplPath of templatePaths) {
    const relativePath = tmplPath.startsWith(TEMPLATES_DIR + '/')
      ? tmplPath.slice(TEMPLATES_DIR.length + 1)
      : basename(tmplPath);
    const outPath = join(target, relativePath);
    const outDir = dirname(outPath);

    try {
      if (outDir !== target) {
        mkdirSync(outDir, { recursive: true });
      }
      const raw = readFileSync(tmplPath, 'utf-8');
      const rendered = substitute(raw, stackVars);
      writeFileSync(outPath, rendered, 'utf-8');

      // Make .sh files executable
      if (outPath.endsWith('.sh')) {
        chmodSync(outPath, EXECUTABLE_MODE);
      }

      created.push(outPath);
    } catch (err) {
      errors.push(`${tmplPath}: ${err.message}`);
    }
  }

  return { files: created, errors };
}

// ── CLI entry ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`Usage: node cli/lib/templates.mjs --stack <name> --target <dir> [options]

Flags:
  --stack <name>     Required. Project stack (${listStacks().join(', ')})
  --target <dir>     Required. Output directory
  --override k=v     Repeatable. Extra variables
  --json             Machine-parseable output
  --help             Show this help
`);
    return;
  }

  const json = args.includes('--json');
  const stackIdx = args.indexOf('--stack');
  const targetIdx = args.indexOf('--target');

  if (stackIdx === -1 || stackIdx + 1 >= args.length) {
    const msg = '--stack is required';
    if (json) {
      process.stderr.write(JSON.stringify({ command: 'generate-templates', status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    process.exit(2);
  }

  if (targetIdx === -1 || targetIdx + 1 >= args.length) {
    const msg = '--target is required';
    if (json) {
      process.stderr.write(JSON.stringify({ command: 'generate-templates', status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    process.exit(2);
  }

  const stack = args[stackIdx + 1];
  const target = resolve(args[targetIdx + 1]);

  const valid = listStacks();
  if (!valid.includes(stack)) {
    const msg = `Unknown stack "${stack}". Valid: ${valid.join(', ')}`;
    if (json) {
      process.stderr.write(JSON.stringify({ command: 'generate-templates', status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    process.exit(2);
  }

  const overrides = parseOverrides(args);
  const result = generateTemplates({ stack, target, overrides, json });

  if (json) {
    const successMsg = result.errors.length > 0
      ? `Generated ${result.files.length} file(s) with ${result.errors.length} error(s)`
      : `Generated ${result.files.length} file(s) for stack "${stack}"`;
    process.stdout.write(JSON.stringify({
      command: 'generate-templates',
      status: result.errors.length > 0 ? 'partial' : 'ok',
      message: successMsg,
      stack,
      target,
      filesCreated: result.files.length,
      files: result.files,
      errors: result.errors,
    }) + '\n');
    return;
  }

  // Human output
  for (const f of result.files) {
    process.stdout.write(`  ✓ ${f}\n`);
  }
  for (const e of result.errors) {
    process.stderr.write(`  ✗ ${e}\n`);
  }
  process.stdout.write(`\nCreated ${result.files.length} file(s) for stack "${stack}"\n`);
}

// Only run as CLI when called directly (not when imported as module)
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  main();
}

/**
 * vars — Stack-aware variable loader.
 *
 * Loads stack metadata from stacks.json and returns a flat variable map
 * suitable for {{VAR}} substitution in templates.
 *
 * Usage:
 *   import { getStackVars } from './vars.mjs';
 *   const vars = getStackVars('python');
 *   // → { stack: 'python', testCmd: 'python3 -m pytest', ... }
 */

import { readFileSync } from 'node:fs';
import { STACKS_SCHEMA_PATH } from './paths.mjs';
import { loadConfig } from './state.mjs';

const STACKS_PATH = STACKS_SCHEMA_PATH;

/** @type {Record<string, object>|null} */
let _stacksCache = null;

/**
 * Load and cache the stacks schema.
 * @returns {Record<string, object>}
 */
function loadStacks() {
  if (_stacksCache) {return _stacksCache;}
  const raw = readFileSync(STACKS_PATH, 'utf-8');
  _stacksCache = JSON.parse(raw);
  return _stacksCache;
}

/**
 * Fields in stacks.json that carry through as template variables.
 * Ordered for deterministic output.
 */
const VAR_FIELDS = [
  'label',
  'testCmd',
  'lintCmd',
  'typeCheckCmd',
  'buildCmd',
  'installCmd',
  'versionFile',
  'configFile',
];

/**
 * Get template variables for a given stack.
 *
 * @param {string} stackName — stack name (built-in or custom)
 * @param {object} [overrides] — optional extra variables to merge in (e.g. agent-provided settings)
 * @param {string} [targetDir] — optional project dir (enables config.stackMeta override)
 * @returns {Record<string, string>}
 */
export function getStackVars(stackName, overrides = {}, targetDir) {
  const meta = getEffectiveStackMeta(stackName, targetDir);

  const vars = {
    stack: stackName,
    stackLabel: meta.label || stackName,
  };

  for (const field of VAR_FIELDS) {
    vars[field] = (meta[field] || '').toString();
  }

  // Merge overrides (overwrites any computed vars)
  Object.assign(vars, overrides);

  return vars;
}

/**
 * Get effective stack metadata: config.stackMeta overrides built-in stacks.json.
 * Priority: config.stackMeta > built-in stacks.json[stackName] > generic fallback.
 * @param {string} stackName
 * @param {string} [targetDir] — project dir to read config from
 * @returns {object}
 */
export function getEffectiveStackMeta(stackName, targetDir) {
  const stacks = loadStacks();
  const builtIn = stacks[stackName] || stacks.generic || {};

  // If targetDir given, check config.stackMeta for user/agent overrides
  if (targetDir) {
    try {
      const { config, ok } = loadConfig(targetDir);
      if (ok && config.stackMeta && typeof config.stackMeta === 'object') {
        return { ...builtIn, ...config.stackMeta };
      }
    } catch {
      // config unreadable — use built-in
    }
  }

  return builtIn;
}

/**
 * List all available stack names.
 * @returns {string[]}
 */
export function listStacks() {
  const stacks = loadStacks();
  return Object.keys(stacks).sort();
}

/**
 * Reset internal cache (for testing).
 */
export function _resetCache() {
  _stacksCache = null;
}

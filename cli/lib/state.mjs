/**
 * state — Harness config & state machine.
 *
 * Reads/writes harness-config.json, manages phase transitions,
 * provides dot-notation access for get/set operations.
 *
 * Usage:
 *   import { loadConfig, saveConfig, get, set, transitionPhase } from './state.mjs';
 *   const cfg = loadConfig('/path/to/project');
 *   set('/path/to/project', 'gates.enabled', true);
 *   transitionPhase('/path/to/project', 'build');
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateAgainstSchema } from './validate-schema.mjs';
import { getGitBranch, isGitClean, getLastCommitMessage, hasGitUpstream } from './git.mjs';
import { CONFIG_SCHEMA_PATH, CONFIG_PATH } from './paths.mjs';
import { PHASE_ORDER, getPhaseOrder, isValidTransition } from './phases.mjs';
import { DEFAULT_MAX_RETRIES, COVERAGE_THRESHOLD_DEFAULT } from './constants.mjs';

// Re-export phase logic for backward compatibility (callers import from state.mjs).
export { PHASE_ORDER, getPhaseOrder, isValidTransition };

// ── Default config ───────────────────────────────────────────────────────────

/**
 * Canonical default harness-config.json.
 * @returns {object}
 */
export function getDefaultConfig() {
  return {
    version: '1.0',
    stack: null,
    stackMeta: null,
    agentTool: null,
    mode: 'copilot',
    currentPhase: null,
    paused: false,
    features: {
      remaining: 0,
      passing: 0,
      total: 0,
    },
    gates: {
      enabled: false,
      checks: ['all'],
      coverage: {
        enabled: false,
        threshold: COVERAGE_THRESHOLD_DEFAULT,
      },
    },
    git: {
      autoCommit: false,
      autoTag: false,
      resetOnRetry: false,
      branch: null,
      clean: true,
      hasUpstream: false,
      lastCommitMessage: null,
    },
    phases: {
      enabled: ['define', 'plan', 'build', 'verify', 'review', 'ship'],
    },
    agents: {
      tone: {
        planner: 'Analytical and precise. Define clear boundaries.',
        generator: 'Focused and practical. Build what\'s specified, nothing more.',
        evaluator: 'Skeptical and thorough. Accept only compelling evidence.',
        simplifier: 'Relentless about clarity. Delete more than you add.',
      },
    },
    maxRetries: DEFAULT_MAX_RETRIES,
    retryCount: 0,
    pipelineIteration: 0,
    gateHistory: [],
  };
}

// ── File I/O ─────────────────────────────────────────────────────────────────

/**
 * Get the path to harness-config.json for a given project directory.
 * @param {string} targetDir
 * @returns {string}
 */
export function getConfigPath(targetDir) {
  return CONFIG_PATH(targetDir);
}

/**
 * Deep-merge a partial config into defaults.
 * Missing keys get default values; extra keys preserved.
 * @param {object} defaults
 * @param {object} partial
 * @returns {object}
 */
function deepMerge(defaults, partial) {
  const result = { ...defaults };
  for (const key of Object.keys(partial)) {
    if (
      defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) &&
      partial[key] && typeof partial[key] === 'object' && !Array.isArray(partial[key])
    ) {
      result[key] = deepMerge(defaults[key], partial[key]);
    } else {
      result[key] = partial[key];
    }
  }
  return result;
}

/**
 * Load harness-config.json, merging with defaults.
 * Returns defaults if file doesn't exist or is invalid.
 * @param {string} targetDir
 * @returns {{ config: object, path: string, ok: boolean, error: string|null }}
 */
export function loadConfig(targetDir) {
  const cfgPath = getConfigPath(targetDir);
  const defaults = getDefaultConfig();

  if (!existsSync(cfgPath)) {
    return {
      config: defaults,
      path: cfgPath,
      ok: false,
      error: `Not found: ${cfgPath}. Run: harness-dev init`,
    };
  }

  try {
    const raw = readFileSync(cfgPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const config = deepMerge(defaults, parsed);
    // Schema validation — non-blocking: return errors in result so callers
    // (e.g. status command) can surface them. Library does NOT write to stderr
    // to keep the error contract clean (stderr reserved for real errors).
    const schemaResult = validateAgainstSchema(config, CONFIG_SCHEMA_PATH);
    return { config, path: cfgPath, ok: true, error: null, schemaErrors: schemaResult.ok ? [] : schemaResult.errors };
  } catch (err) {
    return {
      config: defaults,
      path: cfgPath,
      ok: false,
      error: `Invalid config: ${err.message}`,
    };
  }
}

/**
 * Save config to harness-config.json.
 * @param {string} targetDir
 * @param {object} cfg
 * @returns {{ ok: boolean, error: string|null }}
 */
export function saveConfig(targetDir, cfg) {
  try {
    const cfgPath = getConfigPath(targetDir);
    mkdirSync(dirname(cfgPath), { recursive: true });
    writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Dot-notation access ──────────────────────────────────────────────────────

/**
 * Resolve a dot-notation key against an object.
 * @param {object} obj
 * @param {string} key — e.g. "gates.enabled"
 * @returns {any}
 */
function resolveKey(obj, key) {
  const parts = key.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Set a dot-notation key on an object (mutates in-place).
 * @param {object} obj
 * @param {string} key
 * @param {any} value
 */
function setKey(obj, key, value) {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

/**
 * Get a config value by dot-notation key.
 * Loads from disk on each call (always fresh).
 * @param {string} targetDir
 * @param {string} key — dot-notation key
 * @returns {{ value: any, ok: boolean, error: string|null }}
 */
export function get(targetDir, key) {
  const { config, ok, error } = loadConfig(targetDir);
  if (key) {
    const value = resolveKey(config, key);
    return { value: value !== undefined ? value : null, ok, error };
  }
  return { value: config, ok, error };
}

/**
 * Set a config value by dot-notation key and save to disk.
 * @param {string} targetDir
 * @param {string} key — dot-notation key
 * @param {any} value
 * @returns {{ ok: boolean, error: string|null }}
 */
export function set(targetDir, key, value) {
  const { config } = loadConfig(targetDir);
  setKey(config, key, value);
  return saveConfig(targetDir, config);
}

// ── Phase transitions ────────────────────────────────────────────────────────

/**
 * Record a gate result in gateHistory.
 * @param {object} config
 * @param {string} phase
 * @param {string} result — "pass" | "fail"
 */
function recordGate(config, phase, result) {
  if (!config.gateHistory) {config.gateHistory = [];}
  config.gateHistory.push({
    phase,
    result,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Transition to the next phase.
 *
 * Steps:
 * 1. Validate transition
 * 2. Record old phase gate to history
 * 3. Update currentPhase
 * 4. Update git.branch, git.clean, git.lastCommitMessage
 * 5. Save config
 *
 * @param {string} targetDir
 * @param {string} toPhase
 * @returns {{ ok: boolean, error: string|null, config: object|null }}
 */
export function transitionPhase(targetDir, toPhase) {
  const { config, ok, error } = loadConfig(targetDir);
  if (!ok) {
    return { ok: false, error: error || 'Cannot load config', config: null };
  }

  const enabled = config.phases?.enabled;
  if (!isValidTransition(config.currentPhase, toPhase, enabled)) {
    const order = getPhaseOrder(enabled).join(' → ');
    return {
      ok: false,
      error: `Invalid transition: "${config.currentPhase || 'start'}" → "${toPhase}". Valid order: ${order}`,
      config: null,
    };
  }

  // Record old phase gate if leaving a phase (skip for same-phase re-run)
  if (config.currentPhase && config.currentPhase !== toPhase) {
    recordGate(config, config.currentPhase, 'pass');
  }

  // Retry tracking: increment on same-phase re-run, reset on new phase
  const isNewPhase = config.currentPhase !== toPhase;
  if (config.retryCount === undefined) {config.retryCount = 0;}
  if (isNewPhase) {
    config.retryCount = 0;
  } else {
    config.retryCount = (config.retryCount || 0) + 1;
  }

  // Update phase
  config.currentPhase = toPhase;

  // Update git metadata
  config.git = config.git || {};
  config.git.branch = getGitBranch(targetDir);
  config.git.clean = isGitClean(targetDir);
  config.git.hasUpstream = hasGitUpstream(targetDir);
  config.git.lastCommitMessage = getLastCommitMessage(targetDir);

  // Clear pause on transition
  config.paused = false;

  const saveResult = saveConfig(targetDir, config);
  if (!saveResult.ok) {
    return { ok: false, error: saveResult.error, config: null };
  }

  return { ok: true, error: null, config };
}

/**
 * Validate config against the JSON schema.
 * Returns list of missing required fields.
 * @param {object} cfg
 * @returns {string[]}
 */
export function validateConfig(cfg) {
  const required = ['version', 'mode', 'currentPhase', 'gates', 'git', 'phases', 'maxRetries'];
  // Fields where `null` is a valid value (must not report as missing)
  const nullable = new Set(['currentPhase']);
  const missing = [];
  for (const field of required) {
    if (cfg[field] === undefined || (!nullable.has(field) && cfg[field] === null)) {
      missing.push(field);
    }
  }
  return missing;
}

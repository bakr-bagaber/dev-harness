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
import { CONFIG_SCHEMA_PATH, CONFIG_PATH, FEATURE_LIST_PATH } from './paths.mjs';
import { PHASE_ORDER, getPhaseOrder, isValidTransition } from './phases.mjs';
import { DEFAULT_MAX_RETRIES, DEFAULT_FEATURE_RETRIES, DEFAULT_PHASE_RETRIES, COVERAGE_THRESHOLD_DEFAULT } from './constants.mjs';

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
    currentRole: null,
    paused: false,
    features: {
      remaining: 0,
      passing: 0,
      total: 0,
    },
    gates: {
      // G12: gates ON by default (was false). Enforcement by default, permissive opt-out.
      // Existing projects keep their explicit config (migration: don't force-on).
      enabled: true,
      checks: ['all'],
      coverage: {
        enabled: false,
        threshold: COVERAGE_THRESHOLD_DEFAULT,
      },
      cleanState: {
        enabled: false,
        stalePatterns: [],
        startupCmd: null,
      },
      antiPlaceholder: {
        enabled: true,
        patterns: [],
      },
    },
    cleanup: {
      schedule: '0 2 * * 0',
      autoFix: false,
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
    retry: {
      tasks:    { enabled: true,  maxRetries: null },  // null → fall back to legacy maxRetries
      features: { enabled: false, maxRetries: DEFAULT_FEATURE_RETRIES },
      phases:   { enabled: false, maxRetries: DEFAULT_PHASE_RETRIES },
    },
    retryCount: 0,
    taskRetryCount: 0,
    featureRetryCount: 0,
    phaseRetryCount: 0,
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
      error: `Not found: ${cfgPath}. Run: dev-harness init`,
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
 * Auto-creates null/undefined parent objects (fixes G1: `config set stackMeta.x`
 * no longer throws TypeError when stackMeta defaults to null).
 * @param {object} obj
 * @param {string} key
 * @param {any} value
 */
function setKey(obj, key, value) {
  const parts = key.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    // G1 fix: auto-create null/undefined/non-object parents as empty objects.
    // Previously: `if (!(parts[i] in current) || typeof current[parts[i]] !== 'object')`
    // threw TypeError when current[parts[i]] was null (stackMeta defaults to null).
    if (current[parts[i]] === null || current[parts[i]] === undefined || typeof current[parts[i]] !== 'object') {
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
export function recordGate(config, phase, result) {
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
 * @returns {Promise<{ ok: boolean, error: string|null, config: object|null }>}
 */
export async function transitionPhase(targetDir, toPhase) {
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

  // Retry tracking: increment on same-phase re-run, reset on new phase.
  // For feature-iterate phases (build, verify, simplify), retryCount is
  // reset to 0 by validate when a task passes — so only actual failures
  // (where validate fails and agent re-runs the phase) accumulate retries.
  // For deliverable-retry phases, each re-run is a retry by definition.
  // v3.1.0+: phaseRetryCount is the new per-phase counter (gated by
  // retry.phases.enabled); retryCount is kept for backward compat.
  const isNewPhase = config.currentPhase !== toPhase;
  if (config.retryCount === undefined) {config.retryCount = 0;}
  if (config.phaseRetryCount === undefined) {config.phaseRetryCount = 0;}
  if (isNewPhase) {
    config.retryCount = 0;
    config.phaseRetryCount = 0;
  } else {
    config.retryCount = (config.retryCount || 0) + 1;
    config.phaseRetryCount = (config.phaseRetryCount || 0) + 1;
  }

  // Capture the FROM phase before overwriting (for the progress.md history line).
  const fromPhase = config.currentPhase;

  // Update phase
  config.currentPhase = toPhase;

  // Update git metadata (async — git.mjs is now backed by simple-git)
  config.git = config.git || {};
  config.git.branch = await getGitBranch(targetDir);
  config.git.clean = await isGitClean(targetDir);
  config.git.hasUpstream = await hasGitUpstream(targetDir);
  config.git.lastCommitMessage = await getLastCommitMessage(targetDir);

  // Clear pause on transition
  config.paused = false;

  const saveResult = saveConfig(targetDir, config);
  if (!saveResult.ok) {
    return { ok: false, error: saveResult.error, config: null };
  }

  // G13/G14/G17: fire session boundary at phase transition (trigger #3).
  // fireSessionBoundary writes the handoff snapshot (overwrite), runs the
  // clean-state gate (advisory by default), and appends a progress.md history
  // line. Kept best-effort: handoff never breaks the transition.
  try {
    const { fireSessionBoundary } = await import('./session-boundary.mjs');
    await fireSessionBoundary(targetDir, 'phase-transition', {
      progressAction: `phase transition: ${fromPhase || 'start'} → ${toPhase}`,
    });
  } catch (_e) {
    // Non-fatal: handoff is best-effort, never break the transition.
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

// ── Retry helpers (v3.1.0+) ──────────────────────────────────────────────────
// These helpers operate on an in-memory config object (already loaded by the
// caller). Callers are responsible for saveConfig() after mutations.

/**
 * Resolve the effective retry configuration, seeding from the legacy
 * `maxRetries` field for backward compatibility when the `retry` group is
 * absent or incomplete.
 * @param {object} config
 * @returns {{ tasks: {enabled:boolean,maxRetries:number}, features: {enabled:boolean,maxRetries:number}, phases: {enabled:boolean,maxRetries:number} }}
 */
export function getRetryConfig(config) {
  const legacy = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const r = config.retry ?? {};
  return {
    tasks: {
      enabled: r.tasks?.enabled ?? true,
      // null → fall back to legacy maxRetries for backward compatibility
      maxRetries: r.tasks?.maxRetries ?? legacy,
    },
    features: {
      enabled: r.features?.enabled ?? false,
      maxRetries: r.features?.maxRetries ?? DEFAULT_FEATURE_RETRIES,
    },
    phases: {
      enabled: r.phases?.enabled ?? false,
      maxRetries: r.phases?.maxRetries ?? DEFAULT_PHASE_RETRIES,
    },
  };
}

/**
 * Reset task retry state for a specific task (and the global taskRetryCount).
 * @param {object} config
 */
export function resetTaskRetry(config) {
  config.taskRetryCount = 0;
}

/**
 * Increment the per-task retry counter.
 * @param {object} config
 * @returns {number} new value
 */
export function incrementTaskRetry(config) {
  config.taskRetryCount = (config.taskRetryCount ?? 0) + 1;
  return config.taskRetryCount;
}

/**
 * Reset feature retry state for a feature (and the global featureRetryCount).
 * @param {object} config
 */
export function resetFeatureRetry(config) {
  config.featureRetryCount = 0;
}

/**
 * Increment the per-feature retry counter.
 * @param {object} config
 * @returns {number} new value
 */
export function incrementFeatureRetry(config) {
  config.featureRetryCount = (config.featureRetryCount ?? 0) + 1;
  return config.featureRetryCount;
}

/**
 * Reset phase retry state (and the legacy retryCount for backward compat).
 * @param {object} config
 */
export function resetPhaseRetry(config) {
  config.phaseRetryCount = 0;
  config.retryCount = 0;
}

/**
 * Increment the per-phase retry counter (and the legacy retryCount).
 * @param {object} config
 * @returns {number} new phaseRetryCount
 */
export function incrementPhaseRetry(config) {
  config.phaseRetryCount = (config.phaseRetryCount ?? 0) + 1;
  config.retryCount = (config.retryCount ?? 0) + 1;
  return config.phaseRetryCount;
}

/**
 * Recompute config.features.{remaining,passing,total} from feature_list.json
 * so the status command shows live counts (fixes G10).
 * @param {string} targetDir
 * @param {object} [config] — optional pre-loaded config (avoids double read)
 * @returns {{ ok: boolean, error: string|null }}
 */
export function syncFeatureSummary(targetDir, config) {
  const cfg = config ?? loadConfig(targetDir).config;
  if (!cfg) {return { ok: false, error: 'Cannot load config' };}
  try {
    const flPath = FEATURE_LIST_PATH(targetDir);
    if (!existsSync(flPath)) {
      cfg.features = cfg.features || {};
      cfg.features.remaining = 0;
      cfg.features.passing = 0;
      cfg.features.total = 0;
      return saveConfig(targetDir, cfg);
    }
    const fl = JSON.parse(readFileSync(flPath, 'utf8'));
    const features = Array.isArray(fl.features) ? fl.features : [];
    const total = features.length;
    const passing = features.filter(f => f.passes === true).length;
    cfg.features = cfg.features || {};
    cfg.features.total = total;
    cfg.features.passing = passing;
    cfg.features.remaining = total - passing;
    return saveConfig(targetDir, cfg);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

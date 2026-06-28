/**
 * ralph-shared — Shared utilities for the three Ralph loop engines.
 *
 * The three Ralph loops (ralph-tasks, ralph-features, ralph-phases) all need
 * access to the same primitives: feature-list I/O, phase-type classification,
 * and instruction-output builders. Centralizing them here breaks what would
 * otherwise be a circular dependency (tasks ↔ features) and gives each loop
 * file a single, focused responsibility.
 *
 * This module has NO dependencies on any ralph-*.mjs file — it is the leaf
 * of the dependency graph and may be imported freely by all three loops.
 *
 * Usage:
 *   import {
 *     getPhaseType,
 *     loadFeatureList, saveFeatureList,
 *     getNextFeature, getNextTask,
 *     buildFeatureIterateOutput, buildDeliverableRetryOutput,
 *   } from './ralph-shared.mjs';
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, getRetryConfig } from './state.mjs';
import { validateAgainstSchema } from './validate-schema.mjs';
import { phaseLabel } from './command-helpers.mjs';
import { FEATURE_LIST_SCHEMA_PATH, FEATURE_LIST_PATH } from './paths.mjs';

// ── Phase type classification ────────────────────────────────────────────────

/** Phases that iterate features (each feature has tasks). */
const FEATURE_ITERATE_PHASES = new Set(['build', 'verify', 'simplify']);

/** Phases that produce a single deliverable and retry it on failure. */
const DELIVERABLE_RETRY_PHASES = new Set(['init', 'define', 'plan', 'review', 'ship']);

/**
 * Determine the loop mode for a given phase.
 * @param {string} phase
 * @returns {'feature-iterate'|'deliverable-retry'|null}
 */
export function getPhaseType(phase) {
  if (FEATURE_ITERATE_PHASES.has(phase)) {return 'feature-iterate';}
  if (DELIVERABLE_RETRY_PHASES.has(phase)) {return 'deliverable-retry';}
  return null;
}

// ── Feature list I/O ─────────────────────────────────────────────────────────

/**
 * Default feature list (empty, one placeholder feature).
 * @returns {object}
 */
function getDefaultFeatureList() {
  return {
    version: '0.1',
    features: [
      {
        id: 'feature-001',
        name: 'Feature 1',
        description: 'Replace with actual feature description',
        passes: false,
        tasks: [
          { id: 'task-001', description: 'First task', status: 'pending' },
        ],
      },
    ],
  };
}

/**
 * Load feature_list.json. Returns defaults if missing/invalid.
 * @param {string} targetDir
 * @returns {{ features: Array, ok: boolean, path: string, schemaErrors?: Array }}
 */
export function loadFeatureList(targetDir) {
  const flPath = FEATURE_LIST_PATH(targetDir);
  if (!existsSync(flPath)) {
    return { ...getDefaultFeatureList(), ok: false, path: flPath };
  }
  try {
    const raw = readFileSync(flPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = { version: parsed.version || '0.1', features: parsed.features || [], ok: true, path: flPath };
    // Schema validation — non-blocking: return errors in result. Library does
    // NOT write to stderr (keeps error contract clean for --json consumers).
    const schemaResult = validateAgainstSchema(parsed, FEATURE_LIST_SCHEMA_PATH);
    result.schemaErrors = schemaResult.ok ? [] : schemaResult.errors;
    return result;
  } catch {
    return { ...getDefaultFeatureList(), ok: false, path: flPath };
  }
}

/**
 * Save feature_list.json.
 * @param {string} targetDir
 * @param {object} data
 * @returns {{ ok: boolean, error: string|null }}
 */
export function saveFeatureList(targetDir, data) {
  try {
    const flPath = FEATURE_LIST_PATH(targetDir);
    mkdirSync(dirname(flPath), { recursive: true });
    writeFileSync(flPath, JSON.stringify({ version: '0.1', features: data.features }, null, 2) + '\n', 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Find the next incomplete feature (passes=false).
 * @param {Array} features
 * @returns {object|null}
 */
export function getNextFeature(features) {
  return features.find(f => !f.passes) || null;
}

/**
 * Find the next uncompleted task in a feature.
 * @param {object} feature
 * @returns {object|null}
 */
export function getNextTask(feature) {
  if (!feature.tasks) {return null;}
  return feature.tasks.find(t => t.status === 'pending' || t.status === 'in_progress') || null;
}

// ── Instruction output builders ──────────────────────────────────────────────
// These build the human-readable instruction strings the agent follows.
// Kept here so all three loops produce identical, centrally-maintained output.

/**
 * Build the instruction output for a feature-iterate phase step.
 * @param {string} phase
 * @param {object} feature
 * @param {object} task
 * @param {number} maxRetries
 * @param {boolean} resetOnRetry
 * @param {boolean} autoCommit
 * @returns {string}
 */
export function buildFeatureIterateOutput(phase, feature, task, maxRetries, resetOnRetry, autoCommit) {
  const label = phaseLabel(phase);
  const extra = phase === 'simplify'
    ? `\n\nSimplifier focus:\n` +
      `- Remove code smells, deep nesting, DRY violations, dead code\n` +
      `- Consolidate duplicate logic\n` +
      `- Simplify complex conditionals\n` +
      `- Ensure tests still pass after simplification\n` +
      `- Delete more than you add`
    : '';
  return `═══ ${phase.toUpperCase()} PHASE ═══\n` +
    `Mode: feature-iterate\n\n` +
    `${label} — Feature: ${feature.name} — Task: ${task.description}\n` +
    `Current feature: ${feature.name}\n` +
    `Current task: ${task.description}\n\n` +
    `Planner: scope of this task\n` +
    `Generator: implement/test/simplify\n` +
    `Evaluator: verify against acceptance criteria\n` +
    `Run: dev-harness validate --feature ${feature.id} --task ${task.id}\n` +
    `Retry: ${maxRetries} max, reset on success${resetOnRetry ? ', git reset on retry' : ''}${autoCommit ? ', auto-commit' : ''}` +
    extra;
}

/**
 * Build the instruction output for a deliverable-retry phase step.
 * @param {string} phase
 * @param {number} maxRetries
 * @param {boolean} resetOnRetry
 * @param {boolean} autoCommit
 * @returns {string}
 */
export function buildDeliverableRetryOutput(phase, maxRetries, resetOnRetry, autoCommit) {
  const label = phaseLabel(phase);
  return `═══ ${phase.toUpperCase()} PHASE ═══\n` +
    `Mode: deliverable-retry\n\n` +
    `${label}: produce the deliverable\n\n` +
    `Planner: define scope of this deliverable\n` +
    `Generator: produce it\n` +
    `Evaluator: verify against phase criteria\n` +
    `Run: dev-harness validate\n` +
    `Retry: ${maxRetries} max${resetOnRetry ? ', git reset on retry' : ''}${autoCommit ? ', auto-commit' : ''}`;
}

// ── Shared config loader for the loops ──────────────────────────────────────
// Each loop needs config + retry config + display flags. Centralizing the
// extraction keeps the loop bodies focused on their iteration logic.

/**
 * Load config and derive the common loop options.
 * @param {string} targetDir
 * @returns {{ config: object, ok: boolean, mode: string, retryCfg: object, maxRetries: number, resetOnRetry: boolean, autoCommit: boolean }}
 */
export function loadLoopConfig(targetDir) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    return { config: null, ok: false, mode: 'copilot', retryCfg: null, maxRetries: 0, resetOnRetry: false, autoCommit: false };
  }
  const mode = config.mode ?? 'copilot';
  const retryCfg = getRetryConfig(config);
  return {
    config,
    ok: true,
    mode,
    retryCfg,
    maxRetries: retryCfg.tasks.maxRetries,
    resetOnRetry: config.git?.resetOnRetry === true,
    autoCommit: config.git?.autoCommit === true,
  };
}

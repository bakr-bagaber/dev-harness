/**
 * ralph-inner — Inner Ralph Loop Engine.
 *
 * Runs the work → validate → pass/retry loop for every phase.
 * Two modes:
 *   - Feature-iterate (BUILD, VERIFY, SIMPLIFY): iterates features/tasks
 *   - Deliverable-retry (INIT, DEFINE, PLAN, REVIEW, SHIP): retries same deliverable
 *
 * The engine prints instructions for the agent. It does NOT do the work itself.
 *
 * Usage:
 *   import { runPhase } from './ralph-inner.mjs';
 *   const result = runPhase('/path/to/project', 'build');
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadConfig, getRetryConfig } from './state.mjs';
import { validateAgainstSchema } from './validate-schema.mjs';
import { gitHardResetClean } from './git.mjs';
import { phaseLabel } from './command-helpers.mjs';
import { FEATURE_LIST_SCHEMA_PATH, FEATURE_LIST_PATH } from './paths.mjs';
import { buildFeatureIterateOutput, buildDeliverableRetryOutput } from './ralph-output.mjs';
import { DEFAULT_MAX_RETRIES } from './constants.mjs';

// ── Phase type classification ────────────────────────────────────────────────

/** Phases that iterate features (each feature has tasks). */
const FEATURE_ITERATE = new Set(['build', 'verify', 'simplify']);

/** Phases that produce a single deliverable and retry it on failure. */
const DELIVERABLE_RETRY = new Set(['init', 'define', 'plan', 'review', 'ship']);

/**
 * Determine the loop mode for a given phase.
 * @param {string} phase
 * @returns {'feature-iterate'|'deliverable-retry'|null}
 */
export function getPhaseType(phase) {
  if (FEATURE_ITERATE.has(phase)) {return 'feature-iterate';}
  if (DELIVERABLE_RETRY.has(phase)) {return 'deliverable-retry';}
  return null;
}

// ── Feature list I/O ─────────────────────────────────────────────────────────

/**
 * Get path to feature_list.json.
 * @param {string} targetDir
 * @returns {string}
 */
function getFeatureListPath(targetDir) {
  return FEATURE_LIST_PATH(targetDir);
}

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
 * @returns {{ features: Array, ok: boolean, path: string }}
 */
export function loadFeatureList(targetDir) {
  const flPath = getFeatureListPath(targetDir);
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
    const flPath = getFeatureListPath(targetDir);
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

// ── Inner loop ───────────────────────────────────────────────────────────────

/**
 * Run the inner Ralph loop for a phase.
 *
 * This function prints instructions and returns a result object.
 * It does NOT modify files — the agent reads the instructions and does the work.
 *
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} [options]
 * @param {boolean} [options.json] — JSON output mode
 * @param {boolean} [options.gitOps] — opt-in: execute git reset/clean on retry (default off)
 * @returns {Promise<{ ok: boolean, status: string, message: string, phase: string, iteration: number, mode: string, details: object }>}
 */
export async function runPhase(targetDir, phase, options = {}) {
  const { json = false, gitOps = false } = options;

  // Load config
  const { config, ok: configOk } = loadConfig(targetDir);
  if (!configOk) {
    return { ok: false, status: 'error', message: 'Cannot load config', phase, iteration: 0, mode: 'unknown', details: {} };
  }

  const mode = config.mode ?? 'copilot';
  const retryCfg = getRetryConfig(config);
  // For display/output backward compat — the primary task retry budget.
  const maxRetries = retryCfg.tasks.maxRetries;
  const resetOnRetry = config.git?.resetOnRetry === true;
  const autoCommit = config.git?.autoCommit === true;
  const phaseType = getPhaseType(phase);

  if (!phaseType) {
    return { ok: false, status: 'error', message: `Unknown phase type for "${phase}"`, phase, iteration: 0, mode, details: {} };
  }

  // ── v3.1.0+ 3-level retry escalation checks ──────────────────────────────
  // Inner loop owns task + feature escalation. Phase escalation is the outer
  // loop's job (signaled via 'feature-exhausted' / 'deliverable-exhausted').
  const retryCount = config.retryCount ?? 0;
  const taskRetryCount = config.taskRetryCount ?? 0;
  const featureRetryCount = config.featureRetryCount ?? 0;
  const phaseRetryCount = config.phaseRetryCount ?? 0;

  if (phaseType === 'feature-iterate') {
    // Task level
    if (retryCfg.tasks.enabled && taskRetryCount >= retryCfg.tasks.maxRetries) {
      // Task exhausted → feature level
      if (retryCfg.features.enabled && featureRetryCount >= retryCfg.features.maxRetries) {
        // Feature exhausted → signal outer loop (do NOT escalate to human here)
        return {
          ok: false,
          status: 'feature-exhausted',
          message: `Feature retries exhausted (${featureRetryCount}/${retryCfg.features.maxRetries}) for phase "${phase}" after task retries (${taskRetryCount}/${retryCfg.tasks.maxRetries}). Signaling outer loop for phase retry or escalation.`,
          phase,
          iteration: featureRetryCount,
          mode,
          details: { taskRetryCount, featureRetryCount, phaseRetryCount, retryCfg },
        };
      }
      if (!retryCfg.features.enabled) {
        // Feature retry disabled → signal outer loop immediately
        return {
          ok: false,
          status: 'feature-exhausted',
          message: `Task retries exhausted (${taskRetryCount}/${retryCfg.tasks.maxRetries}) for phase "${phase}" and feature retry is disabled. Signaling outer loop for phase retry or escalation.`,
          phase,
          iteration: taskRetryCount,
          mode,
          details: { taskRetryCount, featureRetryCount, phaseRetryCount, retryCfg },
        };
      }
      // Feature retry still has budget — fall through; the validate command
      // handles the feature reset + re-sweep on the next iteration.
    }
  } else {
    // Deliverable-retry phase → phase-level retry only
    if (retryCfg.phases.enabled && phaseRetryCount >= retryCfg.phases.maxRetries) {
      return {
        ok: false,
        status: 'deliverable-exhausted',
        message: `Phase retries exhausted (${phaseRetryCount}/${retryCfg.phases.maxRetries}) for deliverable phase "${phase}". Signaling outer loop for escalation.`,
        phase,
        iteration: phaseRetryCount,
        mode,
        details: { phaseRetryCount, retryCount, retryCfg },
      };
    }
    if (!retryCfg.phases.enabled && retryCount >= retryCfg.tasks.maxRetries) {
      // Legacy path: phases retry disabled, use retryCount vs maxRetries
      return {
        ok: false,
        status: 'deliverable-exhausted',
        message: `Retries exhausted (${retryCount}/${retryCfg.tasks.maxRetries}) for deliverable phase "${phase}" and phase retry is disabled. Signaling outer loop for escalation.`,
        phase,
        iteration: retryCount,
        mode,
        details: { retryCount, phaseRetryCount, retryCfg },
      };
    }
  }

  // ── Opt-in git ops: fresh context on retry ──────────────────────────────
  // When --git-ops is passed AND this is a retry (retryCount > 0), execute a
  // hard reset to the last commit + clean untracked files. This gives the
  // "fresh context" Ralph requires without forcing it on agent-agnostic users.
  let gitResetPerformed = false;
  if (gitOps && retryCount > 0) {
    const resetResult = await gitHardResetClean(targetDir);
    if (resetResult.ok) {
      gitResetPerformed = true;
      if (!json) {
        process.stdout.write(`  ↻ Git reset performed (retry ${retryCount}): fresh context restored.\n`);
      }
    } else {
      // Non-fatal: if git ops fail (e.g. not a repo), continue with instructions.
      process.stderr.write(`Warning: --git-ops reset failed: ${resetResult.error}\n`);
    }
  }

  // ── Feature-iterate mode (BUILD, VERIFY, SIMPLIFY) ────────────────────────

  if (phaseType === 'feature-iterate') {
    const fl = loadFeatureList(targetDir);
    const feature = getNextFeature(fl.features);
    const featuresTotal = fl.features.length;
    const featuresDone = fl.features.filter(f => f.passes).length;

    if (!feature) {
      // All features pass — phase gate passes
      return {
        ok: true,
        status: 'complete',
        message: `All ${featuresTotal} feature(s) pass. Phase gate passes.`,
        phase,
        iteration: 0,
        mode,
        details: { featuresTotal, featuresDone, currentFeature: null, currentTask: null },
      };
    }

    const task = getNextTask(feature);
    if (!task) {
      // Feature has all tasks complete but passes=false → mark it passing
      feature.passes = true;
      saveFeatureList(targetDir, fl);
      return await runPhase(targetDir, phase, options); // Recurse to get next feature
    }

    const output = buildFeatureIterateOutput(phase, feature, task, mode, maxRetries, resetOnRetry, autoCommit);

    if (json) {
      return {
        ok: true,
        status: 'instruction',
        message: `${phaseLabel(phase)} — Feature: ${feature.name} — Task: ${task.description}`,
        phase,
        iteration: 1,
        mode,
        details: {
          featuresTotal,
          featuresDone,
          featureId: feature.id,
          featureName: feature.name,
          taskId: task.id,
          taskDescription: task.description,
          phaseType,
          maxRetries,
          retry: retryCfg,
          taskRetryCount: config.taskRetryCount ?? 0,
          featureRetryCount: config.featureRetryCount ?? 0,
          phaseRetryCount: config.phaseRetryCount ?? 0,
          resetOnRetry,
          autoCommit,
          gitOps,
          gitResetPerformed,
          instructions: output,
        },
      };
    }

    // Human output
    process.stdout.write(output);
    process.stdout.write(`\n═══════════════════════════════════════\n`);
    process.stdout.write(`Run: dev-harness validate --feature ${feature.id} --task ${task.id}\n`);
    process.stdout.write(`═══════════════════════════════════════\n`);

    return {
      ok: true,
      status: 'instruction',
      message: `Working on: ${feature.name} — ${task.description}`,
      phase,
      iteration: 1,
      mode,
      details: { featureId: feature.id, taskId: task.id },
    };
  }

  // ── Deliverable-retry mode (INIT, DEFINE, PLAN, REVIEW, SHIP) ────────────

  const output = buildDeliverableRetryOutput(phase, mode, maxRetries, resetOnRetry, autoCommit);

  if (json) {
    return {
      ok: true,
      status: 'instruction',
      message: `${phaseLabel(phase)}: produce the deliverable`,
      phase,
      iteration: 1,
      mode,
      details: {
        phaseType,
        maxRetries,
        retry: retryCfg,
        retryCount: config.retryCount ?? 0,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        resetOnRetry,
        autoCommit,
        instructions: output,
      },
    };
  }

  // Human output
  process.stdout.write(output);
  process.stdout.write(`\n═══════════════════════════════════════\n`);
  process.stdout.write(`Run: dev-harness validate\n`);
  process.stdout.write(`═══════════════════════════════════════\n`);

  return {
    ok: true,
    status: 'instruction',
    message: `${phaseLabel(phase)}: produce the deliverable`,
    phase,
    iteration: 1,
    mode,
    details: {},
  };
}


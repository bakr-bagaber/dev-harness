/**
 * ralph-features — Feature Ralph Loop Engine (middle loop).
 *
 * Iterates features within a single phase. For each feature, it delegates to
 * the task loop (ralph-tasks.mjs) to iterate that feature's tasks. When the
 * task loop signals that all tasks in a feature are complete, the feature
 * loop marks the feature as passing and advances to the next feature. When
 * all features pass, it signals completion to the phase loop.
 *
 * Responsibilities:
 *   - Find the next incomplete feature (passes=false)
 *   - Delegate each feature to the task loop
 *   - Mark features passing when their tasks complete
 *   - Own feature-level retry escalation (feature → phase signal)
 *
 * Does NOT own:
 *   - Task iteration (that's ralph-tasks.mjs)
 *   - Phase iteration (that's ralph-phases.mjs)
 *   - Feature-list I/O or phase classification (that's ralph-shared.mjs)
 *
 * Three Ralph loops:
 *   - ralph-tasks.mjs    — task loop (innermost): iterates tasks within a feature
 *   - ralph-features.mjs — feature loop (middle): iterates features within a phase
 *   - ralph-phases.mjs   — phase loop (outermost): iterates phases in the pipeline
 *
 * Usage:
 *   import { runFeatureLoop } from './ralph-features.mjs';
 *   const result = runFeatureLoop('/path/to/project', 'build', { json: true });
 */
import { set as stateSet } from './state.mjs';
import { runTaskLoop } from './ralph-tasks.mjs';
import {
  loadLoopConfig,
  loadFeatureList,
  saveFeatureList,
  getNextFeature,
} from './ralph-shared.mjs';

/**
 * Run the feature loop for a feature-iterate phase (BUILD, VERIFY, SIMPLIFY).
 *
 * Finds the next incomplete feature, delegates it to the task loop, and
 * returns the task loop's result. When the task loop signals that a feature's
 * tasks are all complete, marks the feature as passing and advances to the
 * next feature. When all features pass, signals 'complete' to the phase loop.
 *
 * Feature-level retry escalation: when the task loop signals 'task-exhausted',
 * the feature loop decides whether to retry the feature (if feature retry is
 * enabled and under budget) or signal 'feature-exhausted' to the phase loop.
 *
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} [options]
 * @param {boolean} [options.json] — JSON output mode
 * @param {boolean} [options.gitOps] — opt-in: execute git reset/clean on retry
 * @returns {Promise<{ ok: boolean, status: string, message: string, phase: string, details: object }>}
 */
export async function runFeatureLoop(targetDir, phase, options = {}) {
  const { json = false, gitOps = false } = options;

  const { config, ok: configOk, mode, retryCfg } = loadLoopConfig(targetDir);
  if (!configOk) {
    return { ok: false, status: 'error', message: 'Cannot load config', phase, details: {} };
  }

  // Load feature list
  const fl = loadFeatureList(targetDir);
  const featuresTotal = fl.features.length;
  const featuresDone = fl.features.filter(f => f.passes).length;

  // ── All features pass → phase gate passes ─────────────────────────────────
  const feature = getNextFeature(fl.features);
  if (!feature) {
    stateSet(targetDir, 'currentFeature', null);
    stateSet(targetDir, 'currentTask', null);
    return {
      ok: true,
      status: 'complete',
      message: `All ${featuresTotal} feature(s) pass. Phase gate passes.`,
      phase,
      mode,
      details: { featuresTotal, featuresDone, currentFeature: null, currentTask: null },
    };
  }

  // ── Feature-level retry escalation check ─────────────────────────────────
  // The feature loop owns feature escalation. When the task loop signals
  // 'task-exhausted' (handled below after delegation), OR when feature retries
  // are already exhausted before delegating, signal 'feature-exhausted' to the
  // phase loop (which owns phase retry).
  const featureRetryCount = config.featureRetryCount ?? 0;
  const taskRetryCount = config.taskRetryCount ?? 0;
  if (
    retryCfg.tasks.enabled &&
    taskRetryCount >= retryCfg.tasks.maxRetries &&
    retryCfg.features.enabled &&
    featureRetryCount >= retryCfg.features.maxRetries
  ) {
    return {
      ok: false,
      status: 'feature-exhausted',
      message: `Feature retries exhausted (${featureRetryCount}/${retryCfg.features.maxRetries}) for phase "${phase}" after task retries (${taskRetryCount}/${retryCfg.tasks.maxRetries}). Signaling phase loop for phase retry or escalation.`,
      phase,
      mode,
      details: {
        featuresTotal,
        featuresDone,
        featureId: feature.id,
        taskRetryCount,
        featureRetryCount,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        retryCfg,
      },
    };
  }
  if (
    retryCfg.tasks.enabled &&
    taskRetryCount >= retryCfg.tasks.maxRetries &&
    !retryCfg.features.enabled
  ) {
    return {
      ok: false,
      status: 'feature-exhausted',
      message: `Task retries exhausted (${taskRetryCount}/${retryCfg.tasks.maxRetries}) for phase "${phase}" and feature retry is disabled. Signaling phase loop for phase retry or escalation.`,
      phase,
      mode,
      details: {
        featuresTotal,
        featuresDone,
        featureId: feature.id,
        taskRetryCount,
        featureRetryCount,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        retryCfg,
      },
    };
  }

  // ── Delegate to the task loop for this feature ───────────────────────────
  const taskResult = await runTaskLoop(targetDir, phase, feature, { json, gitOps });

  // Task loop signaled feature-complete → mark feature passing, advance.
  // The feature loop owns the feature-list mutation (marking passes=true).
  if (taskResult.status === 'feature-complete') {
    feature.passes = true;
    saveFeatureList(targetDir, fl);
    // Recurse to get the next feature (or signal complete).
    return await runFeatureLoop(targetDir, phase, options);
  }

  // Task loop signaled task-exhausted → feature loop decides feature retry.
  // If feature retry is enabled and under budget, fall through to instruction
  // (the validate command handles the feature reset + re-sweep on the next
  // iteration). If feature retry is disabled or exhausted, re-check escalation
  // above on the next call — but for this call, surface task-exhausted as
  // feature-exhausted so the phase loop can act.
  if (taskResult.status === 'task-exhausted') {
    if (!retryCfg.features.enabled || featureRetryCount >= retryCfg.features.maxRetries) {
      return {
        ok: false,
        status: 'feature-exhausted',
        message: taskResult.message,
        phase,
        mode,
        details: {
          ...taskResult.details,
          featuresTotal,
          featuresDone,
        },
      };
    }
    // Feature retry still has budget — return instruction so validate can
    // handle the feature reset on the next iteration.
    return {
      ok: true,
      status: 'instruction',
      message: `Task exhausted for feature "${feature.name}"; feature retry ${featureRetryCount}/${retryCfg.features.maxRetries} — resetting feature tasks.`,
      phase,
      mode,
      details: {
        ...taskResult.details,
        featuresTotal,
        featuresDone,
        featureId: feature.id,
        featureName: feature.name,
      },
    };
  }

  // Pass through instruction/error statuses from the task loop, enriching
  // the details with feature-loop-level context.
  return {
    ...taskResult,
    details: {
      ...taskResult.details,
      featuresTotal,
      featuresDone,
    },
  };
}

/**
 * ralph-tasks — Task Ralph Loop Engine (innermost loop).
 *
 * Iterates tasks within a single feature. For each task, it prints
 * instructions for the agent (planner → generator → evaluator) and returns
 * a result describing the next step. It does NOT do the work itself — the
 * external agent reads the instructions, does the work, then runs
 * `dev-harness validate --feature <id> --task <id>`.
 *
 * Responsibilities:
 *   - Find the next pending/in-progress task in a feature
 *   - Track currentFeature / currentTask in the state machine
 *   - Own task-level retry escalation (task → feature signal)
 *
 * Does NOT own:
 *   - Feature iteration (that's ralph-features.mjs)
 *   - Phase iteration (that's ralph-phases.mjs)
 *   - Feature-list I/O or phase classification (that's ralph-shared.mjs)
 *
 * Three Ralph loops:
 *   - ralph-tasks.mjs    — task loop (innermost): iterates tasks within a feature
 *   - ralph-features.mjs — feature loop (middle): iterates features within a phase
 *   - ralph-phases.mjs   — phase loop (outermost): iterates phases in the pipeline
 *
 * Usage:
 *   import { runTaskLoop } from './ralph-tasks.mjs';
 *   const result = runTaskLoop('/path/to/project', 'build', feature, { json: true });
 */
import { set as stateSet } from './state.mjs';
import { gitHardResetClean } from './git.mjs';
import {
  loadLoopConfig,
  buildFeatureIterateOutput,
  getNextTask,
} from './ralph-shared.mjs';

/**
 * Run the task loop for a single feature.
 *
 * Finds the next pending/in-progress task in `feature`, writes the agent
 * instructions, and returns a result object. When all tasks in the feature
 * are complete, signals 'feature-complete' so the feature loop can advance.
 *
 * Task-level retry escalation: when task retries are exhausted, signals
 * 'task-exhausted' so the feature loop can decide whether to retry the
 * feature or escalate to the phase loop.
 *
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} feature — feature object from feature_list.json
 * @param {object} [options]
 * @param {boolean} [options.json] — JSON output mode
 * @param {boolean} [options.gitOps] — opt-in: execute git reset/clean on retry
 * @returns {Promise<{ ok: boolean, status: string, message: string, phase: string, details: object }>}
 */
export async function runTaskLoop(targetDir, phase, feature, options = {}) {
  const { json = false, gitOps = false } = options;

  const { config, ok: configOk, mode, retryCfg, maxRetries, resetOnRetry, autoCommit } = loadLoopConfig(targetDir);
  if (!configOk) {
    return { ok: false, status: 'error', message: 'Cannot load config', phase, details: {} };
  }

  // ── Task-level retry escalation check ────────────────────────────────────
  // The task loop owns task escalation. When task retries are exhausted it
  // signals 'task-exhausted' to the feature loop (which owns feature retry).
  const taskRetryCount = config.taskRetryCount ?? 0;
  if (retryCfg.tasks.enabled && taskRetryCount >= retryCfg.tasks.maxRetries) {
    return {
      ok: false,
      status: 'task-exhausted',
      message: `Task retries exhausted (${taskRetryCount}/${retryCfg.tasks.maxRetries}) for feature "${feature?.id}" in phase "${phase}". Signaling feature loop for feature retry or escalation.`,
      phase,
      mode,
      details: {
        featureId: feature?.id,
        taskRetryCount,
        featureRetryCount: config.featureRetryCount ?? 0,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        retryCfg,
      },
    };
  }

  // ── Opt-in git ops: fresh context on retry ──────────────────────────────
  // When --git-ops is passed AND this is a retry (retryCount > 0), execute a
  // hard reset to the last commit + clean untracked files. This gives the
  // "fresh context" Ralph requires without forcing it on agent-agnostic users.
  const retryCount = config.retryCount ?? 0;
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

  // ── Find the next task in this feature ───────────────────────────────────
  const task = getNextTask(feature);

  // All tasks complete but feature.passes is still false → signal feature
  // completion so the feature loop can run the feature-level criteria gate
  // and advance to the next feature.
  if (!task) {
    stateSet(targetDir, 'currentTask', null);
    return {
      ok: true,
      status: 'feature-complete',
      message: `All tasks complete for feature "${feature.name}". Feature loop should run criteria gate.`,
      phase,
      mode,
      details: {
        featureId: feature.id,
        featureName: feature.name,
        tasksTotal: feature.tasks?.length ?? 0,
        currentFeature: feature.id,
        currentTask: null,
      },
    };
  }

  // Track current task in state machine
  stateSet(targetDir, 'currentFeature', feature.id);
  stateSet(targetDir, 'currentTask', task.id);

  // Build instructions for the agent
  const output = buildFeatureIterateOutput(phase, feature, task, maxRetries, resetOnRetry, autoCommit);

  if (json) {
    return {
      ok: true,
      status: 'instruction',
      message: `${feature.name} — ${task.description}`,
      phase,
      mode,
      details: {
        featureId: feature.id,
        featureName: feature.name,
        taskId: task.id,
        taskDescription: task.description,
        phaseType: 'feature-iterate',
        maxRetries,
        retry: retryCfg,
        taskRetryCount,
        featureRetryCount: config.featureRetryCount ?? 0,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        resetOnRetry,
        autoCommit,
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
    mode,
    details: { featureId: feature.id, taskId: task.id },
  };
}

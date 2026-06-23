/**
 * validate — Run gate checks for current phase.
 *
 * If gates.enabled is false, prints "Gates disabled" and exits 0.
 * Otherwise runs phase-specific checks and reports results.
 *
 * Usage:
 *   dev-harness validate              — check current phase
 *   dev-harness validate --json       — machine-readable output
 *   dev-harness validate --phase X    — check specific phase
 *
 * Examples:
 *   dev-harness validate
 *   # → BUILD Gate: PASS — 3/3 checks pass
 *
 *   dev-harness validate --json
 *   # → {"phase":"build","checks":[...],"overall":false,"failures":["lint"]}
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { runChecks, getPhase, areGatesEnabled } from '../lib/gates.mjs';
import { loadConfig, set as configSet } from '../lib/state.mjs';
import { continuePipeline } from '../lib/ralph-outer.mjs';
import { loadFeatureList, saveFeatureList, runPhase, getNextFeature, getNextTask } from '../lib/ralph-inner.mjs';
import { phaseLabel } from '../lib/command-helpers.mjs';
import { renderDashboard } from '../lib/dashboard.mjs';
import { emitJson, emitHuman } from '../lib/output.mjs';

export default async function validateCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();

  // Allow explicit --phase override
  const explicitPhase = args.flags?.phase;
  const phase = explicitPhase || getPhase(targetDir);

  // Feature/task scoping for inner-loop per-task validation
  // NOTE: gates.mjs currently runs full phase-level checks.
  // Per-feature/task filtering should be implemented when the
  // gate engine grows feature-aware check functions (T8 follow-up).
  const feature = typeof args.flags?.feature === 'string' ? args.flags.feature : null;
  const task = typeof args.flags?.task === 'string' ? args.flags.task : null;

  // Gates disabled check
  if (!areGatesEnabled(targetDir)) {
    if (json) {
      const out = {
        command: 'validate',
        phase,
        status: 'ok',
        message: 'Gates disabled — enable with: config set gates.enabled true',
        checks: [],
        overall: true,
        failures: [],
      };
      if (feature) { out.feature = feature; }
      if (task) { out.task = task; }
      emitJson(out);
    } else {
      emitHuman('Gates disabled. Enable with: dev-harness config set gates.enabled true\n');
    }
    return;
  }

  // No phase determined
  if (!phase) {
    die(
      new CliError(
        'No phase found in config. Run: dev-harness init or dev-harness phase <name>',
        EXIT.VALIDATION_FAILURE,
      ),
      json,
    );
    return;
  }

  // Run checks
  const result = await runChecks(targetDir, phase, { feature, task });

  if (json) {
    const out = {
      command: 'validate',
      phase: result.phase,
      status: result.overall ? 'ok' : 'error',
      message: result.overall
        ? `${phaseLabel(result.phase)} Gate: PASS — ${result.checks.length}/${result.checks.length} checks pass`
        : `${phaseLabel(result.phase)} Gate: FAIL — ${result.checks.length - result.failures.length}/${result.checks.length} checks pass`,
      checks: result.checks,
      overall: result.overall,
      failures: result.failures,
    };
    if (feature) { out.feature = feature; }
    if (task) { out.task = task; }

    // Task-level retry: increment taskRetryCount on per-task validation failure
    if (!result.overall && feature && task) {
      const { config: failConfig } = loadConfig(targetDir);
      const currentTaskRetry = (failConfig.taskRetryCount ?? 0) + 1;
      const maxRetries = failConfig.maxRetries ?? 10;
      configSet(targetDir, 'taskRetryCount', currentTaskRetry);
      out.taskRetry = { attempt: currentTaskRetry, maxRetries };
      if (currentTaskRetry >= maxRetries) {
        configSet(targetDir, 'paused', true);
        out.escalated = { task, retries: currentTaskRetry, maxRetries };
      }
    }

    // Feature/task-scoped validation passing — mark task complete, advance inner loop
    if (result.overall && feature && task) {
      const fl = loadFeatureList(targetDir);
      const feat = fl.features ? fl.features.find(f => f.id === feature) : null;
      const t = feat && feat.tasks ? feat.tasks.find(tk => tk.id === task) : null;
      if (t) {
        t.status = 'complete';
        // If all tasks in feature done, mark feature passing
        if (feat.tasks.every(tk => tk.status === 'complete')) {
          feat.passes = true;
        }
        saveFeatureList(targetDir, fl);
      }
      // Successful task validation resets retry counts (this was a success, not a retry)
      configSet(targetDir, 'retryCount', 0);
      configSet(targetDir, 'taskRetryCount', 0);
      // Get next task/feature instructions
      const nextResult = await runPhase(targetDir, phase, { json: true });
      out.nextTask = {
        status: nextResult.status,
        message: nextResult.message,
        feature: nextResult.details?.featureId || null,
        task: nextResult.details?.taskId || null,
        taskDescription: nextResult.details?.taskDescription || null,
      };
    }

    // Autopilot: auto-advance the outer pipeline when full phase gates pass
    if (result.overall && !feature && !task) {
      const { config: postConfig } = loadConfig(targetDir);
      if (postConfig.mode === 'autopilot') {
        const pipelineResult = await continuePipeline(targetDir, phase, { json: true, verbose: false });
        out.pipeline = {
          status: pipelineResult.status,
          message: pipelineResult.message,
          nextPhase: pipelineResult.nextPhase || null,
          phasesRemaining: pipelineResult.phasesRemaining,
        };
      }
    }

    emitJson(out);
    if (!result.overall) {
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    return;
  }

  // Human output
  const label = phaseLabel(result.phase);
  if (result.overall) {
    emitHuman(`${label} Gate: PASS — ${result.checks.length}/${result.checks.length} checks pass\n`);
  } else {
    emitHuman(`${label} Gate: FAIL — ${result.checks.length - result.failures.length}/${result.checks.length} checks pass\n`);
  }

  for (const check of result.checks) {
    const icon = check.pass ? '  ✓' : '  ✗';
    emitHuman(`${icon} ${check.name}: ${check.detail}\n`);
  }

  if (!result.overall) {
    emitHuman(`\nFailed: ${result.failures.join(', ')}\n`);
  }

  // Task-level retry: increment taskRetryCount on per-task validation failure
  if (!result.overall && feature && task) {
    const { config: failConfig } = loadConfig(targetDir);
    const currentTaskRetry = (failConfig.taskRetryCount ?? 0) + 1;
    const maxRetries = failConfig.maxRetries ?? 10;
    configSet(targetDir, 'taskRetryCount', currentTaskRetry);
    if (currentTaskRetry >= maxRetries) {
      emitHuman(`\n  ✗ Task "${task}" failed ${currentTaskRetry}/${maxRetries} times. Escalating to human.\n`);
      emitHuman(`  Run: dev-harness phase ${phase} to retry, or fix the task manually.\n`);
      configSet(targetDir, 'paused', true);
    } else {
      emitHuman(`\n  ↻ Task "${task}" failed (${currentTaskRetry}/${maxRetries}). Retry with fresh context.\n`);
    }
  }

  // Feature/task-scoped validation passing — mark task complete, advance inner loop
  if (result.overall && feature && task) {
    const fl = loadFeatureList(targetDir);
    const feat = fl.features ? fl.features.find(f => f.id === feature) : null;
    const t = feat && feat.tasks ? feat.tasks.find(tk => tk.id === task) : null;
    if (t) {
      t.status = 'complete';
      // If all tasks in feature done, mark feature passing
      if (feat.tasks.every(tk => tk.status === 'complete')) {
        feat.passes = true;
        emitHuman(`\n  ✓ Feature "${feat.name}" complete. All tasks done.\n`);
      } else {
        emitHuman(`\n  ✓ Task "${task}" complete.\n`);
      }
      saveFeatureList(targetDir, fl);
    }
    // Successful task validation resets retry counts (this was a success, not a retry)
    configSet(targetDir, 'retryCount', 0);
    configSet(targetDir, 'taskRetryCount', 0);
    // Render updated dashboard showing task completion + next task
    renderDashboard(targetDir);
    // Run inner loop to get next feature/task instructions
    // runPhase prints the instructions to stdout
    const nextResult = await runPhase(targetDir, phase, { json: false });
    if (nextResult.status === 'complete') {
      emitHuman(`\n  ✓ ${phaseLabel(phase)}: all features complete.\n`);
    }
  }

  // Autopilot: auto-advance the outer pipeline when full phase gates pass
  if (result.overall && !feature && !task) {
    const { config: postConfig } = loadConfig(targetDir);
    if (postConfig.mode === 'autopilot') {
      emitHuman(`\n  ● Autopilot: phase complete. Advancing pipeline...\n`);
      const pipelineResult = await continuePipeline(targetDir, phase, { json: false, verbose: true });
      if (pipelineResult.status === 'complete') {
        emitHuman(`\n✓ Pipeline complete. All phases done.\n`);
      }
      // Render updated dashboard showing new current phase
      renderDashboard(targetDir);
    }
  }

  // Exit with failure code when checks fail
  if (!result.overall) {
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

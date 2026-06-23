/**
 * ralph-outer — Outer Ralph Loop Engine.
 *
 * Advances through the phase pipeline in order. In copilot mode,
 * runs one phase and stops. In autopilot mode, auto-advances
 * through all remaining phases after each gate passes.
 *
 * The outer loop does NOT iterate tasks or features — that's
 * entirely the inner loop's job (T8).
 *
 * Usage:
 *   import { continuePipeline, runAutopilot } from './ralph-outer.mjs';
 *   const result = continuePipeline('/path/to/project', 'build');
 */
import { loadConfig, transitionPhase, set as stateSet, getPhaseOrder } from './state.mjs';
import { runPhase, loadFeatureList } from './ralph-inner.mjs';
import { existsSync } from 'node:fs';
import { execGit } from './git.mjs';

/**
 * After a phase completes (gate passes), continue the pipeline.
 *
 * In copilot mode: prints next-step instructions and stops.
 * In autopilot mode: auto-advances to the next phase and runs it.
 *
 * @param {string} targetDir
 * @param {string} completedPhase — the phase that just finished
 * @param {object} [options]
 * @param {boolean} [options.json] — JSON output mode
 * @param {boolean} [options.verbose] — print detailed output
 * @returns {Promise<{ ok: boolean, status: string, message: string, currentPhase: string|null, phasesRemaining: number }>}
 */
export async function continuePipeline(targetDir, completedPhase, options = {}) {
  const { json = false, verbose = false } = options;

  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    return { ok: false, status: 'error', message: 'Cannot load config', currentPhase: null, phasesRemaining: 0 };
  }

  const mode = config.mode ?? 'copilot';
  const order = getPhaseOrder(config.phases?.enabled);
  const phaseIdx = order.indexOf(completedPhase);
  const nextPhase = (phaseIdx >= 0 && phaseIdx < order.length - 1) ? order[phaseIdx + 1] : null;
  if (!nextPhase) {
    // Pipeline complete
    let msg = `Pipeline complete after "${completedPhase}".`;

    // Increment pipeline iteration
    if (config.pipelineIteration === undefined) {config.pipelineIteration = 0;}
    config.pipelineIteration = (config.pipelineIteration || 0) + 1;
    stateSet(targetDir, 'pipelineIteration', config.pipelineIteration);

    // Count remaining features
    let featuresRemaining = 0;
    try {
      const fl = loadFeatureList(targetDir);
      // fl.ok === false means the file is missing OR malformed JSON.
      // Missing file is benign (early phases have no feature list yet);
      // a present-but-unparseable file is a real error we must surface.
      if (fl.ok === false && fl.path && existsSync(fl.path)) {
        process.stderr.write(
          `Warning: feature_list.json at ${fl.path} is present but could not be parsed. Treating as 0 features.\n`,
        );
      }
      featuresRemaining = fl.features ? fl.features.filter(f => !f.passes).length : 0;
    } catch (err) {
      // Defensive: loadFeatureList never throws, but guard anyway.
      process.stderr.write(`Warning: failed to read feature list: ${err.message}\n`);
    }

    msg += ` Iteration ${config.pipelineIteration}.`;
    if (featuresRemaining > 0) {
      msg += ` ${featuresRemaining} feature(s) remaining.`;
    } else {
      msg += ' All features complete.';
    }

    if (!json && verbose) {
      process.stdout.write(`\n${msg}\n`);
    }
    // Git auto-tag if enabled
    if (config.git?.autoTag) {
      await autoTag(targetDir, completedPhase, json);
    }
    return {
      ok: true,
      status: 'complete',
      message: msg,
      currentPhase: completedPhase,
      phasesRemaining: 0,
      pipelineIteration: config.pipelineIteration,
      featuresRemaining,
    };
  }

  const phasesRemaining = order.length - phaseIdx - 1;

  if (mode === 'copilot') {
    // Copilot: print instructions for next phase
    const msg = `${completedPhase.toUpperCase()} complete. Next: dev-harness phase ${nextPhase}`;
    if (json) {
      return {
        ok: true,
        status: 'instruction',
        message: msg,
        currentPhase: completedPhase,
        phasesRemaining,
        nextPhase,
      };
    }
    if (verbose) {
      process.stdout.write(`\n  ✓ ${completedPhase.toUpperCase()} complete.\n`);
      process.stdout.write(`  ▶ ${msg}\n`);
    }
    return {
      ok: true,
      status: 'instruction',
      message: msg,
      currentPhase: completedPhase,
      phasesRemaining,
      nextPhase,
    };
  }

  // ── Autopilot mode ────────────────────────────────────────────────────
  // Auto-advance: transition to next phase and run inner loop

  // Re-check pause before auto-advancing (user may have paused during phase execution)
  if (config.paused) {
    const msg = `Autopilot paused after "${completedPhase}". Run: dev-harness resume`;
    if (verbose && !json) {
      process.stdout.write(`\n  ⏸ ${msg}\n`);
    }
    return {
      ok: true,
      status: 'paused',
      message: msg,
      currentPhase: completedPhase,
      nextPhase: null,
      phasesRemaining,
    };
  }

  if (verbose && !json) {
    process.stdout.write(`\n  ● Autopilot: advancing to "${nextPhase}"...\n`);
  }

  // Transition to next phase
  const transResult = await transitionPhase(targetDir, nextPhase);
  if (!transResult.ok) {
    return {
      ok: false,
      status: 'error',
      message: `Autopilot: transition to "${nextPhase}" failed: ${transResult.error}`,
      currentPhase: completedPhase,
      phasesRemaining,
    };
  }

  // Run inner loop for next phase
  const loopResult = await runPhase(targetDir, nextPhase, { json });

  if (loopResult.status === 'escalated') {
    // Retries exhausted — stop pipeline, escalate to human
    if (!json && verbose) {
      process.stdout.write(`\n  ✗ ${nextPhase.toUpperCase()} — ${loopResult.message}\n`);
      process.stdout.write(`  Escalating to human.\n`);
    }
    return {
      ok: false,
      status: 'escalated',
      message: loopResult.message,
      currentPhase: nextPhase,
      nextPhase: null,
      phasesRemaining,
      details: loopResult.details,
    };
  }

  if (loopResult.status === 'complete') {
    // Phase completed successfully — continue the chain
    if (verbose && !json) {
      process.stdout.write(`  ✓ ${nextPhase.toUpperCase()} complete.\n`);
    }
    return await continuePipeline(targetDir, nextPhase, options);
  }

  // Phase returned instruction or error — stop chain
  const orderRemaining = getPhaseOrder();
  const currentIdx = orderRemaining.indexOf(nextPhase);
  const pipelineNext = (currentIdx >= 0 && currentIdx < orderRemaining.length - 1) ? orderRemaining[currentIdx + 1] : null;
  return {
    ok: loopResult.ok,
    status: loopResult.status,
    message: loopResult.message,
    currentPhase: nextPhase,
    nextPhase: pipelineNext,
    phasesRemaining,
    details: loopResult.details,
  };
}

/**
 * Run the full autopilot pipeline from current state through SHIP.
 *
 * This is a convenience wrapper — normally autopilot is triggered
 * by calling `dev-harness phase <name>` while in autopilot mode.
 *
 * @param {string} targetDir
 * @param {object} [options]
 * @returns {Promise<{ ok: boolean, status: string, message: string }>}
 */
export async function runAutopilot(targetDir, options = {}) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    return { ok: false, status: 'error', message: 'Cannot load config' };
  }

  const currentPhase = config.currentPhase;
  const order = getPhaseOrder(config.phases?.enabled);

  if (!currentPhase || !order.includes(currentPhase)) {
    // Start from the beginning
    const firstPhase = order[0];
    if (!firstPhase) {
      return { ok: false, status: 'error', message: 'No phases enabled in config' };
    }
    const transResult = await transitionPhase(targetDir, firstPhase);
    if (!transResult.ok) {
      return { ok: false, status: 'error', message: transResult.error || 'Transition failed' };
    }
    return await continuePipeline(targetDir, firstPhase, options);
  }

  // Already in a phase — continue from here
  return await continuePipeline(targetDir, currentPhase, options);
}

/** Create a git tag for pipeline iteration. */
async function autoTag(targetDir, phase, json) {
  const now = new Date();
  const tag = `pipeline-${now.toISOString().slice(0, 10)}-${now.getTime().toString(36)}`;
  const r = await execGit(`git tag "${tag}"`, targetDir);
  if (r.ok && !json) {
    process.stdout.write(`  ● Git tag: ${tag}\n`);
  }
  // Not a git repo or tag failed — skip silently
}

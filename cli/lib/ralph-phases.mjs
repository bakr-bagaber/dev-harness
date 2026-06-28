/**
 * ralph-phases — Phase Ralph Loop Engine (outermost loop) + phase dispatcher.
 *
 * Iterates phases in the pipeline. For each phase, it dispatches to either:
 *   - The feature loop (ralph-features.mjs) for feature-iterate phases
 *     (BUILD, VERIFY, SIMPLIFY)
 *   - The deliverable-retry handler (in this module) for deliverable phases
 *     (INIT, DEFINE, PLAN, REVIEW, SHIP)
 *
 * Responsibilities:
 *   - Dispatch a phase to the correct sub-loop via runPhase()
 *   - Iterate phases via continuePipeline() / runAutopilot()
 *   - Own phase-level retry escalation (phase → human signal)
 *   - Handle deliverable-retry phases directly (single deliverable, no features)
 *
 * Does NOT own:
 *   - Task iteration (that's ralph-tasks.mjs)
 *   - Feature iteration (that's ralph-features.mjs)
 *   - Feature-list I/O or phase classification (that's ralph-shared.mjs)
 *
 * Three Ralph loops:
 *   - ralph-tasks.mjs    — task loop (innermost): iterates tasks within a feature
 *   - ralph-features.mjs — feature loop (middle): iterates features within a phase
 *   - ralph-phases.mjs   — phase loop (outermost): iterates phases in the pipeline
 *
 * Usage:
 *   import { runPhase, continuePipeline, runAutopilot } from './ralph-phases.mjs';
 *   const result = await runPhase('/path/to/project', 'build', { json: true });
 */
import { existsSync } from 'node:fs';
import {
  loadConfig,
  transitionPhase,
  set as stateSet,
  getPhaseOrder,
  getRetryConfig,
  incrementPhaseRetry,
  resetPhaseRetry,
} from './state.mjs';
import { execGit } from './git.mjs';
import { runFeatureLoop } from './ralph-features.mjs';
import {
  loadLoopConfig,
  getPhaseType,
  loadFeatureList,
  saveFeatureList,
  buildDeliverableRetryOutput,
} from './ralph-shared.mjs';

// ── Phase dispatcher ────────────────────────────────────────────────────────

/**
 * Run a single phase by dispatching to the correct sub-loop.
 *
 * For feature-iterate phases (BUILD, VERIFY, SIMPLIFY): delegates to the
 * feature loop (ralph-features.mjs), which iterates features and delegates
 * each to the task loop (ralph-tasks.mjs).
 *
 * For deliverable-retry phases (INIT, DEFINE, PLAN, REVIEW, SHIP): runs the
 * deliverable handler directly (single deliverable, no feature iteration).
 *
 * Phase-level retry escalation: for deliverable-retry phases, when phase
 * retries are exhausted, signals 'deliverable-exhausted' to continuePipeline.
 * (Feature-iterate phases signal 'feature-exhausted' from the feature loop.)
 *
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} [options]
 * @param {boolean} [options.json] — JSON output mode
 * @param {boolean} [options.gitOps] — opt-in: execute git reset/clean on retry
 * @returns {Promise<{ ok: boolean, status: string, message: string, phase: string, iteration: number, mode: string, details: object }>}
 */
export async function runPhase(targetDir, phase, options = {}) {
  const { json = false, gitOps = false } = options;

  const { config, ok: configOk, mode, retryCfg, maxRetries, resetOnRetry, autoCommit } = loadLoopConfig(targetDir);
  if (!configOk) {
    return { ok: false, status: 'error', message: 'Cannot load config', phase, iteration: 0, mode: 'unknown', details: {} };
  }

  const phaseType = getPhaseType(phase);
  if (!phaseType) {
    return { ok: false, status: 'error', message: `Unknown phase type for "${phase}"`, phase, iteration: 0, mode, details: {} };
  }

  // ── Deliverable-retry phases: check phase-level retry exhaustion ──────────
  // Feature-iterate phases delegate their escalation checks to the feature
  // loop, which signals 'feature-exhausted'. Deliverable-retry phases have no
  // feature/task sub-loops, so the phase loop owns their retry escalation.
  if (phaseType === 'deliverable-retry') {
    const phaseRetryCount = config.phaseRetryCount ?? 0;
    const retryCount = config.retryCount ?? 0;

    if (retryCfg.phases.enabled && phaseRetryCount >= retryCfg.phases.maxRetries) {
      return {
        ok: false,
        status: 'deliverable-exhausted',
        message: `Phase retries exhausted (${phaseRetryCount}/${retryCfg.phases.maxRetries}) for deliverable phase "${phase}". Signaling phase loop for escalation.`,
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
        message: `Retries exhausted (${retryCount}/${retryCfg.tasks.maxRetries}) for deliverable phase "${phase}" and phase retry is disabled. Signaling phase loop for escalation.`,
        phase,
        iteration: retryCount,
        mode,
        details: { retryCount, phaseRetryCount, retryCfg },
      };
    }

    // Not exhausted → produce the deliverable instruction
    return buildDeliverableResult(phase, mode, maxRetries, resetOnRetry, autoCommit, retryCfg, config, json);
  }

  // ── Feature-iterate phases: delegate to the feature loop ──────────────────
  const featureResult = await runFeatureLoop(targetDir, phase, { json, gitOps });

  // Normalize the result shape so callers (phase.mjs) see a consistent
  // { ok, status, message, phase, iteration, mode, details } contract.
  return {
    ok: featureResult.ok,
    status: featureResult.status,
    message: featureResult.message,
    phase: featureResult.phase ?? phase,
    iteration: featureResult.iteration ?? 1,
    mode: featureResult.mode ?? mode,
    details: featureResult.details ?? {},
  };
}

/**
 * Build the result for a deliverable-retry phase (instruction to produce
 * the deliverable). Extracted from runPhase for readability.
 */
function buildDeliverableResult(phase, mode, maxRetries, resetOnRetry, autoCommit, retryCfg, config, json) {
  const output = buildDeliverableRetryOutput(phase, maxRetries, resetOnRetry, autoCommit);

  if (json) {
    return {
      ok: true,
      status: 'instruction',
      message: `${phase}: produce the deliverable`,
      phase,
      iteration: 1,
      mode,
      details: {
        phaseType: 'deliverable-retry',
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
    message: `${phase}: produce the deliverable`,
    phase,
    iteration: 1,
    mode,
    details: {},
  };
}

// ── Phase loop (outermost) ───────────────────────────────────────────────────

/**
 * After a phase completes (gate passes), continue the pipeline.
 *
 * In copilot mode: prints next-step instructions and stops.
 * In autopilot mode: auto-advances to the next phase and runs it.
 *
 * Owns phase-level retry escalation: when the sub-loop signals
 * 'feature-exhausted' or 'deliverable-exhausted', this loop decides whether
 * to retry the phase (if phase retry is enabled and under budget) or escalate
 * to human (pause + signal 'escalated').
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

  // ── Pipeline complete ────────────────────────────────────────────────────
  if (!nextPhase) {
    return handlePipelineComplete(targetDir, completedPhase, config, json, verbose);
  }

  const phasesRemaining = order.length - phaseIdx - 1;

  // ── Copilot mode: print next-step instruction and stop ───────────────────
  if (mode === 'copilot') {
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

  // ── Autopilot mode: auto-advance to next phase ───────────────────────────
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

  // Run the phase (dispatches to feature loop or deliverable handler)
  const loopResult = await runPhase(targetDir, nextPhase, { json });

  // ── Escalation: retries exhausted → stop pipeline, escalate to human ─────
  if (loopResult.status === 'escalated') {
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

  // ── Phase retry: sub-loop signaled exhaustion ────────────────────────────
  // The feature loop signals 'feature-exhausted'; the deliverable handler
  // signals 'deliverable-exhausted'. The phase loop owns phase retry: if
  // retry.phases.enabled and under budget, reset all features in the phase
  // + re-run same phase. Else escalate to human.
  if (loopResult.status === 'feature-exhausted' || loopResult.status === 'deliverable-exhausted') {
    return handlePhaseRetry(targetDir, nextPhase, loopResult, config, phasesRemaining, options);
  }

  // ── Phase completed successfully → continue the chain ────────────────────
  if (loopResult.status === 'complete') {
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
 * Handle pipeline completion (no next phase). Increments pipeline iteration,
 * counts remaining features, and optionally tags the release.
 */
async function handlePipelineComplete(targetDir, completedPhase, config, json, verbose) {
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

/**
 * Handle phase retry when a sub-loop signals exhaustion.
 *
 * If phase retry is enabled and under budget: increment phase retry counter,
 * reset all features in the phase, re-run the same phase.
 * Otherwise: escalate to human (pause + signal 'escalated').
 */
async function handlePhaseRetry(targetDir, nextPhase, loopResult, config, phasesRemaining, options) {
  const { json = false, verbose = false } = options;
  const retryCfg = getRetryConfig(config);
  const phaseRetryCount = config.phaseRetryCount ?? 0;

  if (retryCfg.phases.enabled && phaseRetryCount < retryCfg.phases.maxRetries) {
    // Phase retry: increment counter, reset all features in the phase,
    // re-run same phase via the existing same-phase re-run path.
    incrementPhaseRetry(config);
    // Reset all features' passes + task statuses + retryCounts
    try {
      const fl = loadFeatureList(targetDir);
      if (fl.ok !== false && Array.isArray(fl.features)) {
        for (const feat of fl.features) {
          feat.passes = false;
          if (feat.retryCount !== undefined) { feat.retryCount = 0; }
          for (const t of (feat.tasks || [])) {
            t.status = 'pending';
            if (t.retryCount !== undefined) { t.retryCount = 0; }
          }
        }
        saveFeatureList(targetDir, fl);
      }
    } catch (_e) { /* non-fatal */ }
    // Reset task/feature retry counters
    config.taskRetryCount = 0;
    config.featureRetryCount = 0;
    stateSet(targetDir, 'phaseRetryCount', config.phaseRetryCount);
    stateSet(targetDir, 'taskRetryCount', 0);
    stateSet(targetDir, 'featureRetryCount', 0);

    if (!json && verbose) {
      process.stdout.write(`\n  ↻ Phase retry (${config.phaseRetryCount}/${retryCfg.phases.maxRetries}) for "${nextPhase}". Resetting features and re-running.\n`);
    }
    // Re-run same phase (transitionPhase handles same-phase re-run)
    const retrans = await transitionPhase(targetDir, nextPhase);
    if (!retrans.ok) {
      return {
        ok: false,
        status: 'error',
        message: `Phase retry transition failed: ${retrans.error}`,
        currentPhase: nextPhase,
        phasesRemaining,
      };
    }
    const reloop = await runPhase(targetDir, nextPhase, { json });
    // Recurse to continue evaluating the re-run result
    if (reloop.status === 'complete') {
      return await continuePipeline(targetDir, nextPhase, options);
    }
    return {
      ok: reloop.ok,
      status: reloop.status,
      message: reloop.message,
      currentPhase: nextPhase,
      nextPhase: null,
      phasesRemaining,
      details: reloop.details,
    };
  }

  // Phase retry disabled or exhausted → escalate to human
  stateSet(targetDir, 'paused', true);
  if (!json && verbose) {
    process.stdout.write(`\n  ✗ ${nextPhase.toUpperCase()} — ${loopResult.message}\n`);
    process.stdout.write(`  Phase retry exhausted or disabled. Escalating to human. Pipeline paused.\n`);
  }
  return {
    ok: false,
    status: 'escalated',
    message: `${loopResult.message} Phase retry ${retryCfg.phases.enabled ? `exhausted (${phaseRetryCount}/${retryCfg.phases.maxRetries})` : 'disabled'}. Pipeline paused.`,
    currentPhase: nextPhase,
    nextPhase: null,
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

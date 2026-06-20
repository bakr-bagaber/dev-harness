/**
 * phase — Invoke a phase by name.
 *
 * Transitions the state machine, runs the inner loop,
 * then triggers the outer loop for autopilot advancement.
 *
 * Usage:
 *   dev-harness phase <name>
 *   dev-harness phase <name> --json
 */
import { CliError, EXIT, die } from '../lib/errors.mjs';
import { transitionPhase, getPhaseOrder, loadConfig } from '../lib/state.mjs';
import { runPhase, getPhaseType } from '../lib/ralph-inner.mjs';
import { continuePipeline } from '../lib/ralph-outer.mjs';
import { promptYesNo, shouldConfirmGates, shouldAutoPrompt } from '../lib/modes.mjs';
import { parseCommandArgs, phaseLabel } from '../lib/command-helpers.mjs';

export default async function phaseCommand(args) {
  const { json, targetDir, gitOps } = parseCommandArgs(args);
  const phase = args.subcommand;

  // Load config to get enabled phases (e.g. simplify may be enabled)
  const { config: cfg, ok: cfgOk } = loadConfig(targetDir);
  const enabledPhases = cfgOk ? cfg.phases?.enabled : undefined;

  // Validate phase name
  const validPhases = getPhaseOrder(enabledPhases);
  if (!phase) {
    die(
      new CliError(
        `Phase name required.\nValid phases: ${validPhases.join(', ')}`,
        EXIT.USAGE_ERROR,
      ),
      json,
    );
    return;
  }

  if (!validPhases.includes(phase)) {
    die(
      new CliError(
        `Invalid phase "${phase}". Valid: ${validPhases.join(', ')}`,
        EXIT.USAGE_ERROR,
      ),
      json,
    );
    return;
  }

  // Pre-transition pause check for autopilot
  const { config: preConfig, ok: preOk } = loadConfig(targetDir);
  const preMode = preOk ? (preConfig.mode ?? 'copilot') : 'copilot';
  if (preOk && preConfig.paused && preMode === 'autopilot') {
    const msg = 'Pipeline is paused. Run: dev-harness resume';
    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'phase',
        phase,
        status: 'paused',
        message: msg,
        currentPhase: preConfig.currentPhase,
        mode: preMode,
      }) + '\n');
    } else {
      process.stdout.write(`  ⏸ ${msg}\n`);
    }
    return;
  }

  // Attempt phase transition
  const transitionResult = transitionPhase(targetDir, phase);

  if (!transitionResult.ok) {
    die(
      new CliError(transitionResult.error || 'Phase transition failed', EXIT.VALIDATION_FAILURE),
      json,
    );
    return;
  }

  const mode = transitionResult.config?.mode ?? 'copilot';
  const phaseType = getPhaseType(phase);

  // Run the inner loop for this phase
  const loopResult = runPhase(targetDir, phase, { json, gitOps });

  if (!loopResult.ok) {
    die(
      new CliError(loopResult.message, EXIT.VALIDATION_FAILURE),
      json,
    );
    return;
  }

  // ── Phase complete — trigger outer loop ──────────────────────────────
  const order = getPhaseOrder(transitionResult.config?.phases?.enabled);
  const phaseIdx = order.indexOf(phase);
  const nextPhase = (phaseIdx >= 0 && phaseIdx < order.length - 1) ? order[phaseIdx + 1] : null;

  if (json) {
    // Build JSON output
    const out = {
      command: 'phase',
      phase,
      status: loopResult.status,
      message: loopResult.message,
      currentPhase: phase,
      mode,
      phaseType,
      iteration: loopResult.iteration,
      nextPhase,
    };

    if (loopResult.details) {
      Object.assign(out, loopResult.details);
    }

    // In autopilot mode with complete status — continue pipeline
    if (mode === 'autopilot' && loopResult.status === 'complete') {
      const pipelineResult = continuePipeline(targetDir, phase, { json, verbose: false });
      out.pipeline = {
        status: pipelineResult.status,
        message: pipelineResult.message,
        phasesRemaining: pipelineResult.phasesRemaining,
        nextPhase: pipelineResult.nextPhase || null,
      };
    }

    process.stdout.write(JSON.stringify(out) + '\n');
    return;
  }

  // ── Human output ────────────────────────────────────────────────────
  if (loopResult.status === 'complete') {
    process.stdout.write(`\n${phaseLabel(phase)} phase complete.\n`);

    if (mode === 'autopilot') {
      // Autopilot: continue pipeline automatically
      const pipelineResult = continuePipeline(targetDir, phase, { json: false, verbose: true });
      if (pipelineResult.status === 'complete') {
        process.stdout.write(`\n✓ Pipeline complete. All phases done.\n`);
      } else if (pipelineResult.status === 'instruction') {
        process.stdout.write(`\nNext: dev-harness phase ${pipelineResult.nextPhase}\n`);
      }
    } else if (nextPhase) {
      // Copilot: print next step
      process.stdout.write(`Next: dev-harness phase ${nextPhase}\n`);
      // Auto-prompt: controlled by two independent flags:
      //   autoPrompt=true  → show the prompt
      //   confirmGates=true → require y/n answer before continuing
      if (shouldAutoPrompt(targetDir)) {
        if (shouldConfirmGates(targetDir)) {
          const answer = await promptYesNo(`Advance to ${nextPhase.toUpperCase()}?`);
          if (answer === true) {
            process.stdout.write(`\n  ● Advancing to "${nextPhase}"...\n`);
            const pipelineResult = continuePipeline(targetDir, phase, { json: false, verbose: true });
            if (pipelineResult.status === 'complete') {
              process.stdout.write(`\n✓ Pipeline complete. All phases done.\n`);
            }
          } else if (answer === false) {
            process.stdout.write(`  Staying in ${phase.toUpperCase()}. Run: dev-harness phase ${nextPhase} when ready.\n`);
          }
          // null = no TTY, skipped
        } else {
          // confirmGates disabled — auto-advance without waiting for input
          process.stdout.write(`  ● Auto-advancing to "${nextPhase}"...\n`);
          const pipelineResult = continuePipeline(targetDir, phase, { json: false, verbose: true });
          if (pipelineResult.status === 'complete') {
            process.stdout.write(`\n✓ Pipeline complete. All phases done.\n`);
          }
        }
      }
    } else {
      process.stdout.write('Pipeline complete.\n');
    }
  } else if (loopResult.status === 'instruction') {
    // runPhase already printed the task instructions
    if (mode === 'autopilot' && nextPhase) {
      process.stdout.write(`After gate passes, autopilot will continue to "${nextPhase}".\n`);
    }
  }
}

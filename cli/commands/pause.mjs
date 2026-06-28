/**
 * pause — Pause autopilot execution.
 *
 * Sets config.paused = true. The phase loop checks this
 * before starting a new phase in autopilot mode.
 *
 * G17: also fires the session boundary (trigger #4: pause/escalate) —
 * writes the handoff snapshot + runs the clean-state gate (advisory).
 *
 * Usage: dev-harness pause [--json]
 */
import { set } from '../lib/state.mjs';
import { EXIT } from '../lib/errors.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';
import { fireSessionBoundary } from '../lib/session-boundary.mjs';

export default async function pauseCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const result = set(targetDir, 'paused', true);

  // G17: fire session boundary (trigger #4: pause). Best-effort — never block
  // the pause on handoff/clean-state failures.
  let cleanState = null;
  if (result.ok) {
    try {
      const boundary = await fireSessionBoundary(targetDir, 'pause');
      cleanState = boundary.cleanState;
    } catch {
      // Non-fatal.
    }
  }

  if (json) {
    emitJson({
      command: 'pause',
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? 'Pipeline paused. Autopilot will stop after current phase gate.'
        : (result.error || 'Failed to pause'),
      cleanState: cleanState && !cleanState.pass ? cleanState : null,
    });
    if (!result.ok) { process.exit(EXIT.VALIDATION_FAILURE); }
    return;
  }

  if (result.ok) {
    emitHuman('✓ Pipeline paused. Autopilot will stop after current phase gate.\n');
    if (cleanState && !cleanState.pass) {
      emitHuman(`  ⚠ Clean-state: ${cleanState.detail}\n`);
    }
  } else {
    emitCmdError({ command: 'pause', json, message: result.error || 'Failed to pause' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

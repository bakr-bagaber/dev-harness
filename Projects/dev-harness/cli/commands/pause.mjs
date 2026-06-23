/**
 * pause — Pause autopilot execution.
 *
 * Sets config.paused = true. The outer loop checks this
 * before starting a new phase in autopilot mode.
 *
 * Usage: dev-harness pause [--json]
 */
import { set } from '../lib/state.mjs';
import { EXIT } from '../lib/errors.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function pauseCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const result = set(targetDir, 'paused', true);

  if (json) {
    emitJson({
      command: 'pause',
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? 'Pipeline paused. Autopilot will stop after current phase gate.'
        : (result.error || 'Failed to pause'),
    });
    if (!result.ok) { process.exit(EXIT.VALIDATION_FAILURE); }
    return;
  }

  if (result.ok) {
    emitHuman('✓ Pipeline paused. Autopilot will stop after current phase gate.\n');
  } else {
    emitCmdError({ command: 'pause', json, message: result.error || 'Failed to pause' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

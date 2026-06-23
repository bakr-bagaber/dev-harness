/**
 * resume — Resume autopilot execution.
 *
 * Sets config.paused = false. Allows autopilot to continue.
 *
 * Usage: dev-harness resume [--json]
 */
import { set } from '../lib/state.mjs';
import { EXIT } from '../lib/errors.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function resumeCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const result = set(targetDir, 'paused', false);

  if (json) {
    emitJson({
      command: 'resume',
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? 'Pipeline resumed. Run: dev-harness phase <name> to continue.'
        : (result.error || 'Failed to resume'),
    });
    if (!result.ok) { process.exit(EXIT.VALIDATION_FAILURE); }
    return;
  }

  if (result.ok) {
    emitHuman('✓ Pipeline resumed. Run: dev-harness phase <name> to continue.\n');
  } else {
    emitCmdError({ command: 'resume', json, message: result.error || 'Failed to resume' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

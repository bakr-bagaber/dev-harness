/**
 * resume — Resume autopilot execution.
 *
 * Sets config.paused = false. Allows autopilot to continue.
 *
 * Usage: harness-dev resume [--json]
 */
import { set } from '../lib/state.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitHumanError } from '../lib/output.mjs';

export default async function resumeCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const result = set(targetDir, 'paused', false);

  if (json) {
    emitJson({
      command: 'resume',
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? 'Pipeline resumed. Run: harness-dev phase <name> to continue.'
        : (result.error || 'Failed to resume'),
    });
    return;
  }

  if (result.ok) {
    emitHuman('✓ Pipeline resumed. Run: harness-dev phase <name> to continue.\n');
  } else {
    emitHumanError(`✗ ${result.error}\n`);
  }
}

/**
 * resume — Resume autopilot execution.
 *
 * Sets config.paused = false. Allows autopilot to continue.
 * G11: resets all retry counters (task/feature/phase) on resume —
 * resuming from a phase→human escalation means a fresh start.
 *
 * Usage: dev-harness resume [--json]
 */
import { set, loadConfig, saveConfig } from '../lib/state.mjs';
import { EXIT } from '../lib/errors.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function resumeCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  // G11: reset all retry counters on resume (phase→human escalation = fresh start)
  const { config, ok } = loadConfig(targetDir);
  if (ok) {
    config.paused = false;
    config.taskRetryCount = 0;
    config.featureRetryCount = 0;
    config.phaseRetryCount = 0;
    config.retryCount = 0;
    saveConfig(targetDir, config);
  } else {
    // Fallback: just set paused=false (original behavior)
    set(targetDir, 'paused', false);
  }

  const result = { ok: true, error: null };

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

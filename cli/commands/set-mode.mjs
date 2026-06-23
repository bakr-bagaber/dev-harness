/**
 * set-mode — Switch between copilot and autopilot.
 *
 * Usage: dev-harness set-mode <mode>
 *   dev-harness set-mode autopilot
 *   dev-harness set-mode copilot
 *   dev-harness set-mode autopilot --json
 */
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { set, loadConfig, getPhaseOrder } from '../lib/state.mjs';
import { ensureCopilotConfig } from '../lib/modes.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function setModeCommand(args) {
  const { json, targetDir, subcommand: mode } = parseCommandArgs(args);
  const valid = ['copilot', 'autopilot'];

  if (!mode || !valid.includes(mode)) {
    die(
      new CliError(
        `Mode required. Valid: ${valid.join(', ')}.\n  Example: dev-harness set-mode autopilot`,
        EXIT.USAGE_ERROR,
      ),
      json,
    );
    return;
  }

  // Require DEFINE phase or later for autopilot
  if (mode === 'autopilot') {
    const { config, ok } = loadConfig(targetDir);
    if (ok) {
      const order = getPhaseOrder(config.phases?.enabled);
      const defineIdx = order.indexOf('define');
      const currentIdx = config.currentPhase ? order.indexOf(config.currentPhase) : -1;
      if (currentIdx < 0 || currentIdx < defineIdx) {
        const phase = config.currentPhase || 'start';
        die(
          new CliError(
            `Autopilot requires DEFINE phase or later (current: "${phase}").\n  Complete INIT and DEFINE first, then switch to autopilot.`,
            EXIT.VALIDATION_FAILURE,
          ),
          json,
        );
        return;
      }
    }
  }

  const result = set(targetDir, 'mode', mode);

  // Ensure copilot config block exists when switching to copilot
  if (result.ok && mode === 'copilot') {
    ensureCopilotConfig(targetDir);
  }

  if (json) {
    emitJson({
      command: 'set-mode',
      mode,
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? `Mode set to "${mode}"`
        : (result.error || 'Failed to set mode'),
    });
    if (!result.ok) { process.exit(EXIT.VALIDATION_FAILURE); }
    return;
  }

  if (result.ok) {
    emitHuman(`✓ Mode set to "${mode}"\n`);
  } else {
    emitCmdError({ command: 'set-mode', json, message: result.error || 'Failed to set mode' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

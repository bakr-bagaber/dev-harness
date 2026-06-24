/**
 * output — Centralized CLI output helpers.
 *
 * The single emit layer for all CLI output. Every command handler routes
 * output through these helpers to ensure consistent JSON/human formatting
 * and a unified error contract.
 *
 * Canonical boundary (see also errors.mjs):
 *   - lib modules return `{ ok, error, ... }` result objects.
 *   - command handlers translate results to output via emitResult/emitCmdError.
 *   - errors.mjs (CliError/die) is used only at the CLI entry boundary
 *     (dev-harness.mjs top-level catch) for fatal/usage errors.
 *
 * Usage:
 *   import { emitJson, emitHuman, emitHumanError, emitCmdError, emitResult } from '../lib/output.mjs';
 *   emitJson({ command: 'status', status: 'ok', message: '...', ...extras });
 *   emitHuman('✓ Done\n');
 *   emitCmdError({ command: 'config', subcommand: 'set', message: 'bad key', json });
 *   emitResult(result, { command: 'pause', json });
 */

/**
 * Write a JSON object to stdout followed by a newline.
 * @param {object} obj
 */
export function emitJson(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

/**
 * Write human-readable text to stdout.
 * @param {string} text
 */
export function emitHuman(text) {
  process.stdout.write(text);
}

/**
 * Write human-readable error text to stderr.
 * @param {string} text
 */
export function emitHumanError(text) {
  process.stderr.write(text);
}

/**
 * Emit a command error in JSON or human form, to the correct stream.
 *
 * JSON errors go to stderr (keeping stdout parseable for --json consumers).
 * Human errors go to stderr with a `✗` prefix.
 *
 * @param {object} opts
 * @param {string} opts.command — command name
 * @param {boolean} opts.json — JSON mode
 * @param {string} opts.message — error message
 * @param {string} [opts.subcommand] — subcommand if any
 * @param {object} [opts.extras] — additional JSON fields (key, tag, checkpoint, etc.)
 */
export function emitCmdError({ command, json, message, subcommand, ...extras }) {
  if (json) {
    const payload = { command, status: 'error', message, ...extras };
    if (subcommand) payload.subcommand = subcommand;
    process.stderr.write(JSON.stringify(payload) + '\n');
  } else {
    process.stderr.write(`✗ ${message}\n`);
  }
}

/**
 * Emit a standard command result in JSON or human form.
 *
 * Accepts a `{ ok, error, ... }` result object from a lib module and
 * routes to the appropriate output helper. Returns the exit code
 * (0 for success, 1 for failure) so callers can `return emitResult(...)`.
 *
 * @param {{ ok: boolean, error: string|null }} result — lib result object
 * @param {object} opts
 * @param {string} opts.command — command name
 * @param {boolean} opts.json — JSON mode
 * @param {string} [opts.okMessage] — success message (required if result.ok)
 * @param {string} [opts.errMessage] — override error message (defaults to result.error)
 * @param {string} [opts.okText] — human success text (defaults to okMessage)
 * @param {object} [opts.extras] — additional JSON fields on success
 * @returns {number} exit code (0 = success, 1 = failure)
 */
export function emitResult(result, { command, json, okMessage, errMessage, okText, ...extras }) {
  if (result.ok) {
    if (json) {
      emitJson({ command, status: 'ok', message: okMessage ?? 'OK', ...extras });
    } else {
      emitHuman(`✓ ${okText ?? okMessage ?? 'Done'}\n`);
    }
    return 0;
  }
  const msg = errMessage ?? result.error ?? 'Unknown error';
  emitCmdError({ command, json, message: msg, ...extras });
  return 1;
}

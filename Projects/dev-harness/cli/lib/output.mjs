/**
 * output — Centralized CLI output helpers.
 *
 * Standardizes the JSON output contract { command, status, message, ... }
 * and human-mode text emission so every command emits output the same way.
 *
 * Usage:
 *   import { emitJson, emitHuman, emitError } from '../lib/output.mjs';
 *   emitJson({ command: 'status', status: 'ok', message: '...', ...extras });
 *   emitHuman('✓ Done\n');
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
 * Emit a standard command result in JSON or human form.
 *
 * @param {object} opts
 * @param {string} opts.command — command name
 * @param {boolean} opts.json — JSON mode
 * @param {boolean} opts.ok — success flag
 * @param {string} opts.message — status message
 * @param {string} [opts.okText] — human success text (defaults to message)
 * @param {string} [opts.errText] — human error text (defaults to message)
 * @param {object} [opts.extras] — additional JSON fields
 */
// emitResult and emitFatalError removed — commands use emitJson/emitHuman directly.

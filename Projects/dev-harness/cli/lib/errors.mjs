/**
 * Error handling — exit codes, error classes, formatting.
 * Every output path supports --json for machine parsing.
 */

export const EXIT = Object.freeze({
  SUCCESS: 0,
  VALIDATION_FAILURE: 1,
  USAGE_ERROR: 2,
  INTERNAL_ERROR: 3,
});

/**
 * Thrown for user-facing errors (bad args, unknown commands, etc.)
 */
export class CliError extends Error {
  constructor(message, exitCode = EXIT.USAGE_ERROR) {
    super(message);
    this.exitCode = exitCode;
    this.name = 'CliError';
  }
}

/**
 * Thrown when a gate validation check fails.
 */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.exitCode = EXIT.VALIDATION_FAILURE;
    this.name = 'ValidationError';
  }
}

/**
 * Format error for output.
 * @param {Error} err
 * @param {boolean} json
 * @returns {string}
 */
export function formatError(err, json = false) {
  const code = err.exitCode ?? EXIT.INTERNAL_ERROR;
  if (json) {
    const payload = {
      error: err.name ?? 'Error',
      message: err.message,
      exitCode: code,
    };
    // Include stack trace for internal errors (exit 3) to aid debugging.
    // User-facing errors (exit 1/2) stay clean for machine parsing.
    if (code === EXIT.INTERNAL_ERROR && err.stack) {
      payload.stack = err.stack;
    }
    return JSON.stringify(payload);
  }
  const label = code === 2 ? 'Usage error' : code === 1 ? 'Validation' : 'Error';
  return `${label}: ${err.message}`;
}

/**
 * Print error to stderr and exit with the appropriate code.
 * @param {Error} err
 * @param {boolean} json
 */
export function die(err, json = false) {
  const msg = formatError(err, json);
  const code = err.exitCode ?? EXIT.INTERNAL_ERROR;
  // JSON errors always go to stderr so stdout stays parseable
  process.stderr.write(msg + '\n');
  process.exit(code);
}

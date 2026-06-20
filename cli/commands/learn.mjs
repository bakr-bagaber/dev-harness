/**
 * learn — Append a lesson to progress.md.
 *
 * Usage:
 *   harness-dev learn "Lesson text here"
 *   harness-dev learn "Lesson text" --json
 */
import { CliError, EXIT, die } from '../lib/errors.mjs';
import { appendLesson } from '../lib/progress.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitHumanError } from '../lib/output.mjs';

export default async function learnCommand(args) {
  const { json, targetDir, subcommand, positionals } = parseCommandArgs(args);
  const message = subcommand || positionals.join(' ');

  if (!message) {
    die(
      new CliError(
        'Lesson message required.\n  Example: harness-dev learn "Token refresh gotcha — accepts access_token in body"',
        EXIT.USAGE_ERROR,
      ),
      json,
    );
    return;
  }

  const result = appendLesson(targetDir, message);

  if (json) {
    emitJson({
      command: 'learn',
      lesson: message,
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? `Lesson saved: "${message}"`
        : (result.error || 'Failed to save lesson'),
    });
    return;
  }

  if (result.ok) {
    emitHuman(`✓ Lesson saved\n  "${message}"\n`);
  } else {
    emitHumanError(`✗ ${result.error}\n`);
  }
}

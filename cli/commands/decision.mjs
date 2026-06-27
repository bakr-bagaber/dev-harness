/**
 * decision — Record a decision in lessons-decisions.md (G18).
 *
 * Mirrors `learn` but for decisions. Each decision is paired with the
 * last lesson (preserves causality). Decisions are recorded live (not
 * backfilled at REVIEW).
 *
 * Usage:
 *   dev-harness decision "text" [--links-lesson "lesson text"]
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { appendDecision, readLessons } from '../lib/progress.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';

export default async function decisionCommand(args) {
  const { json, targetDir, subcommand, positionals } = parseCommandArgs(args);

  // Text comes from subcommand (first positional) or --text flag
  const text = subcommand || positionals.join(' ') || args.flags?.text;
  if (!text) {
    die(new CliError(
      'Usage: dev-harness decision "text" [--links-lesson "lesson text"]\n' +
      '  Records a decision in harness/lessons-decisions.md, linked to the last lesson.',
      EXIT.USAGE_ERROR,
    ), json);
    return;
  }

  // Optionally link to a specific lesson; default to the last lesson
  const linkedLesson = args.flags?.['links-lesson'] || (() => {
    const lessons = readLessons(targetDir);
    return lessons.length > 0 ? lessons[lessons.length - 1].text : null;
  })();

  const result = appendDecision(targetDir, text, linkedLesson);

  if (json) {
    emitJson({
      command: 'decision',
      status: result.ok ? 'ok' : 'error',
      message: result.ok
        ? `Decision recorded in lessons-decisions.md${linkedLesson ? ` (linked to: "${linkedLesson.slice(0, 50)}...")` : ''}`
        : (result.error || 'Failed to record decision'),
    });
    if (!result.ok) { process.exit(EXIT.VALIDATION_FAILURE); }
    return;
  }

  if (result.ok) {
    emitHuman(`✓ Decision recorded in harness/lessons-decisions.md\n`);
    if (linkedLesson) {
      emitHuman(`  Linked to lesson: "${linkedLesson.slice(0, 60)}..."\n`);
    }
  } else {
    emitCmdError({ command: 'decision', json, message: result.error || 'Failed to record decision' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

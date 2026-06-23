#!/usr/bin/env node
/**
 * checkpoint — Manual checkpoint tagging (create).
 *
 * T18 implementation:
 *   create <label> — git tag -a manual/<label> -m "checkpoint: <label>"
 *
 * This complements the rollback system. Manual checkpoints let users
 * save named recovery points (e.g. "before-refactor") that appear
 * in `rollback list` and can be used with `rollback to/branch`.
 *
 * Usage: dev-harness checkpoint create <label>
 */
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { execGit, getGitRoot, gitTagExists, createGitTag } from '../lib/git.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

export default async function checkpointCommand(args) {
  const { json, targetDir, force } = parseCommandArgs(args);
  const sub = args.subcommand;
  const label = args.positionals[0];

  if (sub !== 'create' || !label) {
    die(new CliError('Usage: dev-harness checkpoint create <label> [--force]', EXIT.USAGE_ERROR), json);
    return;
  }

  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) {
    emitCmdError({ command: 'checkpoint', subcommand: 'create', json, message: 'Not inside a git repository. Checkpoints require git tags.', label });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Verify working tree is clean (encourage checkpointing at known states).
  // --force skips this check for users who intentionally checkpoint dirty states.
  const cleanCheck = await execGit('git status --porcelain', gitRoot);
  if (!force && cleanCheck.ok && cleanCheck.stdout.length > 0) {
    emitCmdError({ command: 'checkpoint', subcommand: 'create', json, label, message: 'Working tree is not clean. Commit or stash changes, or use --force to checkpoint anyway.' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  const tagName = `manual/${label}`;

  // Check tag doesn't already exist
  if (await gitTagExists(tagName, gitRoot)) {
    emitCmdError({ command: 'checkpoint', subcommand: 'create', json, label, tag: tagName, message: `Tag "${tagName}" already exists. Use a different label.` });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Create the annotated tag
  const created = await createGitTag(tagName, `checkpoint: ${label}`, gitRoot);

  if (!created) {
    emitCmdError({ command: 'checkpoint', subcommand: 'create', json, label, tag: tagName, message: `Failed to create checkpoint tag: ${tagName}` });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Get the hash the tag points to
  const hashR = await execGit(`git rev-parse --short "${tagName}"`, gitRoot);
  const hash = hashR.ok ? hashR.stdout : '—';

  if (json) {
    emitJson({
      command: 'checkpoint',
      subcommand: 'create',
      label,
      tag: tagName,
      hash,
      status: 'ok',
      message: `Checkpoint "${tagName}" created (${hash})`,
    });
  } else {
    emitHuman(`✓ Checkpoint "${tagName}" created (${hash})\n`);
  }
}

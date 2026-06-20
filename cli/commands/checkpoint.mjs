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
 * Usage: harness-dev checkpoint create <label>
 */
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { execGit, getGitRoot, gitTagExists, createGitTag } from '../lib/git.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';

export default async function checkpointCommand(args) {
  const { json, targetDir, force } = parseCommandArgs(args);
  const sub = args.subcommand;
  const label = args.positionals[0];

  if (sub !== 'create' || !label) {
    die(new CliError('Usage: harness-dev checkpoint create <label> [--force]', EXIT.USAGE_ERROR), json);
    return;
  }

  const gitRoot = getGitRoot(targetDir);
  if (!gitRoot) {
    const msg = 'Not inside a git repository. Checkpoints require git tags.';
    if (json) {
      process.stdout.write(JSON.stringify({ command: 'checkpoint', subcommand: 'create', label, status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return;
  }

  // Verify working tree is clean (encourage checkpointing at known states).
  // --force skips this check for users who intentionally checkpoint dirty states.
  const cleanCheck = execGit('git status --porcelain', gitRoot);
  if (!force && cleanCheck.ok && cleanCheck.stdout.length > 0) {
    if (json) {
      process.stdout.write(JSON.stringify({ command: 'checkpoint', subcommand: 'create', label, status: 'error', message: 'Working tree is not clean. Commit or stash changes, or use --force to checkpoint anyway.' }) + '\n');
    } else {
      process.stderr.write('Error: Working tree is not clean. Commit or stash changes, or use --force to checkpoint anyway.\n');
    }
    return;
  }

  const tagName = `manual/${label}`;

  // Check tag doesn't already exist
  if (gitTagExists(tagName, gitRoot)) {
    const msg = `Tag "${tagName}" already exists. Use a different label.`;
    if (json) {
      process.stdout.write(JSON.stringify({ command: 'checkpoint', subcommand: 'create', label, tag: tagName, status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return;
  }

  // Create the annotated tag
  const created = createGitTag(tagName, `checkpoint: ${label}`, gitRoot);

  if (!created) {
    const msg = `Failed to create checkpoint tag: ${tagName}`;
    if (json) {
      process.stdout.write(JSON.stringify({ command: 'checkpoint', subcommand: 'create', label, tag: tagName, status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return;
  }

  // Get the hash the tag points to
  const hashR = execGit(`git rev-parse --short "${tagName}"`, gitRoot);
  const hash = hashR.ok ? hashR.stdout : '—';

  if (json) {
    process.stdout.write(JSON.stringify({
      command: 'checkpoint',
      subcommand: 'create',
      label,
      tag: tagName,
      hash,
      status: 'ok',
      message: `Checkpoint "${tagName}" created (${hash})`,
    }) + '\n');
  } else {
    process.stdout.write(`✓ Checkpoint "${tagName}" created (${hash})\n`);
  }
}

#!/usr/bin/env node
/**
 * rollback — Checkpoint recovery (list/to/branch).
 *
 * T18 implementation:
 *   list              — List available checkpoints (tags)
 *   to <checkpoint>   — Restore working tree to checkpoint state
 *   branch <checkpoint> — Create recovery branch at checkpoint
 *
 * Supports tag patterns:
 *   phase/<name>     — Phase completion tags (set by phase loop)
 *   iter/<N>         — Iteration tags (set by task loop)
 *   manual/<label>   — User-created manual checkpoints
 *   recovery/*       — Recovery branches (for informational display)
 *
 * Usage: dev-harness rollback <subcommand> [checkpoint]
 */
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { execGit, getGitRoot } from '../lib/git.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

const SUBCOMMANDS = ['list', 'to', 'branch'];

/**
 * Parse git tag list and return structured checkpoint data.
 */
async function listCheckpoints(gitRoot) {
  // Get all harness-related tags with their dates
  const r = await execGit(
    'git tag --list "phase/*" "iter/*" "manual/*" --sort=-taggerdate --format="%(refname:short)|%(taggerdate:iso)|%(objectname)"',
    gitRoot,
  );

  if (!r.ok || !r.stdout) {
    return [];
  }

  const checkpoints = [];
  for (const line of r.stdout.split('\n').filter(Boolean)) {
    const [ref, date, hash] = line.split('|');
    if (!ref) {continue;}
    const segments = ref.split('/');
    const type = segments[0]; // phase, iter, manual
    const name = segments.slice(1).join('/');
    checkpoints.push({ ref, type, name, date: date || 'unknown', hash: hash || '—' });
  }

  // Also add annotated tags that may not have taggerdate (fallback to *-taggerdate)
  // Sort reverse chronologically (newest first)
  return checkpoints;
}

/**
 * Get short description for a checkpoint type.
 */
function checkpointTypeLabel(type) {
  switch (type) {
    case 'phase': return 'Phase gate pass';
    case 'iter': return 'Iteration checkpoint';
    case 'manual': return 'Manual checkpoint';
    default: return 'Checkpoint';
  }
}

export default async function rollbackCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);
  const sub = args.subcommand;

  if (!sub || !SUBCOMMANDS.includes(sub)) {
    die(new CliError(`Usage: dev-harness rollback ${SUBCOMMANDS.join('|')}`, EXIT.USAGE_ERROR), json);
    return;
  }

  if (sub !== 'list' && args.positionals.length < 1) {
    die(new CliError(`Usage: dev-harness rollback ${sub} <checkpoint>`, EXIT.USAGE_ERROR), json);
    return;
  }

  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) {
    emitCmdError({ command: 'rollback', subcommand: sub, json, message: 'Not inside a git repository. This command requires a git repo with checkpoint tags.' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  const checkpoint = args.positionals[0] || null;

  // ── list ─────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const checkpoints = await listCheckpoints(gitRoot);

    // Also list recovery branches
    const branchR = await execGit(
      'git branch --list "recovery/*" --format="%(refname:short)|%(subject)|%(objectname:short)"',
      gitRoot,
    );
    const recoveryBranches = [];
    if (branchR.ok && branchR.stdout) {
      for (const line of branchR.stdout.split('\n').filter(Boolean)) {
        const [ref, subject, hash] = line.split('|');
        recoveryBranches.push({ branch: ref || line, subject: subject || '', hash: hash || '' });
      }
    }

    if (json) {
      emitJson({
        command: 'rollback',
        subcommand: 'list',
        status: 'ok',
        message: `${checkpoints.length} checkpoint(s) found`,
        checkpoints,
        recoveryBranches,
      });
    } else {
      if (checkpoints.length === 0 && recoveryBranches.length === 0) {
        emitHuman('No checkpoints found. Phase tags (phase/*) and iteration tags (iter/*) are created automatically when auto-tagging is enabled.\n');
        emitHuman('Manual checkpoints: dev-harness checkpoint create <label>\n');
      } else {
        if (checkpoints.length > 0) {
          emitHuman('Checkpoints:\n');
          emitHuman(`${''.padEnd(32)} Type                      Date                       Hash\n`);
          emitHuman(`${''.padEnd(32, '-')} ${''.padEnd(26, '-')} ${''.padEnd(26, '-')} ${''.padEnd(10, '-')}\n`);
          for (const cp of checkpoints) {
            const typeLabel = checkpointTypeLabel(cp.type).padEnd(26);
            const date = (cp.date || '—').padEnd(26);
            emitHuman(`${cp.ref.padEnd(32)} ${typeLabel} ${date} ${cp.hash}\n`);
          }
        }
        if (recoveryBranches.length > 0) {
          emitHuman('\nRecovery branches:\n');
          for (const rb of recoveryBranches) {
            emitHuman(`  ${rb.branch}  (${rb.hash})\n`);
          }
        }
      }
    }
    return;
  }

  // ── to ───────────────────────────────────────────────────────────────────
  if (sub === 'to') {
    // Verify the tag exists
    const tagCheck = await execGit(`git rev-parse --verify "${checkpoint}^{commit}"`, gitRoot);
    if (!tagCheck.ok) {
      emitCmdError({ command: 'rollback', subcommand: 'to', json, checkpoint, message: `Checkpoint "${checkpoint}" not found. Run: dev-harness rollback list` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    const targetHash = tagCheck.stdout;

    // Stash any uncommitted changes
    await execGit('git stash push -m "rollback-auto-stash"', gitRoot);

    // Restore all files from the checkpoint
    const restoreFiles = [
      'harness/config.json',
      'harness/progress.md',
      'harness/features/feature-list.json',
    ];

    // First, restore the whole working tree from the tag
    const restoreResult = await execGit(`git checkout "${checkpoint}" -- .`, gitRoot);
    if (!restoreResult.ok) {
      emitCmdError({ command: 'rollback', subcommand: 'to', json, checkpoint, message: `Failed to restore files from ${checkpoint}: ${restoreResult.stderr || restoreResult.stdout}` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }

    // Also explicitly restore harness state files from the tag
    for (const file of restoreFiles) {
      await execGit(`git checkout "${checkpoint}" -- "${file}"`, gitRoot);
    }

    if (json) {
      emitJson({
        command: 'rollback',
        subcommand: 'to',
        checkpoint,
        hash: targetHash,
        status: 'ok',
        message: `Working tree restored to checkpoint "${checkpoint}" (${targetHash.slice(0, 8)})`,
      });
    } else {
      emitHuman(`✓ Working tree restored to checkpoint "${checkpoint}" (${targetHash.slice(0, 8)})\n`);
      emitHuman(`  Files restored from ${checkpoint}\n`);
      emitHuman('  Note: Uncommitted changes were stashed (git stash list)\n');
    }
    return;
  }

  // ── branch ───────────────────────────────────────────────────────────────
  if (sub === 'branch') {
    // Verify the tag exists
    const tagCheck = await execGit(`git rev-parse --verify "${checkpoint}^{commit}"`, gitRoot);
    if (!tagCheck.ok) {
      emitCmdError({ command: 'rollback', subcommand: 'branch', json, checkpoint, message: `Checkpoint "${checkpoint}" not found. Run: dev-harness rollback list` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    const targetHash = tagCheck.stdout;

    // Generate a safe branch name
    const safeName = checkpoint.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/\//g, '-');
    const branchName = `recovery/from-${safeName}`;

    // Check branch doesn't already exist
    const branchCheck = await execGit(`git show-ref --verify --quiet refs/heads/${branchName}`, gitRoot);
    if (branchCheck.ok) {
      emitCmdError({ command: 'rollback', subcommand: 'branch', json, checkpoint, branch: branchName, message: `Recovery branch "${branchName}" already exists. Check it out directly: git checkout ${branchName}` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }

    // Create the recovery branch
    const branchResult = await execGit(`git checkout -b "${branchName}" "${checkpoint}"`, gitRoot);
    if (!branchResult.ok) {
      emitCmdError({ command: 'rollback', subcommand: 'branch', json, checkpoint, branch: branchName, message: `Failed to create recovery branch: ${branchResult.stderr || branchResult.stdout}` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }

    if (json) {
      emitJson({
        command: 'rollback',
        subcommand: 'branch',
        checkpoint,
        branch: branchName,
        hash: targetHash,
        status: 'ok',
        message: `Recovery branch "${branchName}" created at checkpoint "${checkpoint}"`,
      });
    } else {
      emitHuman(`✓ Recovery branch "${branchName}" created at checkpoint "${checkpoint}" (${targetHash.slice(0, 8)})\n`);
    }
    return;
  }
}

#!/usr/bin/env node
/**
 * worktree — Git worktree management (create/list/prune/remove).
 *
 * T17 implementation:
 *   create <name>   — git worktree add ../feat-<name> feat/<name> + scaffold
 *   list            — list active worktrees with branch, path
 *   prune           — git worktree prune (remove orphaned metadata)
 *   remove <name>   — git worktree remove + optionally delete branch
 *
 * Usage: dev-harness worktree <subcommand> [name] [options]
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { detectStack } from '../lib/detect-stack.mjs';
import { loadConfig, saveConfig } from '../lib/state.mjs';
import { execGit, getGitRoot } from '../lib/git.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';

const SUBCOMMANDS = ['create', 'list', 'prune', 'remove'];

export default async function worktreeCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);
  const sub = args.subcommand;

  if (!sub || !SUBCOMMANDS.includes(sub)) {
    die(new CliError(`Usage: dev-harness worktree ${SUBCOMMANDS.join('|')}`, EXIT.USAGE_ERROR), json);
    return;
  }

  const gitRoot = getGitRoot(targetDir);
  if (!gitRoot) {
    const msg = 'Not inside a git repository. Run: git init first or dev-harness init';
    if (json) {
      process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: sub, status: 'error', message: msg }) + '\n');
    } else {
      process.stderr.write(`Error: ${msg}\n`);
    }
    return;
  }

  // ── create ───────────────────────────────────────────────────────────────
  if (sub === 'create') {
    const name = args.positionals[0];
    if (!name) {
      die(new CliError('Usage: dev-harness worktree create <name>', EXIT.USAGE_ERROR), json);
      return;
    }

    const branchName = `feat/${name}`;
    const worktreePath = resolve(dirname(gitRoot), `feat-${name}`);

    // Check branch doesn't already exist
    const branchCheck = execGit(`git show-ref --verify --quiet refs/heads/${branchName}`, gitRoot);
    if (branchCheck.ok) {
      const msg = `Branch "${branchName}" already exists. Choose a different name.`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'create', name, branch: branchName, status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    // Check target directory doesn't exist
    if (existsSync(worktreePath)) {
      const msg = `Target directory already exists: ${worktreePath}`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'create', name, branch: branchName, path: worktreePath, status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    // Create the worktree
    const addResult = execGit(`git worktree add "${worktreePath}" -b "${branchName}"`, gitRoot);
    if (!addResult.ok) {
      const msg = `Failed to create worktree: ${addResult.stderr || addResult.stdout}`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'create', name, branch: branchName, path: worktreePath, status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    // Scaffold harness in the new worktree — run full init with parent's detected stack
    const stack = detectStack(worktreePath).name;
    const harnessDevPath = new URL('../dev-harness.mjs', import.meta.url).pathname;
    const initResult = execGit(
      `node "${harnessDevPath}" init --stack "${stack}" --force --no-git --json`,
      worktreePath,
    );
    let filesCreated = 0;
    let initErrors = [];
    if (initResult.ok && initResult.stdout) {
      try {
        const initJson = JSON.parse(initResult.stdout);
        filesCreated = initJson.filesCreated || 0;
        initErrors = initJson.errors || [];
      } catch { /* ignore parse error — fall through */ }
    }

    // Overwrite harness-config.json with worktree context (keep init settings)
    const cfg = {
      version: '1.0',
      stack,
      mode: 'copilot',
      currentPhase: null,
      paused: false,
      features: { remaining: 0, passing: 0, total: 0 },
      gates: { enabled: false, checks: ['all'] },
      git: { autoCommit: false, autoTag: false, resetOnRetry: false, branch: branchName, clean: true, hasUpstream: false, lastCommitMessage: null },
      phases: { enabled: ['define', 'plan', 'build', 'verify', 'review', 'ship'] },
      agents: { tone: { planner: 'Analytical and precise. Define clear boundaries.', generator: 'Focused and practical. Build what\'s specified, nothing more.', evaluator: 'Skeptical and thorough. Accept only compelling evidence.', simplifier: 'Relentless about clarity. Delete more than you add.' } },
      maxRetries: 3,
      gateHistory: [],
      worktree: { parent: gitRoot, name, branch: branchName },
    };
    saveConfig(worktreePath, cfg);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'worktree',
        subcommand: 'create',
        name,
        branch: branchName,
        path: worktreePath,
        stacked: true,
        status: initErrors.length > 0 ? 'partial' : 'ok',
        message: `Worktree created at ${worktreePath} on branch ${branchName}`,
        filesCreated,
        errors: initErrors,
      }) + '\n');
    } else {
      process.stdout.write(`✓ Worktree created at ${worktreePath}\n`);
      process.stdout.write(`  Branch: ${branchName}\n`);
      process.stdout.write(`  Harness scaffolded with stack "${stack}" (${filesCreated} files)\n`);
      for (const e of initErrors) {
        process.stderr.write(`  ⚠ ${e}\n`);
      }
    }
    return;
  }

  // ── list ─────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const result = execGit('git worktree list', gitRoot);
    if (!result.ok) {
      const msg = `Failed to list worktrees: ${result.stderr || result.stdout}`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'list', status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    const lines = result.stdout.split('\n').filter(Boolean);
    const worktrees = lines.map(line => {
      const parts = line.split(/\s+/);
      const path = parts[0];
      const hash = parts[1];
      const branch = parts.slice(2).join(' ').replace(/^\[|\]$/g, '') || '(detached HEAD)';
      return { path, hash, branch };
    });

    // Try to enrich with harness phase info
    for (const wt of worktrees) {
      const cfg = loadConfig(wt.path);
      if (cfg.ok && cfg.config) {
        wt.phase = cfg.config.currentPhase || null;
        wt.stack = cfg.config.stack || null;
      } else {
        wt.phase = null;
        wt.stack = null;
      }
    }

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'worktree',
        subcommand: 'list',
        status: 'ok',
        message: `${worktrees.length} worktree(s)`,
        worktrees,
      }) + '\n');
    } else {
      if (worktrees.length === 0) {
        process.stdout.write('No worktrees found.\n');
      } else {
        process.stdout.write(`${'Path'.padEnd(50)} ${'Branch'.padEnd(30)} Phase\n`);
        process.stdout.write(`${''.padEnd(50, '-')} ${''.padEnd(30, '-')} ${''.padEnd(10, '-')}\n`);
        for (const wt of worktrees) {
          const phase = wt.phase || '—';
          process.stdout.write(`${wt.path.padEnd(50)} ${wt.branch.padEnd(30)} ${phase}\n`);
        }
      }
    }
    return;
  }

  // ── prune ────────────────────────────────────────────────────────────────
  if (sub === 'prune') {
    const result = execGit('git worktree prune', gitRoot);
    if (!result.ok) {
      const msg = `Failed to prune worktrees: ${result.stderr || result.stdout}`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'prune', status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'worktree',
        subcommand: 'prune',
        status: 'ok',
        message: 'Orphaned worktree metadata pruned',
      }) + '\n');
    } else {
      process.stdout.write('✓ Orphaned worktree metadata pruned\n');
    }
    return;
  }

  // ── remove ───────────────────────────────────────────────────────────────
  if (sub === 'remove') {
    const name = args.positionals[0];
    if (!name) {
      die(new CliError('Usage: dev-harness worktree remove <name>', EXIT.USAGE_ERROR), json);
      return;
    }

    const worktreePath = resolve(dirname(gitRoot), `feat-${name}`);
    const branchName = `feat/${name}`;

    if (!existsSync(worktreePath)) {
      const msg = `Worktree path not found: ${worktreePath}. It may have been deleted manually.`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'remove', name, status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    // Remove worktree
    const forceRemove = args.flags?.force === true || args.flags?.force === 'true';
    let removeResult;
    if (forceRemove) {
      removeResult = execGit(`git worktree remove --force "${worktreePath}"`, gitRoot);
    } else {
      removeResult = execGit(`git worktree remove "${worktreePath}"`, gitRoot);
    }
    if (!removeResult.ok) {
      const msg = `Failed to remove worktree: ${removeResult.stderr || removeResult.stdout}`;
      if (json) {
        process.stdout.write(JSON.stringify({ command: 'worktree', subcommand: 'remove', name, status: 'error', message: msg }) + '\n');
      } else {
        process.stderr.write(`Error: ${msg}\n`);
      }
      return;
    }

    // Optionally delete the branch (--delete-branch flag)
    const deleteBranch = args.flags?.['delete-branch'] === true || args.flags?.['delete-branch'] === 'true';
    let branchDeleted = false;
    if (deleteBranch) {
      const branchResult = execGit(`git branch -D "${branchName}"`, gitRoot);
      if (branchResult.ok) {
        branchDeleted = true;
      }
    }

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'worktree',
        subcommand: 'remove',
        name,
        path: worktreePath,
        branchDeleted,
        status: 'ok',
        message: `Worktree removed from ${worktreePath}`,
      }) + '\n');
    } else {
      process.stdout.write(`✓ Worktree removed from ${worktreePath}\n`);
      if (branchDeleted) {
        process.stdout.write(`  Branch "${branchName}" deleted\n`);
      }
    }
    return;
  }
}

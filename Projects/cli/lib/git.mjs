/**
 * git — Centralized git command execution helpers (async).
 *
 * All git operations in the CLI go through this module so timeout handling,
 * error recovery, and result shaping are consistent. Backed by `simple-git`
 * for typed high-level operations and a promisified `child_process.exec`
 * for arbitrary `git` subcommands that don't have a simple-git equivalent
 * (e.g. `git worktree add`, `git symbolic-ref`).
 *
 * Every public function is async and returns the same result shapes as the
 * previous sync version, so callers only need to `await` the call.
 *
 * Result shapes (unchanged from v2.0.0):
 *   execGit       → { ok, stdout, stderr, exitCode }
 *   execGitCheck  → { out, exitCode }
 *   getGitRoot    → string|null
 *   getGitBranch  → string|null
 *   isGitClean    → boolean
 *   getLastCommitMessage → string|null
 *   hasGitUpstream → boolean
 *   gitTagExists  → boolean
 *   createGitTag  → boolean
 *   gitHardResetClean → { ok, error }
 *
 * Usage:
 *   import { execGit, getGitRoot, getGitBranch, isGitClean } from './git.mjs';
 *   const r = await execGit('git status --porcelain', cwd);
 *   if (!r.ok) { ... }
 */
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import simpleGit from 'simple-git';
import { COMMAND_TIMEOUT } from './constants.mjs';

const execAsync = promisify(execCb);

/** Default timeout for git commands. */
const GIT_TIMEOUT = COMMAND_TIMEOUT;

/**
 * Run an arbitrary git command asynchronously and return a normalized result.
 * Never throws — errors are captured into the result object.
 * @param {string} cmd — shell command (typically `git ...`)
 * @param {string} cwd — working directory
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, exitCode: number }>}
 */
export async function execGit(cmd, cwd) {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      encoding: 'utf-8',
      timeout: GIT_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout: (stdout || '').trim(), stderr: (stderr || '').trim(), exitCode: 0 };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
      exitCode: err.code || (typeof err.status === 'number' ? err.status : 1),
    };
  }
}

/**
 * Run a git command and return trimmed stdout + exitCode (gates.mjs shape).
 * Async version of the previous sync helper.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {Promise<{ out: string, exitCode: number }>}
 */
export async function execGitCheck(cmd, cwd) {
  const r = await execGit(cmd, cwd);
  return { out: r.ok ? r.stdout : r.stderr, exitCode: r.exitCode };
}

/**
 * Get the absolute path of the git repo root containing `cwd`, or null.
 * Uses simple-git for typed result; falls back to execGit on error.
 * @param {string} cwd
 * @returns {Promise<string|null>}
 */
export async function getGitRoot(cwd) {
  try {
    const git = simpleGit(cwd);
    const root = await git.revparse(['--show-toplevel']);
    return root ? resolve(root.trim()) : null;
  } catch {
    // Not a git repo or git unavailable.
    const r = await execGit('git rev-parse --show-toplevel', cwd);
    return r.ok && r.stdout ? resolve(r.stdout) : null;
  }
}

/**
 * Read current git branch name, or null if not on a branch / not a repo.
 * @param {string} cwd
 * @returns {Promise<string|null>}
 */
export async function getGitBranch(cwd) {
  try {
    const git = simpleGit(cwd);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const trimmed = (branch || '').trim();
    return trimmed || null;
  } catch {
    const r = await execGit('git rev-parse --abbrev-ref HEAD 2>/dev/null', cwd);
    return r.ok && r.stdout ? r.stdout : null;
  }
}

/**
 * Check if the git working tree is clean. Non-repo → true (assume clean).
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function isGitClean(cwd) {
  try {
    const git = simpleGit(cwd);
    const status = await git.status();
    return status.isClean();
  } catch {
    // Non-repo → assume clean (matches previous behavior).
    const r = await execGit('git status --porcelain 2>/dev/null', cwd);
    if (!r.ok) { return true; }
    return r.stdout === '';
  }
}

/**
 * Get last commit message subject, or null.
 * @param {string} cwd
 * @returns {Promise<string|null>}
 */
export async function getLastCommitMessage(cwd) {
  try {
    const git = simpleGit(cwd);
    const log = await git.log({ maxCount: 1 });
    return log.latest ? log.latest.message : null;
  } catch {
    const r = await execGit('git log -1 --format=%s 2>/dev/null', cwd);
    return r.ok && r.stdout ? r.stdout : null;
  }
}

/**
 * Check whether HEAD has an upstream tracking branch.
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function hasGitUpstream(cwd) {
  const r = await execGit('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null', cwd);
  return r.ok && r.stdout !== '';
}

/**
 * Check whether a git tag exists.
 * @param {string} tag
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function gitTagExists(tag, cwd) {
  const r = await execGit(`git rev-parse --verify "${tag}"`, cwd);
  return r.ok;
}

/**
 * Create a git tag (annotated). Returns true on success.
 * @param {string} tag
 * @param {string} message
 * @param {string} cwd
 * @returns {Promise<boolean>}
 */
export async function createGitTag(tag, message, cwd) {
  try {
    const git = simpleGit(cwd);
    await git.addAnnotatedTag(tag, message);
    return true;
  } catch {
    // Fall back to shell exec (preserves previous error-tolerance behavior).
    const r = await execGit(`git tag -a "${tag}" -m "${message.replace(/"/g, '\\"')}"`, cwd);
    return r.ok;
  }
}

/**
 * Hard reset to HEAD and remove untracked/ignored files (fresh context).
 * Used by the Ralph inner loop when --git-ops is enabled.
 * @param {string} cwd
 * @returns {Promise<{ ok: boolean, error: string|null }>}
 */
export async function gitHardResetClean(cwd) {
  try {
    const git = simpleGit(cwd);
    await git.reset(['--hard', 'HEAD']);
    // simple-git doesn't expose `clean -fdx` directly; use raw.
    await git.raw(['clean', '-fdx']);
    return { ok: true, error: null };
  } catch (err) {
    // Fall back to shell exec for environments where simple-git struggles.
    const reset = await execGit('git reset --hard HEAD', cwd);
    if (!reset.ok) {
      return { ok: false, error: reset.stderr || reset.stdout || 'git reset failed' };
    }
    const clean = await execGit('git clean -fdx', cwd);
    if (!clean.ok) {
      return { ok: false, error: clean.stderr || clean.stdout || 'git clean failed' };
    }
    return { ok: true, error: null };
  }
}

/**
 * git — Centralized git command execution helpers.
 *
 * All git operations in the CLI go through this module so timeout handling,
 * error recovery, and result shaping are consistent.
 *
 * Result shape: { ok: boolean, stdout: string, stderr: string, exitCode: number }
 *
 * Usage:
 *   import { execGit, getGitRoot, getGitBranch, isGitClean } from './git.mjs';
 *   const r = execGit('git status --porcelain', cwd);
 *   if (!r.ok) { ... }
 */
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { COMMAND_TIMEOUT } from './constants.mjs';

/** Default timeout for git commands. */
const GIT_TIMEOUT = COMMAND_TIMEOUT;

/**
 * Run a git command and return a normalized result. Never throws.
 * @param {string} cmd — shell command (typically `git ...`)
 * @param {string} cwd — working directory
 * @returns {{ ok: boolean, stdout: string, stderr: string, exitCode: number }}
 */
export function execGit(cmd, cwd) {
  try {
    const out = execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: GIT_TIMEOUT });
    return { ok: true, stdout: out.trim(), stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
      exitCode: err.status || 1,
    };
  }
}

/**
 * Run a git command and return trimmed stdout + exitCode (gates.mjs shape).
 * Kept for compatibility with the gates check helper convention.
 * @param {string} cmd
 * @param {string} cwd
 * @returns {{ out: string, exitCode: number }}
 */
export function execGitCheck(cmd, cwd) {
  const r = execGit(cmd, cwd);
  return { out: r.ok ? r.stdout : r.stderr, exitCode: r.exitCode };
}

/**
 * Get the absolute path of the git repo root containing `cwd`, or null.
 * @param {string} cwd
 * @returns {string|null}
 */
export function getGitRoot(cwd) {
  const r = execGit('git rev-parse --show-toplevel', cwd);
  if (!r.ok) { return null; }
  return resolve(r.stdout);
}

/**
 * Read current git branch name, or null if not on a branch / not a repo.
 * @param {string} cwd
 * @returns {string|null}
 */
export function getGitBranch(cwd) {
  const r = execGit('git rev-parse --abbrev-ref HEAD 2>/dev/null', cwd);
  return r.ok && r.stdout ? r.stdout : null;
}

/**
 * Check if the git working tree is clean. Non-repo → true (assume clean).
 * @param {string} cwd
 * @returns {boolean}
 */
export function isGitClean(cwd) {
  const r = execGit('git status --porcelain 2>/dev/null', cwd);
  if (!r.ok) { return true; }
  return r.stdout === '';
}

/**
 * Get last commit message subject, or null.
 * @param {string} cwd
 * @returns {string|null}
 */
export function getLastCommitMessage(cwd) {
  const r = execGit('git log -1 --format=%s 2>/dev/null', cwd);
  return r.ok && r.stdout ? r.stdout : null;
}

/**
 * Check whether HEAD has an upstream tracking branch.
 * @param {string} cwd
 * @returns {boolean}
 */
export function hasGitUpstream(cwd) {
  const r = execGit('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null', cwd);
  return r.ok && r.stdout !== '';
}

/**
 * Check whether a git tag exists.
 * @param {string} tag
 * @param {string} cwd
 * @returns {boolean}
 */
export function gitTagExists(tag, cwd) {
  const r = execGit(`git rev-parse --verify "${tag}"`, cwd);
  return r.ok;
}

/**
 * Create a git tag (annotated). Returns true on success.
 * @param {string} tag
 * @param {string} message
 * @param {string} cwd
 * @returns {boolean}
 */
export function createGitTag(tag, message, cwd) {
  const r = execGit(`git tag -a "${tag}" -m "${message.replace(/"/g, '\\"')}"`, cwd);
  return r.ok;
}

/**
 * Hard reset to HEAD and remove untracked/ignored files (fresh context).
 * Used by the Ralph inner loop when --git-ops is enabled.
 * @param {string} cwd
 * @returns {{ ok: boolean, error: string|null }}
 */
export function gitHardResetClean(cwd) {
  const reset = execGit('git reset --hard HEAD', cwd);
  if (!reset.ok) {
    return { ok: false, error: reset.stderr || reset.stdout || 'git reset failed' };
  }
  const clean = execGit('git clean -fdx', cwd);
  if (!clean.ok) {
    return { ok: false, error: clean.stderr || clean.stdout || 'git clean failed' };
  }
  return { ok: true, error: null };
}

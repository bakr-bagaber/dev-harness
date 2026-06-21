/**
 * Claude Code spawn adapter — spawns Claude Code CLI per task with fresh session.
 *
 * Claude Code supports a non-interactive mode via `claude -p` (or --print).
 * Each task gets a fresh invocation, ensuring session isolation.
 *
 * Usage:
 *   import { spawnAgent, detectCompletion } from './spawn.mjs';
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Spawn a Claude Code agent to work on a task.
 *
 * Uses `claude -p` (print/non-interactive mode) with the task prompt.
 * Claude Code reads CLAUDE.md from the project root automatically.
 *
 * @param {object} opts
 * @param {string} opts.taskPrompt — Full task prompt text
 * @param {string} opts.taskFile — Path to harness/current-task.md
 * @param {string} opts.targetDir — Project directory
 * @param {string} opts.sessionId — Unique session identifier
 * @param {boolean} [opts.streamOutput] — Pipe stdout/stderr to parent
 * @returns {Promise<{process: object}>}
 */
export async function spawnAgent(opts) {
  const { taskPrompt, taskFile, targetDir, streamOutput = true } = opts;

  if (!existsSync(taskFile)) {
    throw new Error(`Task file not found: ${taskFile}`);
  }

  // Claude Code invocation:
  // -p / --print: non-interactive mode (prints response and exits)
  // The task prompt is passed as an argument or via stdin
  // --dangerously-skip-permissions: allows file edits without interactive prompts
  const args = ['-p', '--dangerously-skip-permissions', taskPrompt];

  const proc = spawn('claude', args, {
    cwd: targetDir,
    stdio: streamOutput ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_TASK_FILE: taskFile },
  });

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: 'claude' command not found. Install Claude Code CLI first.\n`);
    }
  });

  return { process: proc };
}

/**
 * Detect completion status from a Claude Code process.
 * @param {object} proc
 * @returns {'success'|'failure'|'api-error'|'running'}
 */
export function detectCompletion(proc) {
  if (proc.exitCode === null && proc.signalCode === null) {
    return 'running';
  }
  return proc.exitCode === 0 ? 'success' : 'failure';
}

/**
 * Kill a Claude Code agent process.
 * @param {object} proc
 */
export function killAgent(proc) {
  try {
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL');
      }
    }, 5000);
  } catch {
    // Already exited
  }
}

/**
 * Check if Claude Code CLI is available on the system.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export default { spawnAgent, detectCompletion, killAgent, isAvailable };

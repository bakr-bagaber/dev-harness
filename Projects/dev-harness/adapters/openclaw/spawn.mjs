/**
 * OpenClaw spawn adapter — spawns OpenClaw agent per task with fresh session.
 *
 * OpenClaw is a TUI-based agentic coding tool. This adapter spawns it
 * as a CLI process per task, ensuring session isolation.
 *
 * Note: OpenClaw's exact CLI interface may need verification. This adapter
 * uses a reasonable default invocation pattern. If OpenClaw doesn't support
 * these flags, adjust the args array below.
 *
 * Usage:
 *   import { spawnAgent, detectCompletion } from './spawn.mjs';
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Spawn an OpenClaw agent to work on a task.
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

  // OpenClaw invocation — pipe the task prompt via stdin
  // OpenClaw reads AGENTS.md natively, so it will pick up harness conventions.
  // We pass the task prompt via stdin for maximum compatibility.
  const args = ['--non-interactive', '--exit-on-complete'];

  const proc = spawn('openclaw', args, {
    cwd: targetDir,
    stdio: streamOutput
      ? ['pipe', 'inherit', 'inherit']
      : ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, OPENCLAW_TASK_FILE: taskFile },
  });

  // Write task prompt to stdin
  if (proc.stdin) {
    proc.stdin.write(taskPrompt);
    proc.stdin.end();
  }

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: 'openclaw' command not found. Install OpenClaw CLI first.\n`);
    }
  });

  return { process: proc };
}

/**
 * Detect completion status from an OpenClaw process.
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
 * Kill an OpenClaw agent process.
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
 * Check if OpenClaw CLI is available on the system.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    execSync('which openclaw', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export default { spawnAgent, detectCompletion, killAgent, isAvailable };

/**
 * Hermes spawn adapter — spawns Hermes agent per task with fresh session.
 *
 * Each task gets a new Hermes process invocation, ensuring session isolation
 * (no continuous session across tasks — Ralph pattern requirement).
 *
 * Usage:
 *   import { spawnAgent, detectCompletion } from './spawn.mjs';
 *   const { process } = await spawnAgent({ taskFile, targetDir, ... });
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * Spawn a Hermes agent to work on a task.
 *
 * Hermes is invoked as a CLI tool. Each invocation starts a fresh session.
 * The task prompt is passed via the --task flag pointing to a file.
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
  const { taskFile, targetDir, streamOutput = true } = opts;

  // Verify task file exists
  if (!existsSync(taskFile)) {
    throw new Error(`Task file not found: ${taskFile}`);
  }

  // Build Hermes command
  // Hermes reads the task file and works on it in a fresh session.
  // The --task flag points to the file; --fresh-session ensures no state carryover.
  // --exit-on-complete makes Hermes exit when the task is done (non-interactive).
  const args = ['--task', taskFile, '--fresh-session', '--exit-on-complete'];

  // Spawn Hermes process
  const proc = spawn('hermes', args, {
    cwd: targetDir,
    stdio: streamOutput ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HERMES_TASK_FILE: taskFile },
  });

  // Handle spawn errors (e.g. hermes not installed)
  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      process.stderr.write(`Error: 'hermes' command not found. Install Hermes CLI first.\n`);
    }
  });

  return { process: proc };
}

/**
 * Detect completion status from a Hermes process.
 *
 * @param {object} proc — Child process
 * @returns {'success'|'failure'|'api-error'|'running'}
 */
export function detectCompletion(proc) {
  if (proc.exitCode === null && proc.signalCode === null) {
    return 'running';
  }
  if (proc.exitCode === 0) {
    return 'success';
  }
  // Check stderr for API error patterns
  // (supervisor.mjs handles this via isApiError, but adapter can refine)
  return 'failure';
}

/**
 * Kill a Hermes agent process.
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
 * Check if Hermes CLI is available on the system.
 * @returns {boolean}
 */
export function isAvailable() {
  try {
    execSync('which hermes', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export default { spawnAgent, detectCompletion, killAgent, isAvailable };

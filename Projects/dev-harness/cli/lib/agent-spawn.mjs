/**
 * agent-spawn — Agent process spawning interface.
 *
 * Provides a unified interface for spawning agentic coding tools (Hermes,
 * OpenClaw, Claude Code) as child processes. Each tool gets a fresh session
 * per task invocation — no continuous sessions.
 *
 * Usage:
 *   import { spawnAgent, detectCompletion, killAgent } from './agent-spawn.mjs';
 *   const { process, sessionId } = await spawnAgent({
 *     tool: 'hermes',
 *     taskPrompt: '...',
 *     targetDir: '/path/to/project',
 *   });
 */

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Spawn an agentic tool to work on a task.
 *
 * Writes the task prompt to harness/current-task.md, then spawns the
 * appropriate agent CLI with a fresh session.
 *
 * @param {object} opts
 * @param {string} opts.tool — Tool name (hermes, openclaw, claude-code)
 * @param {string} opts.taskPrompt — The task instructions for the agent
 * @param {string} opts.targetDir — Project directory
 * @param {object} [opts.adapter] — Tool-specific spawn adapter (from adapters/<tool>/spawn.mjs)
 * @param {boolean} [opts.streamOutput] — If true, pipe stdout/stderr to parent (default: true)
 * @returns {Promise<{process: object, sessionId: string, taskFile: string}>}
 */
export async function spawnAgent(opts) {
  const { tool, taskPrompt, targetDir, adapter, streamOutput = true } = opts;

  if (!adapter) {
    throw new Error(`No spawn adapter provided for tool "${tool}". Only Tier-1 tools (hermes, openclaw, claude-code) support spawning.`);
  }

  // Write task prompt to file for agent to read
  const taskFile = resolve(targetDir, 'harness', 'current-task.md');
  writeFileSync(taskFile, taskPrompt, 'utf-8');

  // Generate unique session ID for tracking
  const sessionId = `${tool}-${randomUUID().slice(0, 8)}`;

  // Delegate to tool-specific adapter
  const result = await adapter.spawnAgent({
    taskPrompt,
    taskFile,
    targetDir,
    sessionId,
    streamOutput,
  });

  return {
    process: result.process,
    sessionId,
    taskFile,
    pid: result.process.pid,
  };
}

/**
 * Detect completion status of a spawned agent process.
 *
 * @param {object} proc — The child process from spawnAgent
 * @param {object} adapter — Tool-specific adapter
 * @returns {'success'|'failure'|'api-error'|'running'}
 */
export function detectCompletion(proc, adapter) {
  if (proc.exitCode === null && proc.signalCode === null) {
    return 'running';
  }
  if (adapter.detectCompletion) {
    return adapter.detectCompletion(proc);
  }
  // Default: exit 0 = success, non-zero = failure
  return proc.exitCode === 0 ? 'success' : 'failure';
}

/**
 * Kill a spawned agent process gracefully.
 *
 * @param {object} proc — The child process
 * @param {object} [adapter] — Tool-specific adapter (for cleanup)
 */
export function killAgent(proc, adapter) {
  if (adapter && adapter.killAgent) {
    return adapter.killAgent(proc);
  }
  try {
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) {
        proc.kill('SIGKILL');
      }
    }, 5000);
  } catch {
    // Process may have already exited
  }
}

/**
 * Wait for a spawned agent to complete.
 *
 * @param {object} proc — The child process
 * @returns {Promise<{exitCode: number, signalCode: string|null, stdout: string, stderr: string}>}
 */
export function waitForCompletion(proc) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
    }

    proc.on('close', (code, signal) => {
      resolve({ exitCode: code, signalCode: signal, stdout, stderr });
    });
    proc.on('error', (err) => {
      resolve({ exitCode: -1, signalCode: null, stdout, stderr: stderr + err.message });
    });
  });
}

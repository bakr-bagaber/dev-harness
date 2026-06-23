/**
 * supervisor — Watchdog process for agent resilience.
 *
 * Monitors spawned agent processes, handles API downtime with exponential
 * backoff, and tracks heartbeats for stall detection.
 *
 * Usage:
 *   import { startSupervisor, recordHeartbeat, checkHeartbeat } from './supervisor.mjs';
 *   const result = await startSupervisor(targetDir, { agentTool: 'hermes', ... });
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, set as configSet, get as configGet } from './state.mjs';
import { spawnAgent, waitForCompletion, killAgent } from './agent-spawn.mjs';
import { buildCurrentTaskPrompt, writeTaskPrompt } from './task-prompt.mjs';
import { runPhase } from './ralph-inner.mjs';
import { continuePipeline } from './ralph-outer.mjs';
import { renderDashboard } from './dashboard.mjs';
import pRetry from 'p-retry';

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_API_RETRIES = 5;
const DEFAULT_BACKOFF_MS = 60000; // 60 seconds base
const HEARTBEAT_FILE = 'heartbeat.json';

// API error patterns (checked against agent stderr)
const API_ERROR_PATTERNS = [
  /connection refused/i,
  /timeout/i,
  /timed out/i,
  /rate.?limit/i,
  /too many requests/i,
  /503/i,
  /529/i,
  /overloaded/i,
  /api_error/i,
  /service unavailable/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /EPIPE/i,
];

// ── Heartbeat ────────────────────────────────────────────────────────────────

/**
 * Record a heartbeat timestamp.
 * @param {string} targetDir
 */
export function recordHeartbeat(targetDir) {
  const hbPath = resolve(targetDir, 'harness', HEARTBEAT_FILE);
  const data = {
    timestamp: new Date().toISOString(),
    pid: process.pid,
  };
  writeFileSync(hbPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

/**
 * Check heartbeat staleness.
 * @param {string} targetDir
 * @param {number} maxAgeMs — Max acceptable age in milliseconds
 * @returns {{ ok: boolean, age: number, timestamp: string|null }}
 */
export function checkHeartbeat(targetDir, maxAgeMs = 300000) {
  const hbPath = resolve(targetDir, 'harness', HEARTBEAT_FILE);
  if (!existsSync(hbPath)) {
    return { ok: false, age: Infinity, timestamp: null };
  }
  try {
    const data = JSON.parse(readFileSync(hbPath, 'utf-8'));
    const ts = new Date(data.timestamp).getTime();
    const age = Date.now() - ts;
    return { ok: age < maxAgeMs, age, timestamp: data.timestamp };
  } catch {
    return { ok: false, age: Infinity, timestamp: null };
  }
}

// ── API error detection ──────────────────────────────────────────────────────

/**
 * Check if an agent failure was due to API downtime.
 * @param {string} stderr — Agent stderr output
 * @param {number} exitCode — Agent exit code
 * @returns {boolean}
 */
export function isApiError(stderr, exitCode) {
  if (!stderr) { return false; }
  return API_ERROR_PATTERNS.some(pattern => pattern.test(stderr));
}

/**
 * Calculate exponential backoff delay.
 * @param {number} attempt — Current attempt number (1-based)
 * @param {number} baseMs — Base delay in milliseconds
 * @returns {number} — Delay in milliseconds
 */
export function getBackoffDelay(attempt, baseMs = DEFAULT_BACKOFF_MS) {
  // Exponential backoff: base * 2^(attempt-1), capped at 16x base
  const multiplier = Math.min(Math.pow(2, attempt - 1), 16);
  return baseMs * multiplier;
}

// ── Supervisor loop ──────────────────────────────────────────────────────────

/**
 * Start the supervisor loop — spawns agent per task, monitors, retries on failure.
 *
 * This is the main orchestrator loop for `dev-harness run`.
 *
 * @param {string} targetDir
 * @param {object} opts
 * @param {string} opts.agentTool — Tool name (hermes, openclaw, claude-code)
 * @param {object} opts.adapter — Tool spawn adapter
 * @param {boolean} [opts.json] — JSON output mode
 * @param {boolean} [opts.verbose] — Verbose output
 * @param {number} [opts.apiRetries] — Max API retry attempts (default 5)
 * @param {number} [opts.backoffMs] — Base backoff in ms (default 60000)
 * @param {function} [opts.onTransition] — Callback on phase/feature/task transition
 * @returns {Promise<object>} — Final pipeline result
 */
export async function startSupervisor(targetDir, opts) {
  const {
    agentTool,
    adapter,
    json = false,
    verbose = true,
    apiRetries = DEFAULT_API_RETRIES,
    backoffMs = DEFAULT_BACKOFF_MS,
    onTransition = null,
  } = opts;

  let apiRetryCount = 0;
  let pipelineComplete = false;

  while (!pipelineComplete) {
    // Check if pipeline is paused
    const { config } = loadConfig(targetDir);
    if (config.paused) {
      if (verbose && !json) {
        process.stdout.write('\n  ⏸ Pipeline is paused. Run: dev-harness resume\n');
      }
      return { status: 'paused', message: 'Pipeline paused by user or escalation' };
    }

    // Record heartbeat
    recordHeartbeat(targetDir);

    // Build task prompt for current state
    const { prompt, feature, task, phase } = buildCurrentTaskPrompt(targetDir);

    if (!phase) {
      return { status: 'error', message: 'No current phase in config' };
    }

    if (!prompt) {
      // No task to work on — phase may be complete, try advancing
      if (verbose && !json) {
        process.stdout.write('\n  ● No pending tasks. Checking if phase is complete...\n');
      }
      const advanceResult = await continuePipeline(targetDir, phase, { json, verbose });
      if (advanceResult.status === 'complete') {
        if (verbose && !json) {
          process.stdout.write('\n✓ Pipeline complete. All phases done.\n');
        }
        return { status: 'complete', message: 'Pipeline complete' };
      }
      if (advanceResult.status === 'instruction') {
        // Need to run the next phase
        continue;
      }
      return advanceResult;
    }

    // Render dashboard before spawning agent
    if (onTransition) { onTransition({ phase, feature, task }); }
    renderDashboard(targetDir, { json });

    if (verbose && !json) {
      process.stdout.write(`\n  ● Spawning ${agentTool} for task: ${task?.description || phase}\n`);
    }

    // Spawn agent
    let agentResult;
    try {
      const spawnResult = await spawnAgent({
        tool: agentTool,
        taskPrompt: prompt,
        targetDir,
        adapter,
        streamOutput: !json,
      });

      // Wait for agent to complete
      agentResult = await waitForCompletion(spawnResult.process);
    } catch (err) {
      if (verbose && !json) {
        process.stdout.write(`\n  ✗ Failed to spawn ${agentTool}: ${err.message}\n`);
      }
      return { status: 'error', message: `Spawn failed: ${err.message}` };
    }

    // Record heartbeat after agent completes
    recordHeartbeat(targetDir);

    // Check if agent succeeded
    if (agentResult.exitCode === 0) {
      // Success — reset API retry counter
      apiRetryCount = 0;

      if (verbose && !json) {
        process.stdout.write(`\n  ✓ ${agentTool} completed task successfully.\n`);
      }

      // Run validation
      // For feature-iterate phases with specific task, use per-task validation
      if (feature && task) {
        // The validate command handles task completion + advancement
        // We simulate calling validate by running the gate checks
        const { runChecks, areGatesEnabled } = await import('./gates.mjs');
        if (areGatesEnabled(targetDir)) {
          const gateResult = await runChecks(targetDir, phase, { feature: feature.id, task: task.id });
          if (gateResult.overall) {
            // Task passed — update feature list and advance
            // (This logic mirrors validate.mjs per-task success path)
            const { loadFeatureList, saveFeatureList } = await import('./ralph-inner.mjs');
            const fl = loadFeatureList(targetDir);
            const feat = fl.features.find(f => f.id === feature.id);
            const t = feat.tasks.find(tk => tk.id === task.id);
            if (t) {
              t.status = 'complete';
              if (feat.tasks.every(tk => tk.status === 'complete')) {
                feat.passes = true;
              }
              saveFeatureList(targetDir, fl);
            }
            configSet(targetDir, 'retryCount', 0);
            configSet(targetDir, 'taskRetryCount', 0);
            if (verbose && !json) {
              process.stdout.write(`\n  ✓ Task "${task.id}" validated. Advancing.\n`);
            }
          } else {
            // Task failed validation — increment task retry
            const currentTaskRetry = (configGet(targetDir, 'taskRetryCount') ?? 0) + 1;
            const maxRetries = config.maxRetries ?? 10;
            configSet(targetDir, 'taskRetryCount', currentTaskRetry);
            if (currentTaskRetry >= maxRetries) {
              if (verbose && !json) {
                process.stdout.write(`\n  ✗ Task retries exhausted (${currentTaskRetry}/${maxRetries}). Escalating.\n`);
              }
              configSet(targetDir, 'paused', true);
              return { status: 'escalated', message: `Task retries exhausted for ${task.id}` };
            }
            if (verbose && !json) {
              process.stdout.write(`\n  ↻ Task validation failed (${currentTaskRetry}/${maxRetries}). Retrying.\n`);
            }
            continue; // Retry same task
          }
        } else {
          // Gates disabled — just advance
          if (verbose && !json) {
            process.stdout.write('\n  ● Gates disabled. Advancing to next task.\n');
          }
        }
      } else {
        // Deliverable-retry phase — run full phase validation
        const { runChecks, areGatesEnabled } = await import('./gates.mjs');
        if (areGatesEnabled(targetDir)) {
          const gateResult = await runChecks(targetDir, phase);
          if (!gateResult.overall) {
            const currentRetry = (configGet(targetDir, 'retryCount') ?? 0) + 1;
            configSet(targetDir, 'retryCount', currentRetry);
            if (currentRetry >= (config.maxRetries ?? 10)) {
              configSet(targetDir, 'paused', true);
              return { status: 'escalated', message: `Phase retries exhausted for ${phase}` };
            }
            continue; // Retry
          }
        }
      }

      // Check if phase is complete, advance if so
      const advanceResult = await continuePipeline(targetDir, phase, { json, verbose });
      if (advanceResult.status === 'complete') {
        if (verbose && !json) {
          process.stdout.write('\n✓ Pipeline complete. All phases done.\n');
        }
        return { status: 'complete', message: 'Pipeline complete' };
      }
      // Continue to next task/phase
      continue;
    }

    // Agent failed — check if API error
    const apiError = isApiError(agentResult.stderr, agentResult.exitCode);

    if (apiError) {
      // Use p-retry for exponential backoff with the same semantics as the
      // previous hand-rolled loop: base delay doubles each attempt, capped
      // at 16x base, up to apiRetries attempts. On exhaustion, pause pipeline.
      try {
        await pRetry(
          async (attemptCount) => {
            if (verbose && !json) {
              const delay = getBackoffDelay(attemptCount, backoffMs);
              process.stdout.write(`\n  ⚠ ${agentTool} API error (attempt ${attemptCount}/${apiRetries}).\n`);
              process.stdout.write(`  Retrying in ${Math.round(delay / 1000)}s...\n`);
            }
            // Re-spawn the agent for the same task.
            const retrySpawn = await spawnAgent({
              tool: agentTool,
              taskPrompt: prompt,
              targetDir,
              adapter,
              streamOutput: !json,
            });
            const retryResult = await waitForCompletion(retrySpawn.process);
            if (retryResult.exitCode !== 0 && isApiError(retryResult.stderr, retryResult.exitCode)) {
              // Still an API error — p-retry will back off and retry.
              throw new Error(`API error on attempt ${attemptCount}`);
            }
            // Success or non-API failure — break out of p-retry by returning.
            // Replace agentResult so the outer loop processes the outcome.
            agentResult = retryResult;
          },
          {
            retries: apiRetries - 1, // p-retry counts the first try as 0
            minTimeout: backoffMs,
            maxTimeout: backoffMs * 16,
            factor: 2,
            shouldRetry: (err) => {
              // Only retry on API errors; stop on other failures.
              return err.message.startsWith('API error on attempt');
            },
          },
        );
        // p-retry succeeded — reset API retry counter and process result.
        apiRetryCount = 0;
        if (agentResult.exitCode === 0) {
          if (verbose && !json) {
            process.stdout.write(`\n  ✓ ${agentTool} recovered and completed task.\n`);
          }
        }
        // Loop back to process agentResult (success → validate, non-API fail → task retry)
        continue;
      } catch (retryErr) {
        // Retries exhausted — pause pipeline, notify human.
        if (verbose && !json) {
          process.stdout.write(`\n  ✗ API retries exhausted (${apiRetries}). Pausing pipeline.\n`);
          process.stdout.write(`  The ${agentTool} API appears to be down. Run: dev-harness resume when API recovers.\n`);
        }
        configSet(targetDir, 'paused', true);
        return {
          status: 'api-error',
          message: `API retries exhausted (${apiRetries}). Agent: ${agentTool}`,
          lastError: agentResult.stderr?.slice(-500),
        };
      }
    }

    // Non-API failure — treat as task failure
    if (verbose && !json) {
      process.stdout.write(`\n  ✗ ${agentTool} exited with code ${agentResult.exitCode}.\n`);
      if (agentResult.stderr) {
        process.stdout.write(`  Error: ${agentResult.stderr.slice(-300)}\n`);
      }
    }

    // Increment task retry for non-API failures
    if (feature && task) {
      const currentTaskRetry = (configGet(targetDir, 'taskRetryCount') ?? 0) + 1;
      const maxRetries = config.maxRetries ?? 10;
      configSet(targetDir, 'taskRetryCount', currentTaskRetry);
      if (currentTaskRetry >= maxRetries) {
        if (verbose && !json) {
          process.stdout.write(`\n  ✗ Task retries exhausted (${currentTaskRetry}/${maxRetries}). Escalating.\n`);
        }
        configSet(targetDir, 'paused', true);
        return { status: 'escalated', message: `Task retries exhausted for ${task.id}` };
      }
      if (verbose && !json) {
        process.stdout.write(`\n  ↻ Retrying task (${currentTaskRetry}/${maxRetries})...\n`);
      }
    } else {
      // Deliverable-retry phase
      const currentRetry = (configGet(targetDir, 'retryCount') ?? 0) + 1;
      configSet(targetDir, 'retryCount', currentRetry);
      if (currentRetry >= (config.maxRetries ?? 10)) {
        configSet(targetDir, 'paused', true);
        return { status: 'escalated', message: `Phase retries exhausted for ${phase}` };
      }
    }
    // Continue to retry
  }

  return { status: 'complete', message: 'Pipeline complete' };
}

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * run — Start the orchestrator (supervisor) for autonomous pipeline execution.
 *
 * Spawns the configured agentic tool per task, monitors for completion,
 * handles API downtime with exponential backoff, and auto-advances through
 * the pipeline. Renders a live dashboard showing progress.
 *
 * Usage:
 *   dev-harness run                          — use configured agentTool
 *   dev-harness run --agent-tool hermes      — override tool for this run
 *   dev-harness run --agent-tool claude-code
 *   dev-harness run --no-tui                 — disable TUI, use text output
 */

import { resolve } from 'node:path';
import { loadConfig } from '../lib/state.mjs';
import { startSupervisor } from '../lib/supervisor.mjs';
import { renderDashboard } from '../lib/dashboard.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';

// Tier-1 tools that support spawning (fresh session per task)
const SPAWNABLE_TOOLS = ['hermes', 'openclaw', 'claude-code'];

// Map tool names to their spawn adapter modules
const ADAPTER_LOADERS = {
  'hermes': () => import('../../adapters/hermes/spawn.mjs'),
  'openclaw': () => import('../../adapters/openclaw/spawn.mjs'),
  'claude-code': () => import('../../adapters/claude-code/spawn.mjs'),
};

export default async function runCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);
  const explicitTool = args.flags?.agentTool || args.flags?.['agent-tool'];

  // Load config to get configured tool
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    process.stderr.write('Error: No harness config found. Run: dev-harness init\n');
    process.exit(1);
    return;
  }

  // Determine which tool to use
  const tool = explicitTool || config.agentTool;
  if (!tool) {
    process.stderr.write('Error: No agent tool configured. Run: dev-harness init --agent-tool <tool>\n');
    process.stderr.write(`Or use: dev-harness run --agent-tool <tool>\n`);
    process.stderr.write(`Spawnable tools: ${SPAWNABLE_TOOLS.join(', ')}\n`);
    process.exit(1);
    return;
  }

  // Check if tool is spawnable (Tier-1)
  if (!SPAWNABLE_TOOLS.includes(tool)) {
    process.stdout.write(`\n  ⚠ Tool "${tool}" does not support autonomous spawning.\n`);
    process.stdout.write(`  Spawnable tools (Tier-1): ${SPAWNABLE_TOOLS.join(', ')}\n`);
    process.stdout.write(`  For IDE tools (Cursor, Copilot, etc.), use the manual workflow:\n`);
    process.stdout.write(`    1. dev-harness phase <name>\n`);
    process.stdout.write(`    2. [agent does the work]\n`);
    process.stdout.write(`    3. dev-harness validate\n`);
    process.stdout.write(`    4. Repeat\n`);
    process.exit(0);
    return;
  }

  // Load the tool's spawn adapter
  const loader = ADAPTER_LOADERS[tool];
  if (!loader) {
    process.stderr.write(`Error: No spawn adapter for tool "${tool}".\n`);
    process.exit(1);
    return;
  }

  const adapterMod = await loader();
  const adapter = adapterMod.default || adapterMod;

  // Check if tool is installed
  if (adapter.isAvailable && !adapter.isAvailable()) {
    process.stderr.write(`Error: '${tool}' command not found on PATH.\n`);
    process.stderr.write(`Install ${tool} CLI before running the orchestrator.\n`);
    process.exit(1);
    return;
  }

  // Check pipeline state
  if (!config.currentPhase) {
    process.stderr.write('Error: No current phase. Run: dev-harness phase define first.\n');
    process.exit(1);
    return;
  }

  if (config.paused) {
    process.stdout.write('\n  ⏸ Pipeline is paused. Run: dev-harness resume to continue.\n');
    process.exit(0);
    return;
  }

  // Render initial dashboard
  renderDashboard(targetDir, { json });

  if (!json) {
    process.stdout.write(`\n  🚀 Starting orchestrator with ${tool}...\n`);
    process.stdout.write(`  Press Ctrl+C to pause and exit safely.\n\n`);
  }

  // Set up graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) { return; }
    shuttingDown = true;
    if (!json) {
      process.stdout.write(`\n\n  ⏸ Received ${signal}. Pausing pipeline...\n`);
    }
    // Save state — pipeline will be paused
    const { set: configSet } = await import('../lib/state.mjs');
    configSet(targetDir, 'paused', true);
    if (!json) {
      process.stdout.write('  State saved. Run: dev-harness resume to continue.\n');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the supervisor loop
  const result = await startSupervisor(targetDir, {
    agentTool: tool,
    adapter,
    json,
    verbose: !json,
    apiRetries: config.supervisor?.apiRetries ?? 5,
    backoffMs: config.supervisor?.backoffMs ?? 60000,
    onTransition: () => {
      // Dashboard is rendered inside supervisor on each transition
    },
  });

  // Final output
  if (json) {
    process.stdout.write(JSON.stringify({
      command: 'run',
      status: result.status,
      message: result.message,
      tool,
      ...result,
    }) + '\n');
  } else {
    renderDashboard(targetDir);
    if (result.status === 'complete') {
      process.stdout.write('\n  ✅ Pipeline complete! All phases done.\n');
    } else if (result.status === 'paused') {
      process.stdout.write('\n  ⏸ Pipeline paused. Run: dev-harness resume to continue.\n');
    } else if (result.status === 'escalated') {
      process.stdout.write('\n  ⚠ Pipeline escalated to human. Fix the issue and run: dev-harness resume\n');
    } else if (result.status === 'api-error') {
      process.stdout.write('\n  ✗ Agent API appears to be down. Run: dev-harness resume when API recovers.\n');
    }
  }
}

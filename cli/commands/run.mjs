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
import { EXIT } from '../lib/errors.mjs';
import { loadConfig } from '../lib/state.mjs';
import { startSupervisor } from '../lib/supervisor.mjs';
import { renderDashboard } from '../lib/dashboard.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

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
    emitCmdError({ command: 'run', json, message: 'No harness config found. Run: dev-harness init' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Determine which tool to use
  const tool = explicitTool || config.agentTool;
  if (!tool) {
    emitCmdError({ command: 'run', json, message: `No agent tool configured. Run: dev-harness init --agent-tool <tool>\nOr use: dev-harness run --agent-tool <tool>\nSpawnable tools: ${SPAWNABLE_TOOLS.join(', ')}` });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Check if tool is spawnable (Tier-1)
  if (!SPAWNABLE_TOOLS.includes(tool)) {
    emitHuman(`\n  ⚠ Tool "${tool}" does not support autonomous spawning.\n`);
    emitHuman(`  Spawnable tools (Tier-1): ${SPAWNABLE_TOOLS.join(', ')}\n`);
    emitHuman(`  For IDE tools (Cursor, Copilot, etc.), use the manual workflow:\n`);
    emitHuman(`    1. dev-harness phase <name>\n`);
    emitHuman(`    2. [agent does the work]\n`);
    emitHuman(`    3. dev-harness validate\n`);
    emitHuman(`    4. Repeat\n`);
    process.exit(0);
    return;
  }

  // Load the tool's spawn adapter
  const loader = ADAPTER_LOADERS[tool];
  if (!loader) {
    emitCmdError({ command: 'run', json, message: `No spawn adapter for tool "${tool}".` });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  const adapterMod = await loader();
  const adapter = adapterMod.default || adapterMod;

  // Check if tool is installed
  if (adapter.isAvailable && !adapter.isAvailable()) {
    emitCmdError({ command: 'run', json, message: `'${tool}' command not found on PATH.\nInstall ${tool} CLI before running the orchestrator.` });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  // Check pipeline state
  if (!config.currentPhase) {
    emitCmdError({ command: 'run', json, message: 'No current phase. Run: dev-harness phase define first.' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  if (config.paused) {
    emitHuman('\n  ⏸ Pipeline is paused. Run: dev-harness resume to continue.\n');
    process.exit(0);
    return;
  }

  // Render initial dashboard
  renderDashboard(targetDir, { json });

  if (!json) {
    emitHuman(`\n  🚀 Starting orchestrator with ${tool}...\n`);
    emitHuman(`  Press Ctrl+C to pause and exit safely.\n\n`);
  }

  // Set up graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) { return; }
    shuttingDown = true;
    if (!json) {
      emitHuman(`\n\n  ⏸ Received ${signal}. Pausing pipeline...\n`);
    }
    // Save state — pipeline will be paused
    const { set: configSet } = await import('../lib/state.mjs');
    configSet(targetDir, 'paused', true);
    if (!json) {
      emitHuman('  State saved. Run: dev-harness resume to continue.\n');
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
    emitJson({
      command: 'run',
      status: result.status,
      message: result.message,
      tool,
      ...result,
    });
  } else {
    renderDashboard(targetDir);
    if (result.status === 'complete') {
      emitHuman('\n  ✓ Pipeline complete! All phases done.\n');
    } else if (result.status === 'paused') {
      emitHuman('\n  ⏸ Pipeline paused. Run: dev-harness resume to continue.\n');
    } else if (result.status === 'escalated') {
      emitHuman('\n  ⚠ Pipeline escalated to human. Fix the issue and run: dev-harness resume\n');
    } else if (result.status === 'api-error') {
      emitHuman('\n  ✗ Agent API appears to be down. Run: dev-harness resume when API recovers.\n');
    }
  }
}

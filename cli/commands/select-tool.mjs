/**
 * select-tool — Interactive backend tool selection wizard.
 *
 * Lists available Tier-1 agentic tools (Hermes, OpenClaw, Claude Code),
 * detects which are installed on the system, and lets the user choose.
 * Stores selection in config.agentTool.
 *
 * Usage:
 *   dev-harness select-tool              — interactive wizard
 *   dev-harness select-tool --list       — list available tools
 *   dev-harness select-tool hermes       — non-interactive selection
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import * as readline from 'node:readline';
import { EXIT } from '../lib/errors.mjs';
import { loadConfig, set as configSet } from '../lib/state.mjs';
import { TOOL_REGISTRY } from '../lib/tool-registry.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

// Tier-1 tools that support spawning (fresh session per task)
const TIER1_TOOLS = [
  {
    name: 'hermes',
    label: 'Hermes',
    description: 'TUI-based agentic coding platform with skill manifests',
    capabilities: ['session-isolation', 'api-retry', 'fresh-session'],
    command: 'hermes',
  },
  {
    name: 'openclaw',
    label: 'OpenClaw',
    description: 'TUI-based agentic tool, reads AGENTS.md natively',
    capabilities: ['session-isolation', 'api-retry'],
    command: 'openclaw',
  },
  {
    name: 'claude-code',
    label: 'Claude Code',
    description: 'Anthropic CLI agent with --print non-interactive mode',
    capabilities: ['session-isolation', 'api-retry', 'fresh-session'],
    command: 'claude',
  },
];

// Tier-2 tools (instruction-based, no spawning)
const TIER2_TOOLS = [
  { name: 'cursor', label: 'Cursor', description: 'IDE extension, reads .cursorrules' },
  { name: 'copilot', label: 'GitHub Copilot', description: 'IDE extension, reads .github/copilot-instructions.md' },
  { name: 'windsurf', label: 'Windsurf', description: 'IDE extension, reads .windsurfrules' },
  { name: 'gemini', label: 'Gemini CLI', description: 'Google CLI, reads GEMINI.md' },
  { name: 'cline', label: 'Cline', description: 'VS Code extension, reads .clinerules' },
  { name: 'roo', label: 'Roo Code', description: 'VS Code extension, reads .roorules' },
  { name: 'kilo-code', label: 'Kilo Code', description: 'VS Code extension, reads .kilocoderules' },
  { name: 'amazon-q', label: 'Amazon Q Developer', description: 'AWS CLI, reads .amazonq/rules.md' },
  { name: 'codex', label: 'Codex CLI', description: 'OpenAI CLI, reads AGENTS.md' },
  { name: 'aider', label: 'Aider', description: 'CLI tool, reads AGENTS.md' },
  { name: 'continue', label: 'Continue', description: 'IDE extension, reads AGENTS.md' },
  { name: 'opencode', label: 'OpenCode', description: 'CLI tool, reads AGENTS.md' },
];

/**
 * Check if a command is available on PATH.
 * @param {string} cmd
 * @returns {boolean}
 */
function isCommandAvailable(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Prompt user with yes/no or choice.
 * @param {string} question
 * @returns {Promise<string>}
 */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export default async function selectToolCommand(args) {
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
  const json = !!(args.json || args.flags?.json);
  const listOnly = args.flags?.list;
  const directSelection = args.subcommand || args.flags?.tool;

  // ── List mode ───────────────────────────────────────────────
  if (listOnly) {
    if (json) {
      const tools = [
        ...TIER1_TOOLS.map(t => ({
          ...t,
          tier: 1,
          installed: isCommandAvailable(t.command),
          spawnable: true,
        })),
        ...TIER2_TOOLS.map(t => ({
          ...t,
          tier: 2,
          installed: false,
          spawnable: false,
        })),
      ];
      emitJson({
        command: 'select-tool',
        status: 'ok',
        message: 'Available tools',
        tools,
      });
    } else {
      process.stdout.write('\n  📋 Available Agentic Tools\n\n');
      emitHuman('  Tier 1 — Deep Integration (spawnable, session isolation):\n');
      for (const tool of TIER1_TOOLS) {
        const installed = isCommandAvailable(tool.command);
        const icon = installed ? '✅' : '❌';
        const caps = tool.capabilities.map(c => {
          const labels = {
            'session-isolation': 'fresh-session',
            'api-retry': 'api-retry',
            'fresh-session': 'fresh-session',
          };
          return labels[c] || c;
        }).join(', ');
        emitHuman(`    ${icon} ${tool.label.padEnd(16)} ${tool.description}\n`);
        emitHuman(`        Capabilities: ${caps}\n`);
        emitHuman(`        Status: ${installed ? 'installed' : 'not installed'}\n\n`);
      }
      emitHuman('  Tier 2 — Instruction-Based (IDE extensions, no spawning):\n');
      for (const tool of TIER2_TOOLS) {
        emitHuman(`    ☐ ${tool.label.padEnd(16)} ${tool.description}\n`);
      }
      emitHuman('\n');
    }
    return;
  }

  // ── Direct selection (non-interactive) ──────────────────────
  if (directSelection) {
    const toolName = directSelection;
    const allTools = [...TIER1_TOOLS, ...TIER2_TOOLS];
    const found = allTools.find(t => t.name === toolName);
    if (!found) {
      emitCmdError({ command: 'select-tool', json, message: `Unknown tool "${toolName}".\nAvailable: ${allTools.map(t => t.name).join(', ')}` });
      process.exit(EXIT.VALIDATION_FAILURE);
    }

    configSet(targetDir, 'agentTool', toolName);
    if (json) {
      emitJson({
        command: 'select-tool',
        status: 'ok',
        message: `Agent tool set to "${toolName}"`,
        tool: toolName,
        tier: TIER1_TOOLS.some(t => t.name === toolName) ? 1 : 2,
      });
    } else {
      emitHuman(`\n  ✓ Agent tool set to "${toolName}"\n`);
      const isTier1 = TIER1_TOOLS.some(t => t.name === toolName);
      if (isTier1) {
        emitHuman(`  Tier 1 — supports autonomous spawning (dev-harness run)\n`);
      } else {
        emitHuman(`  Tier 2 — instruction-based (manual workflow)\n`);
      }
    }
    return;
  }

  // ── Interactive wizard ──────────────────────────────────────
  if (json) {
    emitCmdError({ command: 'select-tool', json, message: 'Interactive wizard not available in JSON mode. Use: dev-harness select-tool <tool-name>' });
    process.exit(EXIT.VALIDATION_FAILURE);
  }

  emitHuman('\n  🧰 Backend Tool Selection Wizard\n\n');
  emitHuman('  Tier 1 — Deep Integration (supports dev-harness run):\n\n');

  const tier1WithStatus = TIER1_TOOLS.map(t => ({
    ...t,
    installed: isCommandAvailable(t.command),
  }));

  for (let i = 0; i < tier1WithStatus.length; i++) {
    const tool = tier1WithStatus[i];
    const icon = tool.installed ? '✅' : '❌';
    emitHuman(`    [${i + 1}] ${icon} ${tool.label} — ${tool.description}\n`);
    emitHuman(`        Status: ${tool.installed ? 'installed ✅' : 'not installed ❌'}\n`);
  }

  emitHuman('\n  Tier 2 — Instruction-Based (IDE tools, manual workflow):\n');
  emitHuman('    (Use these if you prefer working inside an IDE)\n\n');
  for (let i = 0; i < TIER2_TOOLS.length; i++) {
    const tool = TIER2_TOOLS[i];
    emitHuman(`    [${tier1WithStatus.length + i + 1}] ☐ ${tool.label} — ${tool.description}\n`);
  }

  emitHuman('\n');

  // Prompt for selection
  const allTools = [...tier1WithStatus, ...TIER2_TOOLS];
  const answer = await prompt(`  Select a tool (1-${allTools.length}) or enter tool name: `);

  const idx = parseInt(answer, 10) - 1;
  let selected;
  if (idx >= 0 && idx < allTools.length) {
    selected = allTools[idx];
  } else {
    selected = allTools.find(t => t.name === answer || t.label.toLowerCase() === answer.toLowerCase());
  }

  if (!selected) {
    emitHuman('\n  ✗ Invalid selection. No changes made.\n');
    return;
  }

  // Store selection
  configSet(targetDir, 'agentTool', selected.name);

  emitHuman(`\n  ✓ Selected: ${selected.label}\n`);
  const isTier1 = TIER1_TOOLS.some(t => t.name === selected.name);
  if (isTier1) {
    emitHuman(`  Tier 1 — you can use: dev-harness run --agent-tool ${selected.name}\n`);
    if (!selected.installed) {
      emitHuman(`  ⚠ Note: '${selected.command}' not found on PATH. Install it before running.\n`);
    }
  } else {
    emitHuman(`  Tier 2 — use manual workflow: dev-harness phase <name> → validate → repeat\n`);
  }
  emitHuman('\n');
}

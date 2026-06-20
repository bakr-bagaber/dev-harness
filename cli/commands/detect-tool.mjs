/**
 * detect-tool — Detect which agent coding tools are configured in a project.
 *
 * Scans the project directory for tool-specific files:
 *   - CLAUDE.md       → claude-code
 *   - .cursorrules    → cursor
 *   - AGENTS.md       → generic (read by Codex, Aider, Continue, OpenCode)
 *   - .aider.conf*    → aider
 *   - continue.json   → continue
 *   - hermes/ skill   → hermes
 *
 * Also reads harness-config.json agentTool field if present.
 *
 * Usage:
 *   harness-dev detect-tool [--target <dir>] [--json]
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { emitJson, emitHuman } from '../lib/output.mjs';
import { loadConfig } from '../lib/state.mjs';
import { getAllDetectionSignatures, AGENTS_MD_TOOLS, TOOL_REGISTRY } from '../lib/tool-registry.mjs';
import { AGENTS_PATH } from '../lib/paths.mjs';

export default async function detectToolCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const detected = [];
  const hasAgentsMd = existsSync(AGENTS_PATH(targetDir));

  // 1. Scan for tool-specific detection files (from registry)
  for (const { tool, file } of getAllDetectionSignatures()) {
    if (existsSync(resolve(targetDir, file))) {
      if (!detected.includes(tool)) {
        detected.push(tool);
      }
    }
  }

  // 2. AGENTS.md present → tools that read it natively are "available"
  if (hasAgentsMd) {
    for (const tool of AGENTS_MD_TOOLS) {
      if (!detected.includes(tool)) {
        detected.push(tool);
      }
    }
  }

  // 3. Read config.agentTool if present
  const { config, ok } = loadConfig(targetDir);
  const configuredTool = ok && config.agentTool ? config.agentTool : null;

  // 4. Recommend: configured tool > first detected tool-specific > 'generic'
  let recommended = configuredTool;
  if (!recommended && detected.length > 0) {
    // Prefer tool-specific (has a file) over AGENTS.md-native
    const specific = detected.find(t => {
      const entry = TOOL_REGISTRY[t];
      return entry && entry.file !== null;
    });
    recommended = specific || detected[0];
  }
  if (!recommended) {
    recommended = 'generic';
  }

  // 5. Build per-tool details for richer output
  const toolDetails = detected.map(t => {
    const entry = TOOL_REGISTRY[t];
    return {
      tool: t,
      label: entry?.label || t,
      file: entry?.file || null,
      notes: entry?.notes || '',
    };
  });

  const result = {
    command: 'detect-tool',
    status: 'ok',
    message: detected.length > 0
      ? `Detected ${detected.length} agent tool(s): ${detected.join(', ')}`
      : 'No agent tools detected. Run: harness-dev init',
    available: detected,
    configured: configuredTool,
    recommended,
    hasAgentsMd,
    tools: toolDetails,
  };

  if (json) {
    emitJson(result);
    return;
  }

  emitHuman(`═══ Agent Tool Detection ═══\n\n`);
  if (detected.length > 0) {
    emitHuman(`Available tools:\n`);
    for (const t of toolDetails) {
      const marker = t.tool === recommended ? ' ← recommended' : '';
      const source = t.tool === configuredTool ? ' (from config)' : '';
      const fileInfo = t.file ? ` [${t.file}]` : ' [AGENTS.md]';
      emitHuman(`  • ${t.label}${source}${marker}${fileInfo}\n`);
    }
  } else {
    emitHuman(`  No agent tools detected.\n`);
    emitHuman(`  Run: harness-dev init to scaffold a project.\n`);
  }
  if (hasAgentsMd) {
    emitHuman(`\n  AGENTS.md present — tools that read it natively are available.\n`);
  }
  emitHuman(`\n  Recommended: ${TOOL_REGISTRY[recommended]?.label || recommended}\n`);
}

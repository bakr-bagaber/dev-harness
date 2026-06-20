# Tool Integration Guide

dev-harness is agent-agnostic by design. It works with any coding agent that
can read files and run shell commands. This guide covers integration with
specific tools.

## Quick Start

```bash
# Scaffold with a specific agent tool
harness-dev init --stack node --agent-tool claude-code --target my-project

# Or scaffold generically (AGENTS.md only — works with most tools)
harness-dev init --stack node --target my-project

# Detect which tools are configured in an existing project
harness-dev detect-tool --target my-project
```

## How It Works

The harness emits **generic phase instructions** via stdout. Any agent that
can read text output and run shell commands can follow them:

1. Agent reads `AGENTS.md` (or tool-specific file like `CLAUDE.md`)
2. User runs `harness-dev phase <name>` — CLI prints instructions for the agent
3. Agent does the work, then runs `harness-dev validate`
4. Gate passes → next phase; gate fails → agent retries with feedback

No tool-specific protocol is needed — the contract is text in, text out.

## Supported Tools (18 tools)

### Tools with a specific rules file (generated from AGENTS.md content)

| Tool | Flag | File | Notes |
|------|------|------|-------|
| **Claude Code** | `--agent-tool claude-code` | `CLAUDE.md` | Reads CLAUDE.md on startup |
| **Cursor** | `--agent-tool cursor` | `.cursorrules` | Loads as system context |
| **Windsurf** | `--agent-tool windsurf` | `.windsurfrules` | Codeium's rules file |
| **Gemini CLI** | `--agent-tool gemini` | `GEMINI.md` | Google Gemini CLI |
| **GitHub Copilot** | `--agent-tool copilot` | `.github/copilot-instructions.md` | Copilot instructions |
| **Cline** | `--agent-tool cline` | `.clinerules` | VS Code extension |
| **Roo Code** | `--agent-tool roo` | `.roorules` | Roo Code rules |
| **Kilo Code** | `--agent-tool kilo-code` | `.kilocoderules` | Kilo Code rules |
| **Amazon Q** | `--agent-tool amazon-q` | `.amazonq/rules.md` | Amazon Q Developer |

### Tools that read AGENTS.md natively (no extra file)

| Tool | Flag | Notes |
|------|------|-------|
| **Codex CLI** | `--agent-tool codex` | Reads AGENTS.md from project root |
| **OpenCode** | `--agent-tool opencode` | Reads AGENTS.md |
| **Continue** | `--agent-tool continue` | Reads AGENTS.md |
| **Aider** | `--agent-tool aider` | Auto-discovers AGENTS.md |
| **Generic** | (default, no flag) | AGENTS.md only — works with any tool |

### Tools with unconfirmed formats (assumed AGENTS.md)

| Tool | Flag | Notes |
|------|------|-------|
| **Antigravity 2** | `--agent-tool antigravity` | IDE/CLI/SDK — assumed AGENTS.md |
| **OpenClaw** | `--agent-tool openclaw` | Assumed AGENTS.md |
| **Pi** | `--agent-tool pi` | Assumed AGENTS.md |

### Special adapter

| Tool | Flag | Notes |
|------|------|-------|
| **Hermes** | `--agent-tool hermes` | Uses SKILL.md + wrapper scripts in `adapters/hermes/` |

### Per-tool examples

```bash
# Claude Code
harness-dev init --stack node --agent-tool claude-code --target my-project

# Cursor
harness-dev init --stack node --agent-tool cursor --target my-project

# Windsurf
harness-dev init --stack node --agent-tool windsurf --target my-project

# Gemini CLI
harness-dev init --stack node --agent-tool gemini --target my-project

# GitHub Copilot
harness-dev init --stack node --agent-tool copilot --target my-project

# Cline
harness-dev init --stack node --agent-tool cline --target my-project

# Codex (reads AGENTS.md natively)
harness-dev init --stack node --agent-tool codex --target my-project

# Generic (default — AGENTS.md only)
harness-dev init --stack node --target my-project
```

## Adapter Architecture

Each tool has an adapter directory under `adapters/`:

```
adapters/
├── hermes/              — SKILL.md + wrapper scripts + templates symlink
├── claude-code/         — CLAUDE.md.template + README
├── cursor/              — .cursorrules.template + README
├── codex/               — README (reads AGENTS.md natively)
└── generic/             — README (default, AGENTS.md only)
```

Adapters are **template files + documentation**, not plugins. The CLI core
stays tool-agnostic. `init --agent-tool <name>` renders the adapter template
with stack variables and writes it to the target project.

## Adding a New Tool

1. Add an entry to `TOOL_REGISTRY` in `cli/lib/tool-registry.mjs`:
   ```javascript
   'new-tool': {
     label: 'New Tool',
     file: '.newtoolrules',        // or null if it reads AGENTS.md
     header: '# New Tool rules\n', // optional prefix
     detectionFiles: ['.newtoolrules'],
     notes: 'New Tool reads .newtoolrules.',
   },
   ```
2. Add the tool name to the `agentTool` enum in `schema/harness-config.schema.json`
3. Create `adapters/<tool-name>/README.md` documenting the integration
4. If the tool has special needs (wrapper scripts, manifest), mark `special: true`
   and create the full adapter directory

That's it — `init --agent-tool new-tool` and `detect-tool` will work automatically.

## detect-tool Command

```bash
harness-dev detect-tool --target my-project --json
```

```json
{
  "command": "detect-tool",
  "status": "ok",
  "available": ["claude-code", "codex", "opencode", "aider", "continue"],
  "configured": "claude-code",
  "recommended": "claude-code",
  "hasAgentsMd": true
}
```

Scans for tool-specific files + reads `config.agentTool`. Useful for
understanding which tools will pick up the harness instructions in a
multi-tool project.

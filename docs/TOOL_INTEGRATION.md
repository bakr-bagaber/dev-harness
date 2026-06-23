# Tool Integration Guide

dev-harness is agent-agnostic by design. It works with any coding agent that
can read files and run shell commands. This guide covers integration with
specific tools.

## Quick Start

```bash
# Scaffold with a specific agent tool
dev-harness init --stack node --agent-tool claude-code --target my-project

# Or scaffold generically (AGENTS.md only — works with most tools)
dev-harness init --stack node --target my-project

# Detect which tools are configured in an existing project
dev-harness detect-tool --target my-project
```

## How It Works

dev-harness supports two integration models depending on tool type:

### Tier 1 — Orchestrator Mode (Spawnable Tools)

For CLI/TUI tools (Hermes, OpenClaw, Claude Code), dev-harness can **spawn the agent
per task** with a fresh session, monitor for completion, handle API downtime, and
auto-advance through the pipeline:

```bash
# Select your backend tool (interactive wizard)
dev-harness select-tool

# Start the orchestrator — spawns agent per task, live dashboard
dev-harness run --agent-tool hermes
```

Each task gets:
- **Fresh session** — no continuous session (Ralph pattern requirement)
- **Task prompt** — written to `harness/current-task.md`, passed to agent
- **Automatic validation** — gates run after agent exits
- **API resilience** — exponential backoff on API errors (60s, 120s, 240s...)
- **Live dashboard** — phases/features/tasks with checkmarks + agent output

### Tier 2 — Instruction Mode (IDE Tools)

For IDE extensions (Cursor, Copilot, Windsurf, etc.), dev-harness emits **generic
phase instructions** via stdout. The agent reads its config file and follows them:

1. Agent reads `AGENTS.md` (or tool-specific file like `CLAUDE.md`)
2. User runs `dev-harness phase <name>` — CLI prints instructions for the agent
3. Agent does the work, then runs `dev-harness validate`
4. Gate passes → next phase; gate fails → agent retries with feedback

No tool-specific protocol is needed — the contract is text in, text out.

## Supported Tools (18 tools)

### Tier 1 — Deep Integration (Spawnable, Orchestrator Mode)

These tools support `dev-harness run` for autonomous pipeline execution with
fresh sessions, API retry, and live dashboard.

| Tool | Flag | Spawn Command | Notes |
|------|------|---------------|-------|
| **Hermes** | `--agent-tool hermes` | `hermes --task <file> --fresh-session --exit-on-complete` | Full adapter with SKILL.md + spawn.mjs |
| **OpenClaw** | `--agent-tool openclaw` | `openclaw --non-interactive --exit-on-complete` | Reads AGENTS.md, task via stdin |
| **Claude Code** | `--agent-tool claude-code` | `claude -p --dangerously-skip-permissions <prompt>` | Non-interactive print mode |

### Tier 2 — Instruction-Based (IDE Tools, Manual Workflow)

#### Tools with a specific rules file (generated from AGENTS.md content)

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
| **Hermes** | `--agent-tool hermes` | Uses SKILL.md + wrapper scripts + spawn.mjs in `adapters/hermes/` |

### Per-tool examples

```bash
# Claude Code
dev-harness init --stack node --agent-tool claude-code --target my-project

# Cursor
dev-harness init --stack node --agent-tool cursor --target my-project

# Windsurf
dev-harness init --stack node --agent-tool windsurf --target my-project

# Gemini CLI
dev-harness init --stack node --agent-tool gemini --target my-project

# GitHub Copilot
dev-harness init --stack node --agent-tool copilot --target my-project

# Cline
dev-harness init --stack node --agent-tool cline --target my-project

# Codex (reads AGENTS.md natively)
dev-harness init --stack node --agent-tool codex --target my-project

# Generic (default — AGENTS.md only)
dev-harness init --stack node --target my-project
```

## Adapter Architecture

Each tool has an adapter directory under `adapters/`:

```
adapters/
├── hermes/              — SKILL.md + wrapper scripts + spawn.mjs + templates
├── openclaw/            — README + spawn.mjs (reads AGENTS.md natively)
├── claude-code/         — README + spawn.mjs (CLAUDE.md template)
├── cursor/              — .cursorrules.template + README
├── codex/               — README (reads AGENTS.md natively)
└── generic/             — README (default, AGENTS.md only)
```

**Tier-1 adapters** include a `spawn.mjs` module that implements the spawn interface:
- `spawnAgent({ taskPrompt, taskFile, targetDir })` — start a fresh agent process
- `detectCompletion(proc)` — return 'success' | 'failure' | 'api-error' | 'running'
- `killAgent(proc)` — gracefully terminate
- `isAvailable()` — check if tool CLI is installed

**Tier-2 adapters** are template files + documentation only. The CLI core
stays tool-agnostic. `init --agent-tool <name>` renders the adapter template
with stack variables and writes it to the target project.

## Orchestrator Mode (`dev-harness run`)

For Tier-1 tools, the orchestrator provides fully autonomous pipeline execution:

```bash
# Select tool first (stores in config.agentTool)
dev-harness select-tool hermes

# Start orchestrator — spawns Hermes per task, live TUI dashboard
dev-harness run

# Or override tool for this run only
dev-harness run --agent-tool claude-code
```

### What the Orchestrator Does

1. Reads current pipeline state (phase, feature, task)
2. Builds task prompt → writes to `harness/current-task.md`
3. Spawns agent with fresh session (per tool's spawn adapter)
4. Monitors process: success → validate; failure → retry; API error → backoff
5. On validation pass: marks task complete, advances to next task
6. On validation fail: increments `taskRetryCount`, retries (up to `maxRetries`)
7. Renders live dashboard on every transition
8. Graceful shutdown on Ctrl+C (pauses pipeline, saves state)

### API Downtime Resilience

When the agent's API goes down (connection refused, timeout, rate limit, 503):
- Exponential backoff: 60s → 120s → 240s → 480s → 960s
- Up to `supervisor.apiRetries` attempts (default 5)
- After exhaustion: pauses pipeline, notifies human
- Resume with `dev-harness resume` when API recovers

### Backend Tool Selection

```bash
# Interactive wizard — shows installed tools with capabilities
dev-harness select-tool

# List all tools
select-tool --list

# Direct selection
select-tool hermes
```

## Adding a New Tool

### Tier 2 (Instruction-Based)

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

### Tier 1 (Spawnable)

In addition to the Tier 2 steps:

5. Create `adapters/<tool-name>/spawn.mjs` implementing the spawn interface:
   ```javascript
   export async function spawnAgent({ taskPrompt, taskFile, targetDir, streamOutput }) {
     // Spawn the tool's CLI with a fresh session
     // Return { process }
   }
   export function detectCompletion(proc) { ... }
   export function killAgent(proc) { ... }
   export function isAvailable() { ... }
   ```
6. Add the tool to `SPAWNABLE_TOOLS` and `ADAPTER_LOADERS` in `cli/commands/run.mjs`
7. Add the tool to `TIER1_TOOLS` in `cli/commands/select-tool.mjs`

That's it — `init --agent-tool new-tool`, `select-tool`, and `run` will work automatically.

## detect-tool Command

```bash
dev-harness detect-tool --target my-project --json
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

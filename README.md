# Dev Harness

**Agent-agnostic development pipeline CLI.** Scaffold, phase orchestrate, gate validate, and iterate any software project — works with any coding agent (Claude Code, Codex, OpenCode, Cursor, etc.).

```bash
npx dev-harness-cli init --stack python --target my-project
cd my-project
npx dev-harness-cli phase define
```

## Install

```bash
# Quick start (no install)
npx github:bakr-bagaber/dev-harness --help

# Global install from GitHub
npm install -g https://github.com/bakr-bagaber/dev-harness.git
harness-dev --help

# Or clone and install
git clone https://github.com/bakr-bagaber/dev-harness.git
cd dev-harness && npm install -g .
```

Requires **Node.js >= 18**.

## Quick Start

```bash
# Scaffold a new project
harness-dev init --stack python --target my-app

# Check status
cd my-app
harness-dev status

# Start the DEFINE phase
harness-dev phase define
```

## Supported Stacks

| Stack | Detection | Config File |
|-------|-----------|-------------|
| Python | `pyproject.toml`, `setup.py`, `*.py` | `pyproject.toml` |
| Java | `pom.xml`, `build.gradle`, `*.java` | `pom.xml` |
| Kotlin | `build.gradle.kts`, `*.kt` | `build.gradle.kts` |
| Node.js | `package.json`, `*.js`, `*.ts` | `package.json` |
| Go | `go.mod`, `*.go` | `go.mod` |
| Rust | `Cargo.toml`, `*.rs` | `Cargo.toml` |
| C | `*.c` | `CMakeLists.txt` |
| C++ | `*.cpp`, `*.hpp` | `CMakeLists.txt` |
| .NET | `*.cs`, `*.fs` | `global.json` |
| MATLAB | `*.m` | (none) |
| VHDL | `*.vhdl`, `*.vhd` | (none) |
| Verilog | `*.v`, `*.sv` | (none) |
| Generic | fallback | (none) |

## Commands

| Command | Description |
|---------|-------------|
| `init` | Scaffold project (21 files) |
| `status` | Show current state |
| `phase <name>` | Invoke a phase |
| `validate` | Run gate checks |
| `config get/set` | Read/write config |
| `learn <msg>` | Save a lesson |
| `set-mode` | copilot / autopilot |
| `pause` / `resume` | Control autopilot |
| `contract propose/review/status/escalate` | Sprint contract negotiation |
| `worktree create/list/prune/remove` | Git worktree management |
| `checkpoint create <label>` | Git tag checkpoint |
| `rollback list/to/branch` | Rollback to checkpoint |

## Phase Pipeline

```
INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP
```

Two loop modes:
- **Copilot** (default): one phase at a time, human decides when to advance
- **Autopilot**: auto-advances through pipeline after each gate passes

## Output Contracts

All commands produce machine-parseable JSON with `--json`:

```json
{"command":"status","status":"ok","message":"Phase: define, Stack: Node.js",
 "currentPhase":"define","mode":"copilot","recentLessons":[]}
```

Errors go to stderr: `{"error":"CliError","message":"...","exitCode":N}`

Exit codes: `0` success, `1` validation failure, `2` usage error, `3` internal error

## Architecture

```
cli/
├── harness-dev.mjs        — Entry point + command router
├── lib/
│   ├── args.mjs           — Argument parser
│   ├── errors.mjs         — Error handling + exit codes
│   ├── help.mjs           — Help text + per-command help
│   ├── detect-stack.mjs   — 13-stack detection engine
│   ├── vars.mjs           — Stack variable resolution
│   ├── templates.mjs      — Template engine ({{VAR}} substitution)
│   ├── state.mjs          — Config I/O + phase transitions
│   ├── phases.mjs         — Pure phase pipeline logic
│   ├── progress.mjs       — progress.md reader/writer
│   ├── gates.mjs          — Phase gate validation
│   ├── ralph-inner.mjs    — Inner loop engine
│   ├── ralph-outer.mjs    — Outer loop engine
│   ├── ralph-output.mjs   — Phase instruction text builders
│   ├── modes.mjs          — Copilot/autopilot modes
│   ├── contract.mjs       — Sprint contract negotiation
│   ├── git.mjs            — Centralized git operations
│   ├── paths.mjs          — Centralized path resolution
│   ├── file-io.mjs        — JSON/text I/O helpers
│   ├── output.mjs         — JSON/human output helpers
│   ├── command-helpers.mjs— Shared arg parsing + phaseLabel
│   ├── constants.mjs      — Centralized magic numbers
│   ├── scaffold.mjs       — Stack-specific scaffolding assets
│   ├── validate-schema.mjs— Minimal JSON-schema validator
│   └── schemas/
│       └── stacks.json    — 13-stack metadata (CLI-internal)
├── commands/              — 13 command handlers
│   ├── init.mjs, status.mjs, phase.mjs, validate.mjs, config.mjs
│   ├── learn.mjs, set-mode.mjs, pause.mjs, resume.mjs
│   └── contract.mjs, worktree.mjs, rollback.mjs, checkpoint.mjs
templates/                  — Scaffold templates (AGENTS.md, init.sh, ci/, docs/, etc.)
schema/                     — Published JSON schemas (harness-config, feature-list)
test/                       — Test suites (test-t*.mjs + run-all.mjs)
dist/install.sh             — One-liner installation script (curl-pipe-bash)
adapters/                  — Tool adapters (claude-code, cursor, codex, hermes, generic)
docs/                      — TOOL_INTEGRATION.md (per-tool setup guides)
references/                 — Historical audit reports
history/                    — Project audit log, changelog, decisions, issues
docs-site-templates/        — Docusaurus/Sphinx scaffolds (experimental)
```

## Agent Integration

harness-dev works with any coding agent via stdout JSON contracts and AGENTS.md project conventions. Use `--agent-tool` at scaffold time to generate tool-specific files, or `detect-tool` to discover which tools are configured.

```bash
# Scaffold with a specific tool
harness-dev init --stack node --agent-tool claude-code --target my-project

# Or scaffold generically (AGENTS.md only — works with most tools)
harness-dev init --stack node --target my-project

# Detect which tools are configured
harness-dev detect-tool --target my-project
```

**Supported tools:** `claude-code` (CLAUDE.md), `cursor` (.cursorrules), `codex`, `aider`, `continue`, `opencode` (all read AGENTS.md), `hermes` (SKILL.md), `generic` (default).

See [docs/TOOL_INTEGRATION.md](docs/TOOL_INTEGRATION.md) for per-tool setup guides and the adapter architecture.

### Claude Code

```bash
harness-dev init --stack node --agent-tool claude-code --target my-project
cd my-project
# Claude reads CLAUDE.md automatically
harness-dev phase build
# Claude follows the phase instructions, runs:
harness-dev validate
```

### Codex CLI

```bash
harness-dev init --stack go --agent-tool codex --target my-project
cd my-project
# Codex reads AGENTS.md from project root
harness-dev status --json
# → Machine-readable state for agent decision-making
```

### Cursor

```bash
harness-dev init --stack rust --agent-tool cursor --target my-project
cd my-project
# .cursorrules generated with harness conventions
harness-dev phase build
```

### Generic Agent Workflow

```bash
harness-dev phase build
# → Prints task instructions for agent
# → Agent reads AGENTS.md + progress.md + sprint-contract.md
# → Agent implements → calls `harness-dev validate`
# → Gate passes → `harness-dev phase verify`
```

## API Reference

### JSON Output Contract (all commands)

```json
{
  "command": "<command_name>",
  "status": "ok" | "not_implemented" | "error",
  "message": "Human-readable status or error detail"
}
```

Additional command-specific fields are included (e.g. `currentPhase`, `stack`, `mode`).

### Error Contract

```json
{
  "error": "CliError",
  "message": "Description of the problem",
  "exitCode": 1
}
```

Errors always go to **stderr** so stdout stays parseable.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Validation failure |
| 2 | Usage error |
| 3 | Internal error |

### All Commands

| Command | JSON Fields | Description |
|---------|-------------|-------------|
| `init` | `project`, `stack`, `filesCreated` | Scaffold harness project |
| `status` | `currentPhase`, `mode`, `stack`, `gateStatus`, `checksPassing`, `checksTotal`, `recentLessons`, `nextAction` | Show current state |
| `phase <name>` | `phase`, `previousPhase`, `gateResult`, `iteration` | Invoke a phase |
| `validate` | `phase`, `checks[]`, `overall`, `failures[]` | Run gate checks |
| `config get <key>` | `key`, `value` | Read config value |
| `config set <key> <value>` | `key`, `previous`, `current` | Write config value |
| `learn <msg>` | `lesson` | Append a lesson |
| `set-mode copilot\|autopilot` | `previous`, `current` | Switch mode |
| `pause` / `resume` | `paused` | Control autopilot |
| `contract propose\|review\|status\|escalate` | `status`, `agreed`, `round`, `pinned` | Sprint contract |
| `worktree create\|list\|prune\|remove` | `worktrees[]`, `action`, `name` | Git worktree |
| `checkpoint create <label>` | `tag`, `commit` | Git checkpoint |
| `rollback list\|to\|branch` | `checkpoints[]`, `restored` | Rollback |

## Project Structure

```
cli/                        — CLI source
├── harness-dev.mjs         — Entry point + command router
├── lib/                    — Core libraries
│   ├── git.mjs             — Centralized git operations
│   ├── state.mjs           — Config I/O + phase transitions (re-exports phases.mjs)
│   ├── phases.mjs          — Pure phase pipeline logic
│   ├── ralph-inner.mjs     — Inner loop (work → validate → retry)
│   ├── ralph-outer.mjs     — Outer loop (phase auto-advance)
│   ├── ralph-output.mjs    — Phase instruction text builders
│   ├── gates.mjs           — Phase gate validation
│   ├── contract.mjs        — Sprint contract negotiation
│   ├── paths.mjs           — Centralized path resolution
│   ├── file-io.mjs         — JSON/text I/O helpers
│   ├── output.mjs          — JSON/human output helpers
│   ├── command-helpers.mjs — Shared arg parsing + phaseLabel
│   ├── constants.mjs       — Centralized magic numbers
│   ├── scaffold.mjs        — Stack-specific scaffolding assets
│   ├── templates.mjs       — Template engine
│   ├── detect-stack.mjs    — Stack detection
│   ├── validate-schema.mjs — Minimal JSON-schema validator
│   └── schemas/stacks.json — Stack metadata (CLI-internal)
├── commands/               — Command handlers (13 commands)
templates/                  — Scaffold templates (AGENTS.md, init.sh, ci/, docs/, etc.)
schema/                     — Published JSON schemas (harness-config, feature-list)
test/                       — Test suites (test-t*.mjs + run-all.mjs)
dist/install.sh             — One-liner install script
adapters/                  — Tool adapters (claude-code, cursor, codex, hermes, generic)
docs/                      — TOOL_INTEGRATION.md (per-tool setup guides)
references/                 — Historical audit reports (T5-T14)
history/                    — Project audit log, changelog, decisions, issues
docs-site-templates/        — Docusaurus/Sphinx scaffolds (experimental, T25)
PROJECT_PLAN.md             — Full task breakdown (T1-T20)
SPEC.md                     — Original architecture specification
dev-harness.md              — Internal project note (Obsidian)
```

## License

MIT

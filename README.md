<div align="center">

# Dev Harness

### Agent-agnostic development pipeline CLI

Scaffold · Phase orchestration · Gate validation · Iteration

[![npm version](https://img.shields.io/npm/v/dev-harness-cli.svg)](https://www.npmjs.com/package/dev-harness-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-blue.svg)](#)

**Works with any coding agent:** Claude Code · Codex · Cursor · Aider · Continue · OpenCode · Windsurf · Gemini · GitHub Copilot · Cline · Roo · Kilo Code · Amazon Q · and more

</div>

---

## What is this?

**Dev Harness** is a CLI tool that brings structure to AI-assisted software development. Instead of ad-hoc prompting, it enforces a **phase pipeline** with **gate validation** — ensuring specs are written before code, code is reviewed before shipping, and nothing gets skipped.

```
define → plan → build → verify → [simplify] → review → ship
```

Each phase has **deterministic gates** (checks) that must pass before advancing. The agent does the work; harness validates the result.

## Install

```bash
# Quick start (no install)
npx dev-harness-cli init --stack python --target my-project

# Global install
npm install -g dev-harness-cli
harness-dev --help
```

Requires **Node.js >= 18**. Zero runtime dependencies.

## Quick Start

```bash
# 1. Scaffold a new project
harness-dev init --stack node --target my-app
cd my-app

# 2. Check status
harness-dev status

# 3. Run the DEFINE phase (agent writes specs)
harness-dev phase define

# 4. Validate (run gate checks)
harness-dev validate

# 5. Continue through pipeline
harness-dev phase plan
harness-dev phase build
harness-dev phase verify
harness-dev phase review
harness-dev phase ship
```

## Project Structure

When you run `harness-dev init`, all harness-managed files go into a `harness/` subfolder — keeping your project root clean:

```
my-project/
├── AGENTS.md                 # Agent instructions (root — tools expect it here)
├── .gitignore                # Git ignore rules
├── package.json              # Your project's package file
├── src/                      # Your source code
├── tests/                    # Your tests
└── harness/                  # All harness-managed files
    ├── config.json           # Harness configuration + state
    ├── progress.md           # Session state + lessons learned
    ├── sprint-contract.md    # Pre-build agreement
    ├── evaluator-rubric.md   # Quality scorecard
    ├── session-handoff.md    # Context for session transitions
    ├── clean-state-checklist.md
    ├── features/
    │   ├── feature-list.json       # Feature tracking
    │   └── feature-list.schema.json
    ├── docs/
    │   ├── ARCHITECTURE.md         # Architecture decisions
    │   ├── CONSTRAINTS.md          # Technical constraints
    │   ├── DECISIONS.md            # Decision log
    │   ├── api-patterns.md         # API conventions
    │   ├── agents/                 # Agent role guides
    │   │   ├── planner.md
    │   │   ├── generator.md
    │   │   ├── evaluator.md
    │   │   └── simplifier.md
    │   └── phases/                 # Phase instructions
    │       ├── define.md
    │       ├── plan.md
    │       ├── build.md
    │       ├── verify.md
    │       ├── simplify.md
    │       ├── review.md
    │       └── ship.md
    ├── ci/
    │   ├── github-actions.yml
    │   └── gitlab-ci.yml
    └── scripts/
        ├── init.sh
        └── init.ps1
```

## Supported Stacks

31 built-in stacks + custom stack support:

| Stack | Detection Files | Config File |
|-------|----------------|-------------|
| Node.js | `package.json`, `*.js`, `*.ts` | `package.json` |
| Python | `pyproject.toml`, `setup.py`, `*.py` | `pyproject.toml` |
| Rust | `Cargo.toml`, `*.rs` | `Cargo.toml` |
| Go | `go.mod`, `*.go` | `go.mod` |
| Java | `pom.xml`, `build.gradle`, `*.java` | `pom.xml` |
| C/C++ | `*.c`, `*.cpp`, `*.hpp` | `CMakeLists.txt` |
| .NET | `*.cs`, `*.fs` | `global.json` |
| Ruby | `Gemfile`, `*.rb` | `Gemfile` |
| PHP | `composer.json`, `*.php` | `composer.json` |
| Swift | `Package.swift`, `*.swift` | `Package.swift` |
| + 21 more | | |

**Custom stacks:** Pass any name to `--stack` and fill `stackMeta` in `harness/config.json` during DEFINE phase.

## Commands

| Command | Description |
|---------|-------------|
| `init` | Scaffold a new project with harness structure |
| `status` | Show current phase, stack, features, gates |
| `phase <name>` | Invoke a pipeline phase |
| `validate` | Run gate checks for current phase |
| `config list` | List all 29 configurable parameters |
| `config get <key>` | Get a config value |
| `config set <key> <value>` | Set a config value |
| `set-mode <copilot\|autopilot>` | Switch execution mode |
| `pause` / `resume` | Pause/resume autopilot |
| `contract propose/review/status/escalate` | Sprint contract negotiation |
| `learn <message>` | Save a lesson to progress.md |
| `checkpoint create <label>` | Create a manual checkpoint |
| `rollback list/to/branch` | Restore to checkpoint |
| `worktree create/list/remove` | Git worktree management |
| `detect-tool` | Detect available agent tools |

## Agent Tool Integration

Harness works with any coding agent. Use `--agent-tool` during init to generate tool-specific files:

```bash
# Claude Code → generates CLAUDE.md
harness-dev init --stack node --agent-tool claude-code --target my-app

# Cursor → generates .cursorrules
harness-dev init --stack node --agent-tool cursor --target my-app

# GitHub Copilot → generates .github/copilot-instructions.md
harness-dev init --stack node --agent-tool copilot --target my-app
```

**18 supported tools:** claude-code, cursor, windsurf, gemini, copilot, cline, roo, kilo-code, amazon-q, codex, opencode, continue, aider, antigravity, openclaw, pi, hermes, generic.

See [docs/TOOL_INTEGRATION.md](docs/TOOL_INTEGRATION.md) for per-tool setup guides.

## Gates

Gates are deterministic checks that must pass before advancing to the next phase. Enable with:

```bash
harness-dev config set gates.enabled true
```

| Phase | Gates |
|-------|-------|
| DEFINE | feature-branch, contract-agreed |
| PLAN | git-clean |
| BUILD | (coverage if enabled) |
| VERIFY | (coverage if enabled) |
| SIMPLIFY | git-clean, no-empty-dirs |
| REVIEW | branch-up-to-date, rubric-exists, readme-exists, architecture-doc, decisions-logged |
| SHIP | git-clean, tagged, changelog, readme-exists, license-exists, changelog-content, contributing-exists, no-empty-dirs |

## Configuration

All configuration lives in `harness/config.json`. View with:

```bash
harness-dev config list
```

29 parameters across 8 groups: Execution, Stack, Agent Tool, Gates, Git, Phases, Agent Tones, Runtime State.

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for full reference.

## JSON Output

All commands support `--json` for machine-parseable output:

```bash
harness-dev status --json
harness-dev phase define --json
harness-dev validate --json
```

```json
{
  "command": "status",
  "status": "ok",
  "currentPhase": "define",
  "stack": "node",
  "mode": "copilot"
}
```

Errors go to stderr. Exit codes: `0` success, `1` validation, `2` usage, `3` internal.

## License

MIT

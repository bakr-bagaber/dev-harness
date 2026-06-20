---
name: "dev-harness"
description: "Hermes adapter for the dev-harness CLI — phase-based development pipeline with scaffold, stack detection, gate validation, inner/outer loops, sprint contracts, git worktree management, and rollback/checkpoint. Load this skill when working inside a harness-scaffolded project."
license: MIT
category: software-development
risk: high
source: self
date_added: "2026-06-20"
metadata:
  version: 1.1.0
  paradigm: "Phase-based agentic development pipeline"
  changelog:
    - "1.1.0 — Moved to adapters/hermes/ (tool-agnostic adapter structure)."
    - "1.0.0 — Hermes skill wrapper for dev-harness CLI. Wraps init, phase, and validate commands."
---

# Dev Harness — Hermes Skill Wrapper

Triggers on: "harness-dev", "harness init", "harness scaffold", "new project", "phase pipeline"

## Prerequisites

- Node.js >= 18
- `harness-dev` CLI accessible via `node cli/harness-dev.mjs` from the project root
- A git repository (for worktree, rollback, and checkpoint commands)

## Actions

### `harness-dev init [--stack <name>] [--target <dir>] [--force]`

Scaffold harness in current project. If stack not specified, auto-detects from target directory.

```bash
node cli/harness-dev.mjs init --stack python --target my-project
```

### `harness-dev status [--json] [--target <dir>]`

Show current project state — phase, mode, gate status, recent lessons.

### `harness-dev phase <name>`

Run a phase: `define` → `plan` → `build` → `verify` → `simplify` → `review` → `ship`

### `harness-dev validate [--json] [--phase <name>] [--feature <id>] [--task <id>]`

Run gate checks for current or specified phase.

### `harness-dev set-mode copilot|autopilot`

Switch between one-phase-at-a-time (copilot) and auto-advance (autopilot).

### `harness-dev learn <message>`

Append a lesson to progress.md.

### `harness-dev config get <key>` / `harness-dev config set <key> <value>`

Read/write harness-config.json via dot-notation.

### `harness-dev contract propose|review|status|escalate`

Sprint contract negotiation workflow.

### `harness-dev worktree create|list|prune|remove <name>`

Git worktree management with harness scaffold.

### `harness-dev rollback list|to|branch`

Checkpoint recovery with tag-based state restoration.

### `harness-dev checkpoint create <label>`

Manual checkpoint tagging.

## Scripts

Thin wrapper scripts are provided under `scripts/` that resolve the CLI relative to the project root:

- `scripts/init.mjs` — wrapper for `harness-dev init`
- `scripts/phase.mjs` — wrapper for `harness-dev phase`
- `scripts/validate.mjs` — wrapper for `harness-dev validate`

Use these when you want to invoke harness commands from other Hermes skill scripts or automation.

## Templates

The `templates/` directory is a symlink to `../../../templates` (the project's main templates directory). Template files use `{{VAR}}` substitution for stack-aware scaffolding.

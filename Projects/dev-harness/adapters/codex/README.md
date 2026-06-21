# Codex CLI Adapter

Codex CLI reads `AGENTS.md` from the project root natively — no tool-specific
file is needed. When you scaffold with `harness-dev init --agent-tool codex`,
the harness sets `agentTool: "codex"` in config but does not generate any
extra files (AGENTS.md is already the canonical entry point).

## Usage

```bash
# Scaffold with Codex adapter
harness-dev init --stack node --agent-tool codex --target my-project
cd my-project

# Codex reads AGENTS.md automatically
codex
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated; Codex reads this)
- `harness-config.json` — with `agentTool: "codex"`

## How It Works

Codex CLI reads `AGENTS.md` on startup. The generated `AGENTS.md` includes
the harness quick-start, phase pipeline, agent roles, and commands. Codex
then follows the phase instructions emitted by `harness-dev phase <name>`
and runs `harness-dev validate` after each phase.

No `.codexrules` or similar file is needed — AGENTS.md is the standard.

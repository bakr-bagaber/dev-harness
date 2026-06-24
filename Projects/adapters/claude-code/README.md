# Claude Code Adapter

Claude Code reads `AGENTS.md` from the project root automatically. When you
scaffold with `harness-dev init --agent-tool claude-code`, the harness generates
a `CLAUDE.md` that points Claude at the harness conventions.

## Usage

```bash
# Scaffold with Claude Code adapter
harness-dev init --stack node --agent-tool claude-code --target my-project
cd my-project

# Claude Code picks up CLAUDE.md automatically
claude
```

## Files Generated

- `CLAUDE.md` — Claude-specific entry point (references AGENTS.md)
- `AGENTS.md` — canonical harness conventions (always generated)
- `harness-config.json` — with `agentTool: "claude-code"`

## Files in Adapter Directory

- `spawn.mjs` — **Tier-1 spawn adapter** for orchestrator mode (`dev-harness run`).
  Spawns Claude Code per task with `claude -p --dangerously-skip-permissions <prompt>`
  for non-interactive execution with session isolation.

## How It Works

### Manual Mode (Tier 2)
Claude Code reads `CLAUDE.md` on startup. The generated `CLAUDE.md` includes
the harness quick-start, phase pipeline, and commands — same content as
`AGENTS.md` but in the file Claude looks for. Claude then follows the phase
instructions emitted by `harness-dev phase <name>` and runs
`harness-dev validate` after each phase.

### Orchestrator Mode (Tier 1)
Use `dev-harness run --agent-tool claude-code` to start the orchestrator. The
supervisor spawns Claude Code per task via `spawn.mjs` in non-interactive print
mode, monitors for completion, handles API downtime with exponential backoff,
and auto-advances through the pipeline with a live dashboard.

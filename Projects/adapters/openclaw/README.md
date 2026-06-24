# OpenClaw Adapter

OpenClaw — assumed to read AGENTS.md.

## Usage

```bash
harness-dev init --stack node --agent-tool openclaw --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `harness-config.json` — with `agentTool: "openclaw"`

## Files in Adapter Directory

- `spawn.mjs` — **Tier-1 spawn adapter** for orchestrator mode (`dev-harness run`).
  Spawns OpenClaw per task with `--non-interactive --exit-on-complete` and passes
  the task prompt via stdin for session isolation.

## How It Works

### Manual Mode (Tier 2)
The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. AGENTS.md) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

### Orchestrator Mode (Tier 1)
Use `dev-harness run --agent-tool openclaw` to start the orchestrator. The
supervisor spawns OpenClaw per task via `spawn.mjs`, monitors for completion,
handles API downtime, and auto-advances with a live dashboard.

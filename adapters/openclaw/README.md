# OpenClaw Adapter

OpenClaw reads `AGENTS.md` from the project root natively. When you scaffold
with `dev-harness init --agent-tool openclaw`, the harness generates `AGENTS.md`
with the full workflow driver content.

## Usage

```bash
# Scaffold with OpenClaw adapter
dev-harness init --stack node --agent-tool openclaw --target my-project
cd my-project

# AGENTS.md is in the project root — OpenClaw reads it natively
# Start OpenClaw and follow the workflow
```

## Files Generated

- `AGENTS.md` — canonical workflow driver (OpenClaw reads this natively)
- `harness/config.json` — with `agentTool: "openclaw"`

## How It Works

OpenClaw reads `AGENTS.md` on startup. The generated `AGENTS.md` contains
the full workflow driver: phase pipeline, phase→skill mapping, rules, commands.
OpenClaw follows the workflow by calling dev-harness CLI commands:

1. `dev-harness status` → learns current phase
2. Reads `harness/docs/phases/<phase>.md` → phase skill instructions
3. Does the work
4. `dev-harness validate` → gates check quality
5. `dev-harness phase next` → advance to next phase

No tool-specific file needed — OpenClaw reads AGENTS.md directly.

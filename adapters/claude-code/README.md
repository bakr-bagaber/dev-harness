# Claude Code Adapter

Claude Code reads `CLAUDE.md` from the project root automatically. When you
scaffold with `dev-harness init --agent-tool claude-code`, the harness generates
a `CLAUDE.md` with the full workflow driver content (same as AGENTS.md).

## Usage

```bash
# Scaffold with Claude Code adapter
dev-harness init --stack node --agent-tool claude-code --target my-project
cd my-project

# CLAUDE.md is in the project root — Claude reads it automatically
claude

# Inside Claude: follow the workflow from CLAUDE.md
# - dev-harness status → check current phase
# - Read harness/docs/phases/<phase>.md → phase skill
# - Do the work
# - dev-harness validate → check gates
# - dev-harness phase next → advance
```

## Files Generated

- `CLAUDE.md` — Claude-specific instruction file (generated from AGENTS.md content)
- `AGENTS.md` — canonical workflow driver (always generated)
- `harness/config.json` — with `agentTool: "claude-code"`

## How It Works

Claude Code reads `CLAUDE.md` on startup. The generated `CLAUDE.md` contains
the full workflow driver: phase pipeline, phase→skill mapping, rules, commands.
Claude follows the workflow by calling dev-harness CLI commands:

1. `dev-harness status` → learns current phase
2. Reads `harness/docs/phases/<phase>.md` → phase skill instructions
3. Does the work (writes code, specs, tests)
4. `dev-harness validate` → gates check quality
5. `dev-harness phase next` → advance to next phase

Dev Harness enforces gates, phase order, and state via the CLI backend.

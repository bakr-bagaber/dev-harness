# Generic Adapter (Default)

The generic adapter is the default when no `--agent-tool` is specified at
scaffold time. It generates only `AGENTS.md` — the canonical, tool-agnostic
harness conventions file that any coding agent can read.

## Usage

```bash
# Scaffold with generic adapter (default — no flag needed)
dev-harness init --stack node --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (read by Claude Code, Codex,
  Aider, Continue, OpenCode, and any tool that follows the AGENTS.md standard)
- `harness-config.json` — with `agentTool: null` (unspecified)

## How It Works

Any agent tool that reads `AGENTS.md` from the project root will pick up the
harness conventions automatically. The agent follows the phase instructions
emitted by `dev-harness phase <name>` and runs `dev-harness validate` after
each phase.

## Supported Tools (no adapter needed)

These tools read `AGENTS.md` natively and work with the generic adapter:

- **Claude Code** — reads AGENTS.md (but also supports CLAUDE.md; use
  `--agent-tool claude-code` for the dedicated adapter)
- **Codex CLI** — reads AGENTS.md
- **Aider** — reads AGENTS.md via `--read AGENTS.md`
- **Continue** — reads AGENTS.md
- **OpenCode** — reads AGENTS.md

If your tool isn't listed, the generic adapter is the right choice —
AGENTS.md is the emerging standard for agent-readable project conventions.

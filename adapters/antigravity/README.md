# Antigravity 2 Adapter

Antigravity 2 (IDE/CLI/SDK) — assumed to read AGENTS.md.

## Usage

```bash
dev-harness init --stack node --agent-tool antigravity --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `harness-config.json` — with `agentTool: "antigravity"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. AGENTS.md) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

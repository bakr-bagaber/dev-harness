# Windsurf Adapter

Windsurf (Codeium) reads .windsurfrules as system context.

## Usage

```bash
dev-harness init --stack node --agent-tool windsurf --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `.windsurfrules` — Windsurf-specific rules file (generated from AGENTS.md content)
- `harness-config.json` — with `agentTool: "windsurf"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. .windsurfrules) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

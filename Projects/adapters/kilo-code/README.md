# Kilo Code Adapter

Kilo Code reads .kilocoderules.

## Usage

```bash
harness-dev init --stack node --agent-tool kilo-code --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `.kilocoderules` — Kilo Code-specific rules file (generated from AGENTS.md content)
- `harness-config.json` — with `agentTool: "kilo-code"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. .kilocoderules) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

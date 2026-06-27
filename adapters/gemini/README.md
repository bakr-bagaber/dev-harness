# Gemini CLI Adapter

Google Gemini CLI reads GEMINI.md on startup.

## Usage

```bash
dev-harness init --stack node --agent-tool gemini --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `GEMINI.md` — Gemini CLI-specific rules file (generated from AGENTS.md content)
- `harness-config.json` — with `agentTool: "gemini"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. GEMINI.md) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

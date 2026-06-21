# GitHub Copilot Adapter

GitHub Copilot reads .github/copilot-instructions.md.

## Usage

```bash
harness-dev init --stack node --agent-tool copilot --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `.github/copilot-instructions.md` — GitHub Copilot-specific rules file (generated from AGENTS.md content)
- `harness-config.json` — with `agentTool: "copilot"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. .github/copilot-instructions.md) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

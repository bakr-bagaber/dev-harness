# Amazon Q Developer Adapter

Amazon Q Developer reads .amazonq/rules.

## Usage

```bash
dev-harness init --stack node --agent-tool amazon-q --target my-project
cd my-project
```

## Files Generated

- `AGENTS.md` — canonical harness conventions (always generated)
- `.amazonq/rules.md` — Amazon Q Developer-specific rules file (generated from AGENTS.md content)
- `harness-config.json` — with `agentTool: "amazon-q"`

## How It Works

The harness generates AGENTS.md as the canonical conventions file. For tools
with a specific rules file, the harness copies AGENTS.md content to the
tool-specific filename (e.g. .amazonq/rules.md) with an optional header. The tool then
reads its native file and follows the harness phase instructions.

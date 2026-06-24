# Cursor Adapter

Cursor reads `.cursorrules` from the project root. When you scaffold with
`harness-dev init --agent-tool cursor`, the harness generates a `.cursorrules`
file that embeds the harness conventions.

## Usage

```bash
# Scaffold with Cursor adapter
harness-dev init --stack node --agent-tool cursor --target my-project
cd my-project

# Open in Cursor — .cursorrules is loaded automatically
cursor .
```

## Files Generated

- `.cursorrules` — Cursor-specific rules (embeds harness conventions)
- `AGENTS.md` — canonical harness conventions (always generated)
- `harness-config.json` — with `agentTool: "cursor"`

## How It Works

Cursor loads `.cursorrules` as system context for every chat. The generated
file includes the phase pipeline, agent roles, and the rule that the agent
must run `harness-dev validate` after each phase. Cursor then follows the
instructions emitted by `harness-dev phase <name>`.

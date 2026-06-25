# OpenCode Adapter

**Tool:** OpenCode
**Type:** AGENTS.md-native (no tool-specific file needed)

OpenCode reads `AGENTS.md` from the project root natively. No adapter scripts or special files are required — the harness scaffolds `AGENTS.md` during `init` and OpenCode picks it up automatically.

## Usage

```bash
dev-harness init --stack <stack> --agent-tool opencode
```

This writes `agentTool: "opencode"` to `harness/config.json`. The harness generates `AGENTS.md` (the canonical instruction file) during scaffolding. OpenCode reads it on startup.

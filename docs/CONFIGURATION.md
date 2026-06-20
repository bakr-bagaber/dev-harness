# Configuration Reference

All harness configuration lives in **`harness-config.json`** in the project root.
This file is created by `harness-dev init` and can be edited directly or via
the CLI.

## Quick Start

```bash
# List all parameters with current values and descriptions
harness-dev config list

# Get a specific value
harness-dev config get mode

# Set a value
harness-dev config set gates.enabled true
harness-dev config set mode autopilot
harness-dev config set maxRetries 5

# Get full config as JSON
harness-dev config get
```

## Parameter Groups

### Execution

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | enum | `copilot` | Execution mode: `copilot` (manual phase runs) or `autopilot` (auto-advance after gates pass) |
| `paused` | boolean | `false` | Autopilot pause state. Set via `harness-dev pause` / `harness-dev resume` |
| `maxRetries` | integer | `3` | Max retry attempts per phase before escalating to human |

**Examples:**
```bash
harness-dev config set mode autopilot
harness-dev config set maxRetries 5
```

### Stack

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `stack` | string | `null` | Project programming stack (31 built-in or custom) |
| `stackMeta` | object | `null` | Custom stack metadata — overrides built-in. Fill during DEFINE for unknown stacks |

**stackMeta fields:** `label`, `testCmd`, `lintCmd`, `typeCheckCmd`, `buildCmd`, `installCmd`, `coverageCmd`, `versionFile`, `configFile`, `extensions`, `detectFiles`

**Example (custom Elixir stack):**
```json
"stackMeta": {
  "label": "Elixir",
  "testCmd": "mix test",
  "lintCmd": "mix credo",
  "buildCmd": "mix compile",
  "installCmd": "mix deps.get",
  "configFile": "mix.exs",
  "extensions": [".ex", ".exs"]
}
```

### Agent Tool

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agentTool` | enum | `null` | Which coding agent tool: `claude-code`, `cursor`, `windsurf`, `gemini`, `copilot`, `cline`, `roo`, `kilo-code`, `codex`, `aider`, `continue`, `opencode`, `amazon-q`, `hermes`, `generic`, or `null` (auto-detect) |

**Example:**
```bash
harness-dev config set agentTool claude-code
```

### Gates

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `gates.enabled` | boolean | `false` | Master switch for phase gate validation |
| `gates.checks` | array | `["all"]` | Which checks to run (`["all"]` or specific names) |
| `gates.coverage.enabled` | boolean | `false` | Enable coverage threshold check |
| `gates.coverage.threshold` | integer | `80` | Minimum coverage percentage (0-100) |

**Examples:**
```bash
harness-dev config set gates.enabled true
harness-dev config set gates.coverage.enabled true
harness-dev config set gates.coverage.threshold 90
```

### Git

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `git.autoCommit` | boolean | `false` | Auto-commit after each phase iteration |
| `git.autoTag` | boolean | `false` | Create git tag when pipeline completes |
| `git.resetOnRetry` | boolean | `false` | Reset working tree on retry (fresh context) |

**Examples:**
```bash
harness-dev config set git.autoCommit true
harness-dev config set git.resetOnRetry true
```

### Phases

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `phases.enabled` | array | `["define","plan","build","verify","review","ship"]` | Phases in pipeline. Add `"simplify"` to enable simplification phase |

**Example (enable simplify):**
```bash
harness-dev config set phases.enabled '["define","plan","build","verify","simplify","review","ship"]'
```

### Agent Tones

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `agents.tone.planner` | string | `"Analytical and precise..."` | Planner persona instructions |
| `agents.tone.generator` | string | `"Focused and practical..."` | Generator persona instructions |
| `agents.tone.evaluator` | string | `"Skeptical and thorough..."` | Evaluator persona instructions |
| `agents.tone.simplifier` | string | `"Relentless about clarity..."` | Simplifier persona instructions |

**Example:**
```bash
harness-dev config set agents.tone.evaluator "Strict. Reject anything without tests."
```

### Runtime State (read-only)

These fields are managed by the harness automatically. **Do not edit manually.**

| Key | Type | Description |
|-----|------|-------------|
| `currentPhase` | string | Current pipeline phase |
| `retryCount` | integer | Retry count for active phase |
| `pipelineIteration` | integer | Pipeline completion count |
| `gateHistory` | array | Gate pass/fail history |
| `features.remaining` | integer | Incomplete features count |
| `features.passing` | integer | Completed features count |
| `features.total` | integer | Total features count |
| `git.branch` | string | Current git branch (auto-detected) |
| `git.clean` | boolean | Working tree clean (auto-detected) |
| `git.hasUpstream` | boolean | Upstream tracking (auto-detected) |
| `git.lastCommitMessage` | string | Last commit message (auto-detected) |

## Full Example Config

```json
{
  "version": "1.0",
  "stack": "node",
  "stackMeta": null,
  "agentTool": "claude-code",
  "mode": "copilot",
  "currentPhase": null,
  "paused": false,
  "features": { "remaining": 0, "passing": 0, "total": 0 },
  "gates": {
    "enabled": true,
    "checks": ["all"],
    "coverage": { "enabled": true, "threshold": 80 }
  },
  "git": {
    "autoCommit": false,
    "autoTag": true,
    "resetOnRetry": false,
    "branch": null,
    "clean": true,
    "hasUpstream": false,
    "lastCommitMessage": null
  },
  "phases": {
    "enabled": ["define", "plan", "build", "verify", "simplify", "review", "ship"]
  },
  "agents": {
    "tone": {
      "planner": "Analytical and precise. Define clear boundaries.",
      "generator": "Focused and practical. Build what's specified, nothing more.",
      "evaluator": "Skeptical and thorough. Accept only compelling evidence.",
      "simplifier": "Relentless about clarity. Delete more than you add."
    }
  },
  "maxRetries": 3,
  "retryCount": 0,
  "pipelineIteration": 0,
  "gateHistory": []
}
```

## See Also

- `harness-dev config list` — interactive parameter listing
- `harness-dev config list --json` — machine-readable parameter metadata
- [Tool Integration Guide](TOOL_INTEGRATION.md) — agent tool configuration
- [Project Plan](../PROJECT_PLAN.md) — full task breakdown

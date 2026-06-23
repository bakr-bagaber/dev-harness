# Configuration Reference

All harness configuration lives in **`harness-config.json`** in the project root.
This file is created by `dev-harness init` and can be edited directly or via
the CLI.

## Quick Start

```bash
# List all parameters with current values and descriptions
dev-harness config list

# Get a specific value
dev-harness config get mode

# Set a value
dev-harness config set gates.enabled true
dev-harness config set mode autopilot
dev-harness config set maxRetries 5

# Get full config as JSON
dev-harness config get
```

## Parameter Groups

### Execution

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `mode` | enum | `copilot` | Execution mode: `copilot` (manual phase runs) or `autopilot` (auto-advance after gates pass) |
| `paused` | boolean | `false` | Autopilot pause state. Set via `dev-harness pause` / `dev-harness resume` |
| `maxRetries` | integer | `10` | Max retry attempts per task before escalating to human |
| `taskRetryCount` | integer | `0` | Per-task retry counter (managed automatically — reset on success, incremented on failure) |

**Examples:**
```bash
dev-harness config set mode autopilot
dev-harness config set maxRetries 5
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
dev-harness config set agentTool claude-code
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
dev-harness config set gates.enabled true
dev-harness config set gates.coverage.enabled true
dev-harness config set gates.coverage.threshold 90
```

### Git

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `git.autoCommit` | boolean | `false` | Auto-commit after each phase iteration |
| `git.autoTag` | boolean | `false` | Create git tag when pipeline completes |
| `git.resetOnRetry` | boolean | `false` | Reset working tree on retry (fresh context) |

**Examples:**
```bash
dev-harness config set git.autoCommit true
dev-harness config set git.resetOnRetry true
```

### Phases

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `phases.enabled` | array | `["define","plan","build","verify","review","ship"]` | Phases in pipeline. Add `"simplify"` to enable simplification phase |

**Example (enable simplify):**
```bash
dev-harness config set phases.enabled '["define","plan","build","verify","simplify","review","ship"]'
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
dev-harness config set agents.tone.evaluator "Strict. Reject anything without tests."
```

### Runtime State (read-only)

These fields are managed by the harness automatically. **Do not edit manually.**

| Key | Type | Description |
|-----|------|-------------|
| `currentPhase` | string | Current pipeline phase |
| `retryCount` | integer | Phase-level retry count |
| `taskRetryCount` | integer | Per-task retry count (reset on task success) |
| `pipelineIteration` | integer | Pipeline completion count |
| `gateHistory` | array | Gate pass/fail history |
| `features.remaining` | integer | Incomplete features count |
| `features.passing` | integer | Completed features count |
| `features.total` | integer | Total features count |
| `git.branch` | string | Current git branch (auto-detected) |
| `git.clean` | boolean | Working tree clean (auto-detected) |
| `git.hasUpstream` | boolean | Upstream tracking (auto-detected) |
| `git.lastCommitMessage` | string | Last commit message (auto-detected) |

### Supervisor (Orchestrator)

Controls the `dev-harness run` orchestrator behavior — spawning agents per task,
API downtime resilience, and heartbeat monitoring.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `supervisor.enabled` | boolean | `false` | Whether orchestrator mode is active |
| `supervisor.apiRetries` | integer | `5` | Max API retry attempts before pausing pipeline |
| `supervisor.backoffMs` | integer | `60000` | Base backoff delay in ms (exponential: 60s, 120s, 240s...) |
| `supervisor.lastHeartbeat` | string\|null | `null` | Last heartbeat timestamp (ISO 8601) |
| `supervisor.status` | enum | `idle` | Supervisor state: `idle`, `running`, `stalled`, `dead` |

**Examples:**
```bash
dev-harness config set supervisor.apiRetries 10
dev-harness config set supervisor.backoffMs 30000
```

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
  "maxRetries": 10,
  "retryCount": 0,
  "taskRetryCount": 0,
  "pipelineIteration": 0,
  "gateHistory": [],
  "supervisor": {
    "enabled": false,
    "apiRetries": 5,
    "backoffMs": 60000,
    "lastHeartbeat": null,
    "status": "idle"
  }
}
```

## See Also

- `dev-harness config list` — interactive parameter listing
- `dev-harness config list --json` — machine-readable parameter metadata
- [Tool Integration Guide](TOOL_INTEGRATION.md) — agent tool configuration
- [Project Plan](../PROJECT_PLAN.md) — full task breakdown

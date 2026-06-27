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
| `maxRetries` | integer | `10` | (Deprecated fallback) Max retry attempts. Prefer the `retry.*.maxRetries` fields below. If `retry` group is absent, this value seeds `retry.tasks.maxRetries` for backward compatibility. |

**Examples:**
```bash
dev-harness config set mode autopilot
dev-harness config set maxRetries 5   # legacy — prefer retry.tasks.maxRetries
```

### Retry (v3.1.0+)

Three independently-toggleable retry levels with the escalation chain **task → feature → phase → human**. Each level has its own `enabled` flag and `maxRetries` budget. Defaults preserve prior behavior (tasks enabled, features/phases disabled).

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `retry.tasks.enabled` | boolean | `true` | Enable per-task retry (feature-iterate phases). On task gate failure, retry the same task up to `retry.tasks.maxRetries` times. |
| `retry.tasks.maxRetries` | integer | `10` | Max task retry attempts before falling through to feature retry (or escalating if feature retry disabled). |
| `retry.features.enabled` | boolean | `false` | Enable per-feature retry. When a task exhausts task-retries (or task-retry is disabled), reset the feature's tasks and re-sweep from the first task, up to `retry.features.maxRetries` times. |
| `retry.features.maxRetries` | integer | `2` | Max feature retry attempts before falling through to phase retry (or escalating if phase retry disabled). |
| `retry.phases.enabled` | boolean | `false` | Enable per-phase retry. When a feature exhausts feature-retries (or feature-retry is disabled), reset all features in the phase and re-run the phase, up to `retry.phases.maxRetries` times. Also governs deliverable-retry phases (init/define/plan/review/ship). |
| `retry.phases.maxRetries` | integer | `2` | Max phase retry attempts before escalating to human (`paused` + `status: escalated`). |

**Examples:**
```bash
# Enable feature-level retry with a budget of 3
dev-harness config set retry.features.enabled true
dev-harness config set retry.features.maxRetries 3

# Disable task retry entirely (any task failure falls through to feature/phase retry)
dev-harness config set retry.tasks.enabled false

# Enable all three levels (full escalation chain)
dev-harness config set retry.features.enabled true
dev-harness config set retry.phases.enabled true
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
| `agentTool` | enum | `null` | Which coding agent tool: `claude-code`, `cursor`, `windsurf`, `gemini`, `copilot`, `cline`, `roo`, `kilo-code`, `codex`, `aider`, `continue`, `opencode`, `amazon-q`, `skill`, `generic`, or `null` (auto-detect) |

**Example:**
```bash
dev-harness config set agentTool claude-code
```

### Gates

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `gates.enabled` | boolean | `true` | Master switch for phase gate validation (ON by default since v3.2.0; use `init --no-gates` to disable) |
| `gates.checks` | array | `["all"]` | Which checks to run (`["all"]` or specific names) |
| `gates.coverage.enabled` | boolean | `false` | Enable coverage threshold check |
| `gates.coverage.threshold` | integer | `80` | Minimum coverage percentage (0-100) |
| `gates.cleanState.enabled` | boolean | `false` | Enable clean-state gate at session boundaries (G17). 5 conditions: lint, tests, handoff, no-stale, startup |
| `gates.cleanState.stalePatterns` | array | `[]` | Regex patterns for stale artifacts (e.g., `["console.log","TODO"]`) |
| `gates.cleanState.startupCmd` | string\|null | `null` | Command to verify startup path works (e.g., `"node -e 1"`) |
| `gates.antiPlaceholder.enabled` | boolean | `true` | Enable anti-placeholder gate (G24b). Scans for TODO/FIXME/console.log/debugger etc. |
| `gates.antiPlaceholder.patterns` | array | `[]` | Custom placeholder patterns (stack defaults used when empty) |

**Examples:**
```bash
dev-harness config set gates.enabled true
dev-harness config set gates.coverage.enabled true
dev-harness config set gates.coverage.threshold 90
dev-harness config set gates.cleanState.enabled true
dev-harness config set gates.cleanState.stalePatterns --json-value '["console.log","TODO"]'
dev-harness config set gates.cleanState.startupCmd "node -e 1"
```

### Cleanup

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cleanup.schedule` | string | `"0 2 * * 0"` | Cron expression for cleanup schedule (default: weekly Sunday 2am) |
| `cleanup.autoFix` | boolean | `false` | Auto-fix issues found during cleanup (removes empty dirs) |

**Example:**
```bash
dev-harness config set cleanup.autoFix true
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
| `currentRole` | string\|null | Current agent role (planner/generator/evaluator/simplifier/null). Set via `dev-harness role` (G19) |
| `retryCount` | integer | (Legacy) phase-level retry count — superseded by `phaseRetryCount` for the new 3-level model; kept for backward compat / deliverable-retry phases. |
| `taskRetryCount` | integer | Per-task retry count (reset on task success) |
| `featureRetryCount` | integer | Per-feature retry count (reset when feature passes) — v3.1.0+ |
| `phaseRetryCount` | integer | Per-phase retry count (reset on new phase) — v3.1.0+ |
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

# Config Architecture — Opt-in Feature Toggles

## Design Rule

Everything optional defaults to OFF. Users add features by setting config values, not by removing them. This prevents the harness from surprising users with side effects they didn't ask for.

## Default Config

```json
{
  "version": "1.0",
  "mode": "copilot",
  "currentPhase": null,
  "paused": false,
  "features": {
    "remaining": 0,
    "passing": 0,
    "total": 0
  },
  "gates": {
    "enabled": false,
    "checks": ["all"]
  },
  "git": {
    "enabled": false,
    "autoCommit": false,
    "autoTag": false,
    "resetOnRetry": false,
    "branch": null,
    "clean": true,
    "hasUpstream": false,
    "lastCommitMessage": null
  },
  "phases": {
    "enabled": ["define", "plan", "build", "verify", "review", "ship"]
  },
  "maxRetries": 3,
  "agents": {
    "tone": {
      "planner": "Analytical and precise. Define clear boundaries.",
      "generator": "Focused and practical. Build what's specified, nothing more.",
      "evaluator": "Skeptical and thorough. Accept only compelling evidence.",
      "simplifier": "Relentless about clarity. Delete more than you add."
    }
  },
  "gateHistory": []
}
```

## Toggle Rationale

| Field | Default | Why off |
|-------|---------|---------|
| `gates.enabled` | false | Gates are verification discipline, not build speed. They slow you down. Turn on when quality matters. |
| `git.resetOnRetry` | false | Destructive: `git checkout -- .` wipes unstaged changes. Only safe when agent is sole editor. Copilot mode with human editing files would lose work. |
| `git.autoCommit` | false | Per-task commits become noise during exploratory work (possibly 10+ commits per feature). Turn on only when checkpointing for rollback. |
| `git.autoTag` | false | Tags are permanent git objects. Fine-grained iteration tags create noise in git history. Turn on only when middle-iteration recovery is desired. |
| `SIMPLIFY in phases.enabled` | excluded | SIMPLIFY is a cleanup pass — useful for production code, overhead for prototypes or experiments. |
| `maxRetries` | 3 | Conservative default for capable models. Raise to 10+ for weaker/faster models. |
| `retryCount` | 0 | Tracks same-phase re-runs. Incremented by `transitionPhase()` on same-phase call, reset on new phase. Used by `runPhase()` to check against `maxRetries` — if `retryCount >= maxRetries`, returns `escalated` status. |
| `pipelineIteration` | 0 | Incremented by `continuePipeline()` each time all phases complete. Reported in pipeline completion message. |
| `copilot.autoPrompt` | true | Controls whether copilot mode shows "Advance to \<next\>? (y/n)" after gate passes. Set to `false` to skip prompt silently. |
| `copilot.confirmGates` | true | Controls whether copilot mode **requires** y/n input before auto-advancing. When false, auto-advances without waiting (but only if `autoPrompt` is also true). |

## How Toggles Flow Through the System

```
config.gates.enabled
  ├── true  → harness-dev validate runs full gate check table
  └── false → harness-dev validate prints "Gates disabled" and exits 0

config.git.resetOnRetry
  ├── true  → git stash + git checkout + git pull before each retry
  └── false → skip git reset (agent inherits working tree from last iteration)

config.git.autoCommit
  ├── true  → git commit -am after each task completion or failure
  └── false → no auto-commit (manual commit expected)

config.git.autoTag
  ├── true  → git tag -a iter/<N> after each full pipeline iteration
  └── false → no auto-tagging

config.phases.enabled
  ├── includes "simplify" → pipeline has 7 phases
  └── excludes "simplify" → pipeline skips from VERIFY to REVIEW

config.maxRetries
  ├── 3  → escalate after 3 consecutive task failures
  └── 10 → escalate after 10 consecutive task failures

config.retryCount (tracked automatically)
  ├── retryCount >= maxRetries → runPhase returns 'escalated' status
  └── retryCount < maxRetries → phase instruction printed, iteration continues

config.pipelineIteration (tracked automatically)
  ├── Incremented on pipeline complete via continuePipeline()
  └── Shown in completion message: "Iteration 2. 3 feature(s) remaining."

config.copilot.autoPrompt
  ├── true  → show "Advance to <next>? (y/n)" after gate passes in copilot mode
  └── false → skip prompt, just print next instruction

config.copilot.confirmGates
  ├── true  → require y/n answer before auto-advancing
  └── false → auto-advance without waiting for input (if autoPrompt is true)
```

## Setting Values

```bash
harness-dev config set gates.enabled true
harness-dev config set git.autoCommit true
harness-dev config set phases.enabled '["define","plan","build","verify"]'
harness-dev config set maxRetries 10

# Bulk init with flags:
harness-dev init --gates --git --simplify
harness-dev init --gates --max-retries 10
```
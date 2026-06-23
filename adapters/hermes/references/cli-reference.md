# CLI Commands Reference

## harness-dev — All 14 Commands

```
Usage: harness-dev <command> [options]

Pipeline commands:
  init                  Scaffold full harness in current directory
  phase <name>          Invoke a phase (define|plan|build|verify|simplify|review|ship)
  validate              Run gate checks for current phase
  validate --feature X --task Y   Validate a single task (feature-iterate phases)

State commands:
  status                Show current phase + gate state + detected stack
  config get [key]      Get config value (omit key for all)
  config set <key> <val> Set config value (e.g. config set gates.enabled true)
  pause                 Pause autopilot execution
  resume                Resume autopilot execution
  learn <message>       Append a lesson to progress.md

Agent workflow commands:
  contract propose      Write/update sprint-contract.md
  contract review       Evaluator reviews contract, sets status
  contract status       Show current contract state
  contract escalate     Human adjudication when agents can't agree

Git workflow commands:
  worktree create <name> Create isolated worktree for a feature
  worktree list          List active worktrees
  worktree prune         Remove orphaned worktrees
  worktree remove <name> Clean up worktree (optionally merge branch)
  rollback list          Show available checkpoints
  rollback to <tag>      Restore state to a checkpoint
  rollback branch <tag>  Branch off a good iteration
  checkpoint create <label> Force a manual checkpoint tag

Mode:
  set-mode <mode>       Switch mode (copilot|autopilot)

Other:
  help                  Alias for --help

Global flags:
  --json      Machine-parseable JSON output (for agents)
  --help, -h  Show this help message
  --version   Show version

Exit codes:
  0  Success
  1  Validation failure (gate check failed)
  2  Usage error (bad arguments)
  3  Internal error
```

## Standard JSON Output Contract

**Every command** MUST emit these three fields in JSON output:

```json
{
  "command": "<command_name>",
  "status": "ok" | "not_implemented" | "error",
  "message": "Human-readable status or error detail"
}
```

Additional command-specific fields are encouraged but the three standard fields must always be present. Errors MUST go to stderr (not stdout) so stdout stays parseable.

## JSON Output Schemas Per Command

### status --json
```json
{
  "command": "status",
  "status": "ok",
  "message": "Phase: define, Stack: Node.js",
  "project": "my-app",
  "stack": "node",
  "stackLabel": "Node.js",
  "mode": "copilot",
  "currentPhase": "define",
  "currentFeature": "Feature 1",
  "gateStatus": "disabled",
  "checksPassing": 0,
  "checksTotal": 0,
  "paused": false,
  "features": {"remaining": 0, "passing": 0, "total": 0},
  "git": {"branch": "main", "clean": true},
  "maxRetries": 3,
  "recentLessons": ["First lesson", "Second lesson"],
  "nextAction": "Run: harness-dev phase plan"
}
```

### init --json
```json
{
  "command": "init",
  "status": "ok",
  "message": "Created 17 file(s) for stack \"python\"",
  "stack": "python",
  "target": "/tmp/proj",
  "filesCreated": 17,
  "files": ["/tmp/proj/AGENTS.md", "/tmp/proj/harness-config.json", ...],
  "git": ["Initialized empty git repo"],
  "errors": []
}

### phase build --json
```json
{
  "command": "phase",
  "phase": "build",
  "status": "instruction",
  "message": "BUILD — Feature: Feature 1 — Task: First task",
  "currentPhase": "build",
  "mode": "copilot",
  "phaseType": "feature-iterate",
  "nextPhase": "verify",
  "featureName": "Feature 1",
  "taskDescription": "First task"
}
```

### phase define --json (deliverable-retry)
```json
{
  "command": "phase",
  "phase": "define",
  "status": "instruction",
  "message": "DEFINE: produce the deliverable",
  "currentPhase": "define",
  "mode": "copilot",
  "phaseType": "deliverable-retry",
  "nextPhase": "plan"
}
```

### validate --json
```json
{
  "command": "validate",
  "phase": "build",
  "status": "failure",
  "message": "BUILD Gate: FAIL — 2/3 checks pass",
  "checks": [
    {"name": "git-clean", "pass": true, "detail": "Working tree clean"},
    {"name": "lint", "pass": false, "detail": "ruff check — failed..."}
  ],
  "overall": false,
  "failures": ["lint"]
}
```

### config get --json
```json
{
  "command": "config",
  "subcommand": "get",
  "key": "gates.enabled",
  "value": true,
  "status": "ok",
  "message": null
}
```

### config set --json
```json
{
  "command": "config",
  "subcommand": "set",
  "key": "gates.enabled",
  "value": true,
  "status": "ok",
  "message": "Set gates.enabled = true"
}
```

### pause / resume --json
```json
{
  "command": "pause",
  "status": "ok",
  "message": "Pipeline paused. Autopilot will stop after current phase gate."
}
```

### set-mode --json
```json
{
  "command": "set-mode",
  "mode": "autopilot",
  "status": "ok",
  "message": "Mode set to \"autopilot\""
}
```

### contract propose --json
```json
{
  "command": "contract",
  "subcommand": "propose",
  "status": "ok",
  "message": "Contract proposed. Evaluator review needed."
}
```

### contract review --json
```json
{
  "command": "contract",
  "subcommand": "review",
  "status": "ok",
  "message": "Contract agreed.",
  "escalated": false
}
```

### contract status --json
```json
{
  "command": "contract",
  "subcommand": "status",
  "status": "ok",
  "contractStatus": "agreed",
  "rounds": 2,
  "message": "Contract agreed (round 2/5)"
}
```

### contract escalate --json
```json
{
  "command": "contract",
  "subcommand": "escalate",
  "status": "ok",
  "message": "Contract escalated to human."
}
```

### learn --json
```json
{
  "command": "learn",
  "lesson": "Found gotcha in X middleware",
  "status": "ok",
  "message": "Lesson saved: \"Found gotcha in X middleware\""
}
```

### Error output (to stderr)
```json
{"error": "CliError", "message": "Unknown command \"foo\". See harness-dev --help", "exitCode": 2}
```

## Flag Parsing Behavior

| Input | Behavior |
|-------|----------|
| `--flag value` | `flags.flag = "value"` (string) |
| `--flag=value` | `flags.flag = "value"` (string) |
| `--flag` (last arg) | `flags.flag = true` (boolean) |
| `-h` | Shortcut for `--help` |
| `--` | Stops flag parsing; remaining tokens are positionals |

**Known guard pattern:** When `--target` is passed without a value, it becomes `boolean true`. Consumers must type-check: `typeof args.flags?.target === 'string'` before passing to `detectStack()`. This prevents `resolve(true)` TypeError. See `cli/commands/status.mjs` for reference.

## Eslint Setup

- **Config:** `eslint.config.mjs` (flat config)
- **Run:** `npm run lint` or `npx eslint cli/`
- **Auto-fix:** `npm run lint:fix`
- **Covers:** `.mjs` files in `cli/` directory
- **Stdlib globals defined:** URL, process, console, setTimeout, clearTimeout, Buffer
- **Rules:** `no-unused-vars` (warn), `no-undef` (error), `curly` (warn), `eqeqeq` (warn), `prefer-const` (warn)

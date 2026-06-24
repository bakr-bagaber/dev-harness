# T5 — Harness Config & State Machine (2026-06-19)

## Architecture Overview

The state machine lives in `cli/lib/state.mjs`. It manages three concerns:
1. **Config persistence** — read/write harness-config.json with deep-merge defaults
2. **Dot-notation access** — get/set nested keys like `gates.enabled`
3. **Phase transitions** — validate, record gate history, update git metadata, save

## Config Schema (canonical)

```json
{
  "version": "1.0",
  "stack": "<detected-stack>",
  "mode": "copilot|autopilot",
  "currentPhase": null|"init"|"define"|"plan"|"build"|"verify"|"simplify"|"review"|"ship",
  "paused": false,
  "features": { "remaining": 0, "passing": 0, "total": 0 },
  "gates": { "enabled": false, "checks": ["all"] },
  "git": {
    "autoCommit": false, "autoTag": false, "resetOnRetry": false,
    "branch": null, "clean": true, "hasUpstream": false, "lastCommitMessage": null
  },
  "phases": { "enabled": ["define","plan","build","verify","review","ship"] },
  "agents": {
    "tone": {
      "planner": "Analytical...",
      "generator": "Focused...",
      "evaluator": "Skeptical...",
      "simplifier": "Relentless..."
    }
  },
  "maxRetries": 3,
  "gateHistory": []
}
```

`version` is config schema version (`"1.0"`), **not** CLI version. CLI version lives in package.json and is injected at template time via `harnessVersion` variable — distinct from config schema.

## State Machine: Phase Transition Algorithm

`transitionPhase(targetDir, toPhase)` — the core algorithm:

```
1. loadConfig(targetDir) — read + deep-merge defaults
2. Validate transition (isValidTransition):
   - toPhase must be in enabled phase order
   - fromPhase must be immediately before toPhase (no skipping)
   - Backwards transitions rejected
3. If currentPhase is not null:
   record old phase result to gateHistory[]
4. Update currentPhase = toPhase
5. Update git metadata:
   - git.branch = git rev-parse --abbrev-ref HEAD
   - git.clean = git status --porcelain empty?
   - git.lastCommitMessage = git log -1 --format=%s
6. Clear paused flag
7. saveConfig(targetDir, config)
```

### Transition validation rules

- **Forward-only**: can only advance one step. Plan→Build OK. Plan→Verify rejected.
- **No backwards**: Build→Plan rejected.
- **Null start**: null→first phase OK. null→Plan rejected.
- **SIMPLIFY skipped by default**: phase order is `[define, plan, build, verify, review, ship]` unless explicitly enabled.

### Gate history

```json
{"phase": "build", "result": "pass", "timestamp": "2026-06-19T..."}
```

Only recorded when transitioning FROM a phase (not on first transition from null to INIT). This means N phase transitions produce N-1 gate history entries for the phases actually visited.

## Config Persistence: deepMerge Pattern

`loadConfig` reads the file and merges into canonical defaults:

```js
function deepMerge(defaults, partial) {
  const result = { ...defaults };
  for (const key of Object.keys(partial)) {
    if (
      defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) &&
      partial[key] && typeof partial[key] === 'object' && !Array.isArray(partial[key])
    ) {
      result[key] = deepMerge(defaults[key], partial[key]);
    } else {
      result[key] = partial[key];
    }
  }
  return result;
}
```

This means:
- **Missing fields** get defaults (graceful schema migration)
- **Extra fields** preserved across writes
- **Arrays NOT deep-merged** (gateHistory is literal replace)

## Dot-notation Access

`get(targetDir, key)` and `set(targetDir, key, value)` resolve `"gates.enabled"` → `config.gates.enabled`.

- get returns `{value, ok, error}` — never throws
- set mutates config in memory, then writes entire file to disk
- Type coercion in config command: `"true"`→true, `"false"`→false, `"123"`→123, `"null"`→null, else string

## Commands That Use state.mjs

| Command | Uses | Notes |
|---------|------|-------|
| `status` | `loadConfig()` | Shows live state + stack detection |
| `config get` | `get()` | Dot-notation read |
| `config set` | `set()` | Dot-notation write with type coercion |
| `phase` | `transitionPhase()` | Validates + advances phase |

All four respect `--target <dir>` flag for operating on non-cwd projects.

## Bug Pattern: Accidental Project-Root Config

During T5 testing, `config set` and `phase` were running in cwd (harness-dev project root) instead of the target directory, because they didn't check `args.flags?.target`. This created a `harness-config.json` in the project source tree — which should never exist (it's a generated file, not committed).

**Fix**: Every command that reads/writes harness state MUST support `--target`:

```js
const rawTarget = args.flags?.target;
const targetDir = (typeof rawTarget === 'string') ? rawTarget : process.cwd();
```

The type guard is critical — without it, a bare `--target` (no value) passes `true` as the directory path.

## Schema Files

`schema/harness-config.schema.json` and `schema/feature-list.schema.json` are JSON Schema (draft-07) documents that define the structural contract for their respective files. These should be updated whenever the config schema changes.

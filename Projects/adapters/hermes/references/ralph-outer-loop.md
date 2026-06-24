# Outer Ralph Loop (T9) — Implementation Patterns & Pitfalls

## Architecture

```
Copilot mode:   phase <name> → transition → inner loop → print instructions → STOP
Autopilot mode: phase <name> → transition → inner loop → continuePipeline → auto-advance
```

The outer loop lives in `cli/lib/ralph-outer.mjs`. It is intentionally thin — it only advances phases. All task/feature/deliverable iteration belongs to the inner loop (T8, `cli/lib/ralph-inner.mjs`).

## Key Functions

### `continuePipeline(targetDir, completedPhase, options)`

Called after a phase gate passes. Its behavior depends on `config.mode`:

| Mode | Behavior |
|------|----------|
| **copilot** | Returns `{status: 'instruction', nextPhase, message: "DEFINE complete. Next: harness-dev phase PLAN"}`. Does NOT auto-advance. |
| **autopilot** | Transitions to next phase, runs inner loop, and if that returns `'complete'`, recurses via `continuePipeline`. Stops when a phase returns `'instruction'` or `'error'`. |

Return shape:
```javascript
{ ok, status: 'complete'|'instruction'|'error', message, currentPhase, nextPhase, phasesRemaining }
```

### `runAutopilot(targetDir, options)`

Convenience wrapper. Reads config, determines start phase (current or first in order), transitions to first phase then calls `continuePipeline`.

## Integration in `phase.mjs`

The phase command flows:
1. Validate phase name against `getPhaseOrder()`
2. `transitionPhase(targetDir, phase)` — state machine advance
3. `runPhase(targetDir, phase, {json})` — inner loop (prints instructions)
4. If inner loop returned `'complete'`:
   - **Copilot**: print `"Next: harness-dev phase <next>"` and stop
   - **Autopilot**: call `continuePipeline(targetDir, phase, {verbose: true})` which chains to next phase

The `--json` output includes a `pipeline` sub-object when in autopilot mode:
```json
{
  "command": "phase",
  "phase": "define",
  "status": "complete",
  "pipeline": {
    "status": "instruction",
    "message": "DEFINE complete. Next: harness-dev phase PLAN",
    "phasesRemaining": 5,
    "nextPhase": "plan"
  }
}
```

## `set-mode` Command

`cli/commands/set-mode.mjs` persists mode changes via `state.mjs` `set()`:
```javascript
import { set } from '../lib/state.mjs';
set(targetDir, 'mode', mode);
```
The command is thin — no side effects, no transition. Just writes `mode` to `harness-config.json`.

## Pitfalls

**`continuePipeline` must handle non-'complete' statuses.** The inner loop returns `'instruction'` for deliverable-retry phases (INIT, DEFINE, PLAN, REVIEW, SHIP) because those phases produce a single deliverable and expect the agent to do work. The autopilot must NOT try to auto-advance through an `'instruction'` status — only `'complete'` means gate passed. Trying to chain through `'instruction'` creates infinite loops.

**`nextPhase` was missing from autopilot's non-complete return path.** Early T9 implementations omitted `nextPhase` from the return object when `loopResult.status !== 'complete'`. This meant the caller could not tell what phase came next. Fixed in patch 2026-06-19: added `orderRemaining.indexOf()`/`+1` logic to populate `nextPhase` even when the pipeline pauses.

**Deliverable-retry phases never return 'complete' from runPhase.** These phases (INIT, DEFINE, PLAN, REVIEW, SHIP) always return `'instruction'` because they require the agent to produce a deliverable and validate it. The only way they become `'complete'` is via the outer loop reading config and determining the deliverable was validated. Currently, the `'complete'` status only comes from feature-iterate phases (BUILD, VERIFY, SIMPLIFY) when all features pass. This means autopilot in its current form can only auto-advance through feature-iterate phases, not deliverable-retry ones.

**`runAutopilot` start-phase detection edge case.** When `config.currentPhase` is null (project initialized but no phase started), `runAutopilot` transitions to the first enabled phase and starts from there. But if `config.currentPhase` is set to a phase that is not in `phases.enabled` (e.g., config tampering), it falls back to the first enabled phase silently — the mismatch is not reported.

## Related Files

- `cli/lib/ralph-outer.mjs` — outer loop engine
- `cli/commands/set-mode.mjs` — mode switching
- `cli/commands/phase.mjs` — phase command with outer loop integration
- `cli/lib/ralph-inner.mjs` — inner loop engine (T8)
- `references/ralph-loop.md` — Ralph pattern design reference

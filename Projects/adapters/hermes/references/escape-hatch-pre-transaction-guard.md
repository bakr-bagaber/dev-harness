# Escape-hatch Pre-Transaction Guard Pattern

## Problem

When a config flag acts as a guard (e.g., `paused`, `retryCount`, any "may I proceed?" check), the check must happen BEFORE calling a state-mutating function that clears it.

## Bug example

In T11, the `phase` command checked `config.paused` AFTER calling `transitionPhase()`, but `transitionPhase()` clears `config.paused = false` as a side effect. Result: pause was never detected — the check always saw `paused: false` because the transition had already cleared it.

```javascript
// WRONG — check after transition clears paused:
const result = transitionPhase(targetDir, 'build');  // sets paused = false
if (config.paused) { /* never reached */ }            // always false

// CORRECT — check before transition:
const { config } = loadConfig(targetDir);
if (config.paused) { return; }  // block before call
const result = transitionPhase(targetDir, 'build');
```

## Pattern

```
1. loadConfig() → read current state
2. Check guard flag(s)
3. If blocked → return early with message
4. If clear → call state-mutating function
5. State function may reset guard flag — that's fine, we already passed
```

## Applies to

- `paused` checks before `transitionPhase()` (autopilot mode)
- `retryCount` checks before `runPhase()` (inner loop escalation)
- Any guard that must be evaluated before a transition clears it

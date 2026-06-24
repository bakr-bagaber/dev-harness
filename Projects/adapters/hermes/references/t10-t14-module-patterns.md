# T10–T14 Module Dependency Chain

## Core dependency order (build order, bottom-up)

```
state.mjs ← progress.mjs ← gates.mjs ← ralph-inner.mjs ← ralph-outer.mjs
                                                          ← modes.mjs
                                                          ← contract.mjs
```

Each module depends on the ones to its left. Test fixtures that need the full stack should import from the rightmost module they need.

## Module roles

| Module | Role | Key exports |
|--------|------|-------------|
| `state.mjs` | Config persistence, phase transitions, git metadata | `loadConfig`, `saveConfig`, `get`, `set`, `transitionPhase`, `getPhaseOrder`, `isValidTransition` |
| `progress.mjs` | progress.md dual-structure read/write | `readProgress`, `readSessionState`, `readLessons`, `writeSessionState`, `appendLesson` |
| `gates.mjs` | Phase gate check registry | `runChecks`, `areGatesEnabled`, `getPhase` |
| `ralph-inner.mjs` | Inner loop engine (feature-iterate + deliverable-retry) | `runPhase`, `getPhaseType`, `loadFeatureList`, `saveFeatureList`, `getNextFeature`, `getNextTask` |
| `ralph-outer.mjs` | Outer loop pipeline advancement | `continuePipeline`, `runAutopilot` |
| `modes.mjs` | Copilot/autopilot config and prompts | `getMode`, `shouldAutoPrompt`, `shouldConfirmGates`, `promptYesNo`, `ensureCopilotConfig` |
| `contract.mjs` | Sprint contract negotiation | `proposeContract`, `reviewContract`, `getContractStatus`, `escalateContract`, `validateContract` |

## Phase status return values

| Status | Meaning | Autopilot action |
|--------|---------|-----------------|
| `instruction` | Phase running, agent work needed | Continue to next phase (feature-iterate) or stop (deliverable-retry) |
| `complete` | All features pass or deliverable done | Pipeline advances to next phase |
| `escalated` | Retries exhausted (>= maxRetries) | Pipeline stops, human intervention required |
| `paused` | config.paused is true | Pipeline stops, resume clears flag |
| `error` | Config missing, phase unknown | Pipeline stops, error output |

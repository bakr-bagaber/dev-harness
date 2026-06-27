# {{stackLabel}} — Dev Harness

## Project
- **Stack:** {{stack}}
- **Mode:** copilot / autopilot
- **Phase:** not started

## Quick Start
```bash
dev-harness status        # Where are we? (clock-in)
dev-harness phase next    # Advance to next phase
dev-harness validate      # Check gate criteria
dev-harness role <name>   # Set role (planner/generator/evaluator/simplifier)
dev-harness learn "text"  # Save a lesson
dev-harness decision "x"  # Record a decision
dev-harness cleanup       # Scan for stale artifacts
dev-harness audit         # Report active gates/retry/phases
```

## Commands (17 total)
| Command | Purpose |
|---------|---------|
| `init` | Scaffold harness in a new project |
| `status` | Current phase, role, gates, session state (clock-in) |
| `phase <name\|next>` | Invoke a phase or auto-advance |
| `validate` | Run gate checks (`--feature --task` for per-task, `--session-exit` for clean-state) |
| `role <name>` | Set currentRole, fire handoff (planner/generator/evaluator/simplifier) |
| `decision "text"` | Record a decision in lessons-decisions.md |
| `config list\|get\|set` | Read/write config (`--json-value` for arrays/objects) |
| `learn "text"` | Append a lesson to progress.md |
| `set-mode <mode>` | Switch copilot/autopilot |
| `pause` / `resume` | Pause/resume autopilot (resume resets counters) |
| `contract propose\|review\|status\|escalate` | Sprint contract negotiation |
| `worktree create\|list\|prune\|remove` | Git worktree management |
| `checkpoint create <label>` | Create a git-tag checkpoint |
| `rollback list\|to\|branch` | Restore to a checkpoint |
| `cleanup` | Scan stale artifacts, empty dirs, doc freshness (`--auto-fix`) |
| `audit` | Report active gates, retry levels, suggestions |

## Workflow (follow strictly)
1. `dev-harness status` → check current phase
2. Read `harness/docs/phases/<phase>.md` → phase skill
3. Do the work (follow skill's **Process**)
4. `dev-harness validate` → check gates
5. PASS → `dev-harness phase next` → advance
6. FAIL → fix, re-validate. Repeat until "Pipeline complete"

## Session Routine (clock-in / clock-out)

**Clock-in (session start):**
1. `dev-harness status` → reads `harness/session-handoff.md` (the clock-out snapshot from last session)
2. Read `harness/docs/phases/<currentPhase>.md` → phase skill
3. Continue from the **Next Action** in the handoff

**Clock-out (session end — before exiting):**
1. `dev-harness validate` → clean-state gate (build, tests, progress, no-stale, startup)
2. `dev-harness role <next>` or `dev-harness phase next` → writes `session-handoff.md` + appends `progress.md`
3. `git commit -am "session: <what you did>"` → persist state
4. Exit

> The harness writes `session-handoff.md` at every session boundary (7 triggers:
> task complete, feature complete, phase transition, pause/escalate, context-budget-low,
> human-requested end, role handoff). A new session reads it first to pick up where
> the last left off.

## Phase Pipeline
INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP

See `harness/docs/phases/` for phase-specific instructions.

| Phase | Skill | Role |
|-------|-------|------|
| DEFINE | `harness/docs/phases/define.md` | Planner |
| PLAN | `harness/docs/phases/plan.md` | Planner |
| BUILD | `harness/docs/phases/build.md` | Generator |
| VERIFY | `harness/docs/phases/verify.md` | Evaluator |
| SIMPLIFY | `harness/docs/phases/simplify.md` | Simplifier |
| REVIEW | `harness/docs/phases/review.md` | Evaluator |
| SHIP | `harness/docs/phases/ship.md` | Generator |

## Agent Roles
| Role | File | Tone |
|------|------|------|
| Planner | `harness/docs/agents/planner.md` | Analytical, precise |
| Generator | `harness/docs/agents/generator.md` | Focused, practical |
| Evaluator | `harness/docs/agents/evaluator.md` | Skeptical, thorough |
| Simplifier | `harness/docs/agents/simplifier.md` | Relentless about clarity |

## Rules (non-negotiable)
1. No agent evaluates its own work — Evaluator judges
2. Read `harness/progress.md` + this file before each operation
3. NEVER skip phases — advance via `dev-harness phase next`
4. ALWAYS validate before advancing. If gates fail → fix, re-validate
5. Append lessons: `dev-harness learn "text"`. Commit frequently
6. No files in project root unless harness-managed or standard
7. Structure from the start — `src/`, `tests/`, `docs/`, `scripts/`

## Key Files
| File | Purpose |
|------|---------|
| `harness/config.json` | Config + state |
| `harness/features/feature-list.json` | Features + tasks |
| `harness/progress.md` | Session state + lessons |
| `harness/sprint-contract.md` | Pre-build agreement |
| `harness/scripts/init.sh` | Install → verify → start |
| `harness/evaluator-rubric.md` | Quality scorecard |
| `harness/docs/phases/` | Phase skill instructions |
| `harness/docs/agents/` | Agent role guides |

## Dev Commands
Install: `{{installCmd}}` | Build: `{{buildCmd}}` | Test: `{{testCmd}}` | Lint: `{{lintCmd}}` | Type: `{{typeCheckCmd}}`

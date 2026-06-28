---
name: "dev-harness"
description: "Dev Harness — phase-based development pipeline with stack detection, template scaffolding, state machine, gate validation, inner/phase loop, copilot/autopilot modes, sprint contracts, git worktree management, rollback/checkpoint, multi-agent role framework, session-boundary enforcement, 3-level retry cascade, cleanup/audit, Skill adapter, distribution packaging, docs-site scaffolding, coverage gates, cross-platform support, CI/CD templates, and consolidated test runner. Covers T1-T25 + G1-G24 gap implementations. Load when any task involves dev-harness CLI usage, working inside a harness-scaffolded project, or debugging harness issues."
license: MIT
category: software-development
risk: high
source: self
date_added: "2026-06-20"
metadata:
  version: 4.1.0
  paradigm: "Phase-based agentic development pipeline (backend-only, agent-as-frontend)"
  changelog:
    - "4.1.0 — Session-boundary enforcement (G17 wiring via fireSessionBoundary), e2e Suite G (168 cases covering G1-G24), validate --session-exit flag, producedByRole recording."
    - "4.0.0 — Agent-as-frontend architecture reversal. Removed TUI, orchestrator, spawn, supervisor. CLI is backend-only; agent tools are the frontend."
    - "3.1.0 — 3-level retry cascade (task→feature→phase→human), TUI parity."
    - "2.0.0 — Merged comprehensive agent skill content with Skill adapter source."
---

# Dev Harness (`dev-harness`)

## When to Load

- You are inside a project scaffolded with `dev-harness init`
- You are asked to run `dev-harness <command>`
- You need to understand or debug the harness CLI
- You are developing or modifying the harness itself

## What It Is

A CLI tool (`cli/dev-harness.mjs`) that provides a **phase-based development pipeline** for AI agent workflows. The harness is backend-only (v4.0.0+): no TUI, no orchestrator, no agent spawning. Your coding agent is the frontend — they read `AGENTS.md` + phase skills, then call CLI commands to drive the pipeline.

Projects are scaffolded with stack-aware templates, tracked by a state machine, validated by gates, and iterated via inner/phase loops. The multi-agent role framework (planner/generator/evaluator/simplifier) enforces role separation with self-evaluation guards.

## Quick Start

```bash
dev-harness status                    # Current state (clock-in)
dev-harness phase define              # Start DEFINE phase
dev-harness validate                  # Run gate checks
dev-harness role planner              # Set current role (fires handoff)
dev-harness decision "use postgres"   # Record a decision
dev-harness learn "lesson here"       # Save a lesson
dev-harness cleanup                   # Scan for stale artifacts
dev-harness audit                     # Report active gates/retry/phases
```

## Prerequisites

- Node.js >= 18
- `dev-harness` CLI accessible via `npx dev-harness-cli` or global install
- A git repository (for worktree, rollback, and checkpoint commands)

## Commands (17 total)

### `dev-harness init [--stack <name>] [--target <dir>] [--agent-tool <tool|all>] [--mode <copilot|autopilot>] [--force] [--no-git] [--no-gates] [--json]`

Scaffolds a new project with ~31 files. Auto-detects stack if not specified.
Gates are ON by default (G12); use `--no-gates` to disable. Autopilot mode
enables the full 3-level retry cascade (G10).

### `dev-harness status [--json] [--target <dir>]`

Shows current project state — phase, mode, role, gate status, session state
(from handoff), recent lessons, recent decisions, retry counters. JSON includes
`sessionState`, `progressTail`, `decisionsTail`, `handoffTimestamp`, `currentRole`.

### `dev-harness phase <name|next> [--json] [--target <dir>]`

Invokes a phase or auto-advances: `define` -> `plan` -> `build` -> `verify` -> `[simplify]` -> `review` -> `ship`
- Copilot: returns instruction (agent decides to advance)
- Autopilot: auto-advances through pipeline

### `dev-harness validate [--phase <name>] [--feature <id> --task <id>] [--session-exit] [--json]`

Runs gate checks for current or specified phase. Returns `{phase, checks[], overall, failures}`.
- `--feature X --task Y`: per-task validation (marks complete, advances task loop, checks task-criteria gate G7)
- `--session-exit`: runs ONLY the clean-state gate (5 conditions, fatal-on-demand, G17)
- Role enforcement (G21): BUILD/VERIFY require `currentRole=evaluator`
- Self-eval guard (G23): evaluator can't validate work they produced

### `dev-harness role <planner|generator|evaluator|simplifier> [--json]`

Sets `config.currentRole`, fires session boundary (trigger #7: role handoff —
writes handoff + runs clean-state gate + appends progress), prints role skill.
Each role = a separate external agent session (G22).

### `dev-harness decision "<text>" [--links-lesson "lesson"] [--json]`

Records a decision in `harness/lessons-decisions.md`, linked to the last lesson
(G18). Decisions are recorded live (not backfilled at REVIEW).

### `dev-harness config list|get|set [--json-value <json>] [--json]`

Read/write `harness/config.json` via dot-notation. Use `--json-value` for
arrays/objects (accepts JSON string, `@file`, or `-` for stdin).

### `dev-harness learn "<message>" [--json]`

Appends a lesson to `harness/progress.md` history log.

### `dev-harness set-mode <copilot|autopilot> [--json]`

Switches between modes. Autopilot requires DEFINE phase or later.

### `dev-harness pause` / `dev-harness resume [--json]`

Pauses/resumes autopilot. Pause fires session boundary (trigger #4). Resume
resets all retry counters to 0 (G11).

### `dev-harness contract propose|review|status|escalate [--json]`

Sprint contract negotiation. `propose` requires `--criteria` (G5) and
`currentRole=planner` (G21). `review` requires `currentRole=evaluator` (G21).

### `dev-harness worktree create|list|prune|remove <name> [--json]`

Git worktree management with harness scaffold.

### `dev-harness checkpoint create <label> [--force] [--json]` / `dev-harness rollback list|to|branch [--json]`

Git tag-based checkpoint and rollback with state file restoration.

### `dev-harness cleanup [--auto-fix] [--json]`

Scans for stale artifacts (matches `gates.cleanState.stalePatterns`), empty
dirs, quality-doc freshness, drift. `--auto-fix` removes empty dirs. Idempotent.

### `dev-harness audit [--json]`

Reports active gates, active retry levels, enabled phases, and suggestions
(e.g., "maxRetries=10 is high with full cascade on -- consider lowering to 3").

## Phase Pipeline

```
INIT -> DEFINE -> PLAN -> BUILD -> VERIFY -> [SIMPLIFY] -> REVIEW -> SHIP
```

| Phase | Type | Deliverable |
|-------|------|-------------|
| INIT | CLI only | Scaffold all harness files |
| DEFINE | Deliverable-retry | Sprint contract, PRD |
| PLAN | Deliverable-retry | Task breakdown in feature-list.json |
| BUILD | Feature-iterate | One feature/task at a time |
| VERIFY | Feature-iterate | Test + lint per feature |
| SIMPLIFY | Feature-iterate | Refactor, no behavior change |
| REVIEW | Deliverable-retry | Gate review, evaluator rubric |
| SHIP | Deliverable-retry | Tag, changelog, release |

## Gates (v4.1.0)

Gates are ON by default (G12). Per-phase checks:

| Phase | Checks |
|-------|--------|
| define | feature-branch, contract-agreed, **contract-criteria** (G8) |
| plan | git-clean |
| build | git-clean, lint, tests, contract-agreed, **contract-criteria** (G8), coverage, **anti-placeholder** (G24b) |
| verify | git-clean, tests, coverage |
| simplify | git-clean, no-empty-dirs |
| review | branch-up-to-date, **rubric-content** (G9), readme, architecture, decisions |
| ship | git-clean, tagged, changelog, readme, license, contributing, no-empty-dirs, **anti-placeholder** (G24b) |

**Session-boundary gate** (G17): `checkCleanState` runs 5 conditions (lint, tests,
handoff, no-stale, startup) at every session boundary (role handoff, phase
transition, task/feature complete, pause). Advisory by default; fatal via
`validate --session-exit`.

## 3-File Handoff Split (G13/G14/G18)

| File | Lifecycle | Purpose |
|------|-----------|---------|
| `harness/session-handoff.md` | OVERWRITE per boundary | "Where are we now" -- clock-out snapshot |
| `harness/progress.md` | APPEND-ONLY | "What did we do and when" -- history log |
| `harness/lessons-decisions.md` | APPEND-ONLY, lesson->decision paired | "What did we learn + decide" |

## Retry Cascade (G10/G11)

- **Copilot** (default): task retry only (maxRetries=10, human in loop)
- **Autopilot**: full 3-level cascade ON by default (task 3x -> feature 2x -> phase 2x = 12 attempts before human)
- Counter resets: task->feature resets taskRetryCount, feature->phase resets featureRetryCount, resume resets all

## Session Restart Enforcement (G25)

Agents that support `--exit-on-complete` + `--fresh-session`, enabling full
fresh-context enforcement via an external shell loop (the "Ralph loop"):

```bash
while ! dev-harness status --json | grep -q '"status":"complete"'; do
  your-agent --task "$(dev-harness status --json | jq -r .nextAction)" \
    --fresh-session --exit-on-complete
  dev-harness validate --json
  dev-harness phase next --json
done
```

Interactive agents cannot enforce session restart
programmatically -- fresh context is human-controlled (advisory only). Role-based
gates (G21) still enforce role separation regardless.

## State Machine Config

- `mode`: copilot | autopilot
- `currentPhase`: null | define | plan | build | verify | simplify | review | ship
- `currentRole`: null | planner | generator | evaluator | simplifier (G19)
- `paused`: true/false
- `gates.enabled`: true (default, G12)
- `gates.cleanState`: { enabled, stalePatterns, startupCmd } (G17)
- `gates.antiPlaceholder`: { enabled: true, patterns } (G24b)
- `retry`: { tasks: {enabled, maxRetries}, features: {enabled, maxRetries}, phases: {enabled, maxRetries} } (G10)
- `cleanup`: { schedule: "0 2 * * 0", autoFix: false } (G24)
- `maxRetries`: 10 (legacy fallback when retry.tasks.maxRetries is null)

## Output Contract

Every JSON output MUST include:
```json
{"command": "<name>", "status": "ok|error|instruction", "message": "..."}
```

Errors go to **stderr** with: `{"error":"CliError","message":"...","exitCode":N}`

Exit codes: 0=success, 1=validation failure, 2=usage error, 3=internal error

## Related Skills

- `ops-master` -- when working within ops/ structure
- `skill-master` -- when improving this skill
- `dockhand-master` -- for Docker-related harness project needs

## Trigger Examples

- "scaffold a new Python project" -> `dev-harness init --stack python`
- "what phase are we in" -> `dev-harness status`
- "start the BUILD phase" -> `dev-harness phase build`
- "check if gates pass" -> `dev-harness validate`
- "set role to evaluator" -> `dev-harness role evaluator`
- "record a decision" -> `dev-harness decision "use postgres"`
- "save a gotcha" -> `dev-harness learn "module X imports require care"`
- "switch to autopilot" -> `dev-harness set-mode autopilot` (after DEFINE)
- "clean up stale artifacts" -> `dev-harness cleanup --auto-fix`
- "audit active gates" -> `dev-harness audit`
- "create a worktree for auth feature" -> `dev-harness worktree create auth`
- "save a checkpoint" -> `dev-harness checkpoint create before-refactor`
- "rollback to previous state" -> `dev-harness rollback to iter/1`
- "install the harness" -> `npx dev-harness-cli init --help`
- "deploy as skill" -> symlink `adapters/skill/` into `~/.skills/`

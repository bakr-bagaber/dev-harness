---
name: "dev-harness"
description: "Dev Harness — phase-based development pipeline with stack detection, template scaffolding, state machine, gate validation, inner/outer loop, copilot/autopilot modes, sprint contracts, git worktree management, rollback/checkpoint, Hermes adapter, distribution packaging, docs-site scaffolding, coverage gates, cross-platform support, CI/CD templates, and consolidated test runner. Covers T1-T25. Load when any task involves harness-dev CLI usage, working inside a harness-scaffolded project, or debugging harness issues."
license: MIT
category: software-development
risk: high
source: self
date_added: "2026-06-20"
metadata:
  version: 2.0.0
  paradigm: "Phase-based agentic development pipeline"
  changelog:
    - "2.0.0 — Merged comprehensive agent skill content with Hermes adapter source. Skill now lives at adapters/hermes/ in the dev-harness repo. Symlinked into Hermes skills dir from repo — changes to repo auto-sync."
    - "1.2.0 — Added T21-T25: documentation site scaffolding (Docusaurus/Sphinx templates moved to docs-site-templates/), test coverage gates with configurable threshold (checkCoverage in BUILD/VERIFY), cross-platform init.ps1 + platform.mjs, CI/CD templates (GitHub Actions + GitLab CI), consolidated test runner (test/run-all.mjs, npm test)."
    - "1.1.0 — Added T19 (Hermes skill wrapper) and T20 (CLI packaging & distribution). Moved to adapters/hermes/ (tool-agnostic adapter structure)."
    - "1.0.0 — Full rewrite covering all 18 tasks (T1-T18 + stack expansion). 13 supported stacks, 21 scaffold files, worktree management, rollback/checkpoint."
---

# Dev Harness (`harness-dev`)

## When to Load

- You are inside a project scaffolded with `harness-dev init`
- You are asked to run `harness-dev <command>`
- You need to understand or debug the harness CLI
- You are developing or modifying the harness itself

## What It Is

A CLI tool (`cli/harness-dev.mjs`) that orchestrates a **phase-based development pipeline** for AI agent workflows. Projects are scaffolded with stack-aware templates, tracked by a state machine, validated by gates, and iterated via inner/outer loops.

## Quick Start

```bash
harness-dev status                    # Current state
harness-dev phase define              # Start DEFINE phase
harness-dev validate                  # Run gate checks
harness-dev run                       # Start orchestrator (spawn Hermes per task)
harness-dev select-tool               # Choose backend agent tool
harness-dev learn "lesson here"      # Save lesson
```

## Prerequisites

- Node.js >= 18
- `harness-dev` CLI accessible via `node cli/harness-dev.mjs` from the project root
- A git repository (for worktree, rollback, and checkpoint commands)

## Commands

### `harness-dev init [--stack <name>] [--target <dir>] [--force] [--no-git]`

Scaffolds a new project with 21 files. If stack not specified, auto-detects from target directory.

```bash
node cli/harness-dev.mjs init --stack python --target my-project
```

### `harness-dev status [--json] [--target <dir>]`

Shows current project state — phase, mode, gate status, recent lessons. JSON contract:
```json
{"command":"status","status":"ok","project":"proj","stack":"node",
 "currentPhase":"define","currentFeature":"Feature 1",
 "gateStatus":"fail","checksPassing":1,"checksTotal":3,
 "recentLessons":["First lesson"],"nextAction":"Run: harness-dev phase plan"}
```

### `harness-dev phase <name> [--json] [--target <dir>]`

Invokes a phase: `define` → `plan` → `build` → `verify` → `simplify` → `review` → `ship`
- Copilot: stops after one phase, prompts "Advance to next? (y/n)"
- Autopilot: auto-advances through pipeline

### `harness-dev validate [--json] [--phase <name>] [--feature <id>] [--task <id>]`

Runs gate checks for current or specified phase. Returns `{phase, checks[], overall, failures}`.
Per-task validation (`--feature X --task Y`) marks tasks complete and auto-advances to next task.

### `harness-dev run [--agent-tool <tool>] [--target <dir>] [--json] [--no-tui]`

Starts the orchestrator (supervisor) for autonomous pipeline execution. Spawns the
configured agentic tool per task with a fresh session, monitors for completion,
handles API downtime with exponential backoff, and auto-advances through the pipeline.
Renders a live dashboard showing phases, features, and tasks with checkmarks.

Tier-1 tools (spawnable): hermes, openclaw, claude-code
Keyboard (TUI mode): p=pause, r=resume, q=quit, Ctrl+C=safe exit

### `harness-dev select-tool [tool-name] [--list] [--target <dir>] [--json]`

Choose backend agentic tool. Interactive wizard by default, or direct selection
with a tool name argument. Detects which tools are installed on the system.
Tier-1 (spawnable): hermes, openclaw, claude-code. Tier-2 (IDE): cursor, copilot, etc.

### `harness-dev config get <key>` / `harness-dev config set <key> <value>`

Read/write harness-config.json via dot-notation. Supports nested keys like `gates.enabled`, `git.branch`.

### `harness-dev learn <message> [--target <dir>]`

Appends a lesson to progress.md. Format: `DATE | Hermes | message`.

### `harness-dev set-mode copilot|autopilot [--json]`

Switches between modes. Autopilot requires DEFINE phase or later.

### `harness-dev pause` / `harness-dev resume`

Pauses/resumes autopilot. Pause check occurs before phase transitions.

### `harness-dev contract propose|review|status|escalate`

Sprint contract negotiation:
```bash
harness-dev contract propose --scope "Build login" --exclusions "SSO"
harness-dev contract review --agreed --notes "Scope clear"
harness-dev contract escalate --reason "Cannot agree"
```

### `harness-dev worktree create|list|prune|remove <name>`

Git worktree management with harness scaffold.

### `harness-dev checkpoint create <label>` / `harness-dev rollback list|to|branch`

Git tag-based checkpoint and rollback with state file restoration.

## Phase Pipeline

```
INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP
```

| Phase | Type | Deliverable |
|-------|------|-------------|
| INIT | CLI only | Scaffold all harness files |
| DEFINE | Deliverable-retry | Sprint contract, PRD |
| PLAN | Deliverable-retry | Task breakdown in feature_list.json |
| BUILD | Feature-iterate | One feature/task at a time |
| VERIFY | Feature-iterate | Test + lint per feature |
| SIMPLIFY | Feature-iterate | Refactor, no behavior change |
| REVIEW | Deliverable-retry | Gate review, evaluator rubric |
| SHIP | Deliverable-retry | Tag, changelog, release |

## Architecture (T1-T25)

### Layer 1: Skeleton & Detection

| Task | File(s) | Purpose |
|------|---------|---------|
| T1 | `cli/harness-dev.mjs`, `cli/lib/args.mjs`, `cli/lib/errors.mjs` | CLI entry point, argument parsing, exit codes (0/1/2/3) |
| T2 | `cli/lib/detect-stack.mjs`, `cli/lib/schemas/stacks.json` | 13-stack detection engine (Python/Java/Kotlin/Node/Go/Rust/C/C++/.NET/MATLAB/VHDL/Verilog/Generic) |

### Layer 2: Scaffold & Config

| Task | File(s) | Purpose |
|------|---------|---------|
| T3 | `templates/*` (10 files), `cli/lib/templates.mjs`, `cli/lib/vars.mjs` | Template engine with `{{VAR}}` substitution, recursive discovery |
| T4 | `cli/commands/init.mjs` | Scaffold command — creates 21 files from templates + stack stubs |
| T5 | `cli/lib/state.mjs` | Config read/write, phase transitions, retry tracking |
| T6 | `cli/lib/progress.mjs` | Dual-structure progress.md writer (session state + lessons) |

### Layer 3: Validation & Loop

| Task | File(s) | Purpose |
|------|---------|---------|
| T7 | `cli/lib/gates.mjs` | Phase gate checks per phase (8 phases, deterministic) |
| T8 | `cli/lib/ralph-inner.mjs` | Inner loop: feature-iterate and deliverable-retry modes |
| T9 | `cli/lib/ralph-outer.mjs` | Outer loop: pipeline auto-advance, iteration tracking |
| T10 | `cli/commands/phase.mjs` | Unified phase orchestrator — transition + inner loop + outer loop |

### Layer 4: Modes & Status

| Task | File(s) | Purpose |
|------|---------|---------|
| T11 | `cli/lib/modes.mjs`, `cli/commands/set-mode.mjs` | Copilot mode: auto-prompt "Advance to PLAN? (y/n)" |
| T12 | (extends T11) | Autopilot mode: auto-advance pipeline, DEFINE+ guard |
| T13 | `cli/commands/status.mjs` | Status command: project, stack, phase, feature, gates, lessons |

### Layer 5: Pre-Build Agreement

| Task | File(s) | Purpose |
|------|---------|---------|
| T14 | `cli/lib/contract.mjs`, `cli/commands/contract.mjs` | Sprint contract negotiation (propose/review/status/escalate) |
| T15 | `templates/AGENTS.md`, `templates/docs/agents/*.md` | TOC-style AGENTS.md + 4 role guides |
| T16 | `templates/evaluator-rubric.md` | 6-dimension quality scorecard (0-2, Accept/Revise/Block) |

### Layer 6: Git Workflow

| Task | File(s) | Purpose |
|------|---------|---------|
| T17 | `cli/commands/worktree.mjs` | Git worktree management (create/list/prune/remove) |
| T18 | `cli/commands/rollback.mjs`, `cli/commands/checkpoint.mjs` | Rollback/checkpoint with tag-based state restoration |

### Layer 7: Distribution

| Task | File(s) | Purpose |
|------|---------|---------|
| T19 | `adapters/hermes/SKILL.md`, `adapters/hermes/scripts/*.mjs` | Hermes skill wrapper — SKILL.md + thin wrapper scripts (init, phase, validate) + templates symlink for Hermes-native deployment |
| T20 | `dist/install.sh`, `package.json` (publish), `README.md` | CLI packaging — npm publish config (`@dev-harness/cli`), curl-pipe-bash installer, enhanced README with agent integration + API reference |

### Layer 8: Platform & CI (T21-T25)

| Task | File(s) | Purpose |
|------|---------|---------|
| T21 | `docs-site-templates/docusaurus/`, `docs-site-templates/sphinx/` | Documentation site scaffolding — Docusaurus 3 config + Sphinx/ReadTheDocs. Moved out of templates/ to avoid polluting project stack detection. Activate via `--docs` flag (not yet wired). |
| T22 | `cli/lib/gates.mjs` (checkCoverage), `cli/lib/schemas/stacks.json` (coverageCmd) | Configurable test coverage gate. `gates.coverage.enabled` + `gates.coverage.threshold` in config. Registered in BUILD and VERIFY phases. Parses percentage from stack-appropriate coverage tool. |
| T23 | `templates/init.ps1`, `cli/lib/platform.mjs` | Cross-platform: PowerShell init script (stack-specific install/verify). Platform detection module (`getPlatform`, `isWindows`, `shellQuote`, `crossExec`). |
| T24 | `templates/ci/github-actions.yml`, `templates/ci/gitlab-ci.yml` | CI/CD templates with lint → test → coverage → gate stages. GitHub Actions matrix across Node 18/20/22. |
| T25 | `test/run-all.mjs`, `test/*.mjs`, `package.json` (`npm test` script) | Consolidation: single test runner for all 12 suites. Moved docs-site-templates out of template discovery path (`.js` files were polluting stack detection). |

## Key Files

| File | Purpose |
|------|---------|
| `harness-config.json` | Config + state machine (phase, mode, gates, git, agents, retries) |
| `feature_list.json` | Feature list with pass/fail and tasks |
| `progress.md` | Session state (overwritten) + lessons (appended) |
| `sprint-contract.md` | Pre-build agreement (proposed by Generator, reviewed by Evaluator) |
| `AGENTS.md` | TOC — pointers to role guides in `docs/agents/` |
| `evaluator-rubric.md` | 6-dimension scorecard (Correctness, Coverage, Quality, Security, Performance, Handoff) |
| `init.sh` | Stack-specific install + verify + start |

## State Machine Config

- `mode`: copilot | autopilot
- `currentPhase`: null | define | plan | build | verify | review | ship
- `paused`: true/false
- `retryCount`: incremented on same-phase re-entry, reset on new phase
- `maxRetries`: escalation threshold (default 3)
- `pipelineIteration`: incremented on full pipeline completion
- `gateHistory[]`: array of phase gate results
- `gates.enabled`: true/false (default false)

## Output Contract

Every JSON output MUST include:
```json
{"command": "<name>", "status": "ok|error|instruction", "message": "..."}
```

Errors go to **stderr** with: `{"error":"CliError","message":"...","exitCode":N}`

Exit codes: 0=success, 1=validation failure, 2=usage error, 3=internal error

## Working with Audit-Driven Development

This project follows a **implement → user audits → fix all findings** cycle. Every implementation task is followed by a thorough user audit that catches edge cases and bugs. This is the expected workflow, not an exception.

**What to expect:**
- After implementing a task, the user will run an independent audit with their own test suite
- The audit will find bugs, spec deviations, and edge cases you missed
- The user reports findings as a structured report with tables
- You must fix ALL identified issues before moving to the next task
- Do not defer fixes — "fix it now, not later" is the rule

**How to prepare:**
- Document any design decisions, trade-offs, or spec deviations as you implement
- Ensure test expectations are updated when adding new checks or features
- Keep the option-A/B/C format for decisions the user asked about — they want structured trade-off analysis
- Always run ESLint and syntax checks before declaring work complete

**Key lesson from T5-T20:** Every task had at least one bug the user found that you didn't. This is not a failure — it's the process. The audit catches what the first pass misses. Plan for it.

## Pitfalls

1. **`--target` is per-command flag, not global** — pass `--target <dir>` to each command that operates on a non-CWD project. Bare `--target` without value causes `flags.target = true` (boolean) which some commands handle gracefully and others don't.

2. **Phase transitions are forward-only, no skipping.** `define → plan → build → ...` Each phase must be completed before the next. Same-phase re-entry increments retry count.

3. **Copilot mode auto-prompt only works in interactive TTY.** In non-TTY (CI, subagents), `promptYesNo()` returns `null` and the prompt is silently skipped. Set `copilot.autoPrompt: false` to suppress in automation.

4. **Template system walks subdirectories recursively.** Adding a `.md` file anywhere under `templates/` automatically generates it on `init`. To exclude, prefix with `.` (dotfile).

5. **Config default for `pipelineIteration` is 0** — first full pipeline completion increments to 1. Don't read it before first complete cycle.

6. **Contract status regex matches case-insensitively.** `**Status:** Agreed` and `**Status:** AGREED` both map to `'agreed'`. HTML comments like `<!-- Agreed / Needs Revision -->` are stripped.

7. **Rollback `to` stashes uncommitted changes.** If working tree is dirty, `git stash push` before checkout, then `git stash pop` after restore. This may fail on merge conflicts.

8. **Worktree `create` runs `git worktree add`.** Requires a clean working tree (no uncommitted changes) and an active git repo. Fails with exit 1 if either condition isn't met.

9. **`dotnet` stack has no config file stub** — because .NET project files (`*.csproj`) are project-specific and not suitable for auto-generation. `global.json` is created as version file.

10. **`matlab` stack has no config or version file** — MATLAB is a licensed product; no standard project config format.

11. **`dist/install.sh` is force-added to git** — The ops-level `.gitignore` ignores all `dist/` directories. `dist/install.sh` must be staged with `git add -f`. Run this after any edit to the file.

12. **Hermes skill wrapper scripts use relative path resolution** — Wrapper scripts at `adapters/hermes/scripts/*.mjs` resolve the CLI relative to the project root (`../../../../cli/harness-dev.mjs`). They must be invoked from within a harness-scaffolded project directory, or the relative path breaks.

13. **docs-site-templates/ lives outside templates/** — Documentation scaffolding was moved from `templates/docs-site/` to `docs-site-templates/` to prevent `.js` files from polluting project stack detection. The `--docs` CLI flag is not yet wired; deploy manually by copying or symlinking the desired template.

14. **CI/CD templates are auto-discovered, not CLI-wired** — `templates/ci/` templates are included automatically by `harness-dev init` via the recursive template engine. There is no `harness-dev ci setup` command — use standard init instead.

15. **checkCoverage in BUILD and VERIFY gates** — Coverage gate is registered in both BUILD and VERIFY phases. Config via `gates.coverage.enabled` and `gates.coverage.threshold` (default 80%). Disabled by default.

16. **npm test uses test/run-all.mjs** — The consolidated runner uses `fileURLToPath` for Node 18+ compatibility. All 12 test suites are run sequentially.

## Related Skills

- `ops-master` — when working within ops/ structure
- `skill-master` — when improving this skill
- `dockhand-master` — for Docker-related harness project needs

## Trigger Examples

- "scaffold a new Python project" → `harness-dev init --stack python`
- "what phase are we in" → `harness-dev status`
- "start the BUILD phase" → `harness-dev phase build`
- "check if gates pass" → `harness-dev validate`
- "save a gotcha" → `harness-dev learn "module X imports require care"`
- "switch to autopilot" → `harness-dev set-mode autopilot` (after DEFINE)
- "create a worktree for auth feature" → `harness-dev worktree create auth`
- "save a checkpoint" → `harness-dev checkpoint create before-refactor`
- "rollback to previous state" → `harness-dev rollback to iter/1`
- "install the harness" → `npx @dev-harness/cli init --help` or `bash dist/install.sh`
- "deploy as Hermes skill" → symlink `adapters/hermes/` into `~/.hermes/skills/`
- "test all tasks" → `for t in test-t*.mjs; do node "$t" || exit 1; done`

## Scripts

Thin wrapper scripts are provided under `adapters/hermes/scripts/` that resolve the CLI relative to the project root:

- `scripts/init.mjs` — wrapper for `harness-dev init`
- `scripts/phase.mjs` — wrapper for `harness-dev phase`
- `scripts/validate.mjs` — wrapper for `harness-dev validate`

Use these when you want to invoke harness commands from other Hermes skill scripts or automation.

## Templates

The `adapters/hermes/templates/` directory is a symlink to `../../templates` (the project's main templates directory). Template files use `{{VAR}}` substitution for stack-aware scaffolding.

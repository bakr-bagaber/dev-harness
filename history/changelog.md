# Changelog — dev-harness

## 2026-06-28 — Ralph loop restructuring: 3 distinct files + shared leaf module

- **Agent:** GitHub Copilot
- **Type:** refactor (architecture cleanup, no behavior change)

### Changes

#### Restructured: 3 Ralph loops as distinct single-responsibility modules
- **Before:** `ralph-tasks.mjs` was a god-module containing feature-list I/O, phase classification, output builders, retry escalation, the dispatcher, AND deliverable handling. `ralph-features.mjs` duplicated output-building logic. Circular dependency (tasks ↔ features via dynamic import). `buildFeatureIterateOutput` was dead code.
- **After — 4 files with clean acyclic dependency graph:**
  - `cli/lib/ralph-shared.mjs` (NEW, leaf module): feature-list I/O (`loadFeatureList`/`saveFeatureList`), phase classification (`getPhaseType`), feature/task navigation (`getNextFeature`/`getNextTask`), output builders (`buildFeatureIterateOutput`/`buildDeliverableRetryOutput`), shared config loader (`loadLoopConfig`). No ralph-* imports.
  - `cli/lib/ralph-tasks.mjs` (175 lines): **task loop** (`runTaskLoop`) — iterates tasks within a feature. Owns task-level retry escalation (signals `task-exhausted`).
  - `cli/lib/ralph-features.mjs` (200 lines): **feature loop** (`runFeatureLoop`) — iterates features within a phase, delegates to task loop. Owns feature-level retry escalation (signals `feature-exhausted`).
  - `cli/lib/ralph-phases.mjs` (520 lines): **phase loop** + dispatcher (`runPhase`/`continuePipeline`/`runAutopilot`) — dispatches to feature loop or deliverable handler. Owns phase-level retry escalation.
- **Dependency graph (acyclic):** `ralph-shared ← ralph-tasks ← ralph-features ← ralph-phases`
- **Updated callers:** `phase.mjs`, `validate.mjs`, `status.mjs` now import from correct modules.
- **Updated tests:** `test-t9.mjs`, `test-t10.mjs`, `test-t42.mjs`, `test-t16.mjs` reference new module locations.
- **Updated docs:** README.md, CONFIGURATION.md, SKILL.md, PROJECT_PLAN.md, decisions.md, schema descriptions.
- **Result:** 26/26 tests pass, 0 lint errors. No circular dependencies, no dead code, no duplicated output builders.

---

## 2026-06-28 06:06 — Compliance audit: re-created missing history/issues.md

- **Agent:** Infra Manager Agent
- **Type:** audit fix
- **Context:** ops-compliance-check daily scan (2026-06-28 06:00 UTC) detected `history/issues.md` was missing. File was originally created at project initialization (2026-06-16) but lost during subsequent branch operations.

### Changes
- Re-created `history/issues.md` with an entry documenting the loss and recovery, following the ops-master entry template (agent name, timestamp, type, context, impact, verification)

- **Impact:** dev-harness project now has all 4 required history files (changelog.md, decisions.md, issues.md, audit.md). No functional impact on the tool itself.
- **Verification:** `ls ~/ops/Projects/dev-harness/history/` confirms all 4 files present

---

## 2026-06-27 — V4.1.0: Session-Boundary Enforcement + E2E Gap Coverage

- **Agent:** GitHub Copilot
- **Type:** minor release (new enforcement feature + test coverage)

### Changes

#### New: Session-Boundary Enforcement (G17 wiring)
- **Wired `checkCleanState` gate** (was dead code — defined but never invoked) into 4 CLI-driven session-boundary triggers via new `cli/lib/session-boundary.mjs` `fireSessionBoundary()` helper:
  - `role` command (trigger #7: role handoff)
  - `transitionPhase` (trigger #3: phase transition)
  - `validate` task/feature complete (triggers #1/#2)
  - `pause` (trigger #4)
- **New `validate --session-exit` flag** — runs ONLY the clean-state gate (5 conditions: lint, tests, handoff, no-stale-artifacts, startup). Fatal-on-demand; clean-state is advisory at boundaries (non-fatal).
- **Clean-state result surfaced** in `role`/`validate`/`pause` JSON output as `cleanState: { pass, detail }` (null when disabled).
- **Fixed bug** in `transitionPhase` where progress.md history line logged `X → X` instead of `X → Y` (captured `fromPhase` before overwriting `config.currentPhase`).
- **`producedByRole` recording** in `validate` when marking tasks/features complete (reads `currentRole` for self-eval guard).

#### New: E2E Suite G (168 cases) — G1-G24 Gap Coverage
- Added **Suite G** to `test/e2e-full-workflow.mjs` (199 → 367 cases total) covering all G1-G24 gap implementations:
  - **G1** (14 cases): init defaults & flags (`--no-gates`, `--mode autopilot`, schema fields)
  - **G2** (8 cases): config `--json-value` ergonomics (arrays/objects/`@file`/stdin, null-parent auto-create)
  - **G3** (27 cases): full multi-agent role workflow through all 7 phases (planner→generator→evaluator→simplifier) with self-eval guard + role gate testing
  - **G4** (36 cases): new commands matrix — `role`/`decision`/`cleanup`/`audit` happy + error paths
  - **G5** (22 cases): gates pass/fail matrix — anti-placeholder, contract-criteria, task-criteria, rubric-content, clean-state
  - **G6** (25 cases): handoff & session continuity — 3-file split, overwrite vs append, `status --json` fields, counter resets
  - **G7** (36 cases): retry cascade defaults & counter resets, null-role pass-through
- Added 11 new test helpers: `readConfig`, `readHandoffFile`, `readProgressFile`, `readDecisionsFile`, `setProducedByRole`, `setAcceptanceCriteria`, `scaffoldPlaceholderFreeSource`, `writeContractCriteria`, `fillRubric`, `countOccurrences`.

### Stats
- 28/28 test suites pass (no regressions)
- 367 e2e cases pass (199 existing B-F + 168 new Suite G)
- 0 lint errors

---

## 2026-06-26 — V4.0.0: Agent-as-Frontend Architecture (harness-backend branch)

- **Agent:** GitHub Copilot
- **Type:** major release (architecture reversal — agent-as-frontend)

### Changes

#### Architecture: Agent-as-Frontend
- **Removed TUI entirely** — `cli/tui/` directory, all screens, components, app entry
- **Removed orchestrator/spawn** — `run`, `select-tool`, `detect-tool` commands; `supervisor.mjs`, `agent-spawn.mjs`, `task-prompt.mjs`, `dashboard.mjs`, `ralph-output.mjs`
- **Removed TUI deps** — `ink`, `react`, `p-retry` (kept ajv, simple-git, picocolors, string-width)
- **CLI stays as stripped backend** — init, status, phase, validate, config, learn, contract, checkpoint, rollback, help
- **Agent tools are the frontend** — Claude Code, Codex, Cursor, OpenCode, Antigravity, OpenClaw, Hermes read AGENTS.md + phase skills, call CLI commands

#### New: `phase next` command
- Auto-advances to next phase, checks gates first, enforces phase order
- Key command agents call to progress through pipeline

#### Enhanced: AGENTS.md as workflow driver
- Rewritten as navigation hub: workflow steps, phase pipeline, phase→skill mapping, rules, commands
- 69 lines (progressive disclosure — depth in phase skill files)

#### Enhanced: Phase skill files (addyosmani anatomy)
- All 7 phase templates rewritten with addyosmani/agent-skills anatomy:
  Overview / When to Use / Process / Rationalizations to Avoid / Red Flags / Verification / Handoff
- Each phase skill includes `dev-harness` CLI commands in Process section

#### New: Multi-agent support
- `--agent-tool all` generates all tool-specific instruction files
- `--agent-tool claude-code,cursor` comma-separated list
- Config stores `agentTool` (primary) + `agentTools` (all configured)

#### Updated documentation
- README.md rewritten for agent-as-frontend architecture
- docs/TOOL_INTEGRATION.md rewritten — no orchestrator/spawn/TUI
- Adapter READMEs updated (claude-code, openclaw) — removed spawn references
- help.mjs updated — removed run/select-tool/detect-tool, added `phase next`

#### Tests
- All 27 unit tests pass (removed ralph-output refs, TUI tests)
- 38 QA cases pass (removed detect-tool test)
- 25 e2e scenarios pass
- 0 lint errors

---

## 2026-06-25 — V3.1.0: Generalized 3-Level Retry + TUI Parity

- **Agent:** GitHub Copilot
- **Type:** minor release (retry redesign + TUI parity fixes + comprehensive QA)

### Changes

#### New: Generalized 3-Level Retry (task → feature → phase → human)
- Three independently-toggleable retry levels, each with own `enabled` flag + `maxRetries` budget
- Escalation chain: task → feature → phase → human
- Controllable from CLI (`config set retry.tasks.enabled false`) and TUI (new retry-config screen, `y` from dashboard)
- Backward-compatible defaults: tasks on, features/phases off (preserves prior behavior)
- Task loop owns task escalation (signals `task-exhausted`); feature loop owns feature escalation (signals `feature-exhausted`); phase loop owns phase escalation
- Deliverable-retry phases (init/define/plan/review/ship) map to phase-level retry
- See ADR 2026-06-25 in `history/decisions.md`

#### Fixed: Spec gaps (G1/G9/G10)
- G1: `validate --feature/--task` now scopes gates to task-applicable checks (lint/tests/coverage), not whole-phase
- G9: `gateHistory` records both `pass` and `fail` results (previously only `pass`)
- G10: `config.features` summary syncs from `feature_list.json` after each mutation (status shows live counts)
- G7/G8: Added `retryCount`/`taskRetryCount`/`featureRetryCount`/`phaseRetryCount`/`pipelineIteration` to schema

#### Fixed: TUI Parity (7 dead-key screens)
- `rollback.mjs`: cursor selection + `t`/`b` keys → restore/branch
- `contract.mjs`: review mode `a`/`r`/`e` keys (agree/revise/escalate)
- `gate-fix.mjs`: `s`/`l`/`t` fix actions wired
- `worktree.mjs`: `x` remove key + cursor selection
- `agent-run.mjs`: `p` pause/resume toggle
- `config-editor.mjs`: `e` edit mode (key→value, mirrors `config set`)
- New `retry-config.mjs` screen (1/2/3 toggle, a/b/c edit maxRetries)

#### New: Comprehensive QA
- T42: 3-level retry toggle matrix (23 tests, 8 toggle combinations)
- `qa-comprehensive.mjs`: 40 cases (CLI matrix + edge cases + TUI pty)
- `test/tui-pty/`: 8 pty-driven TUI test suites (26 tests) using python3 `pty.fork()`
- Expanded `e2e-pipeline.sh`: V9-V14 (python/go/generic/no-git/existing-dirty/3-level-retry)

#### Schema
- `schema/harness-config.schema.json`: new `retry` group + counter properties
- `schema/feature-list.schema.json`: `retryCount` on feature objects

#### Docs
- `PROJECT_PLAN.md` T8 algorithm amended with 3-level escalation chain
- `docs/CONFIGURATION.md`: new Retry section + retry counters in runtime state
- `docs/TOOL_INTEGRATION.md`: orchestrator retry step updated

---

## 2026-06-24 — V3.0.0: TUI-First Interactive Application

- **Agent:** GitHub Copilot
- **Type:** major release (paradigm shift: CLI-first → TUI-first)
- **Context:** User feedback: "the TUI needs to take care of all of this, configs and workflow, full TUI control, I don't need to touch the CLI." The previous TUI was read-only dashboard bolted onto a CLI workflow. v3.0.0 transforms dev-harness into a TUI-first interactive app where the human never touches the CLI.

### Changes

#### New: Full TUI Application (33 new files)
- `cli/tui/app.mjs` — TUI entry point, screen manager, global keys
- `cli/tui/actions.mjs` — action dispatcher (TUI → lib functions, no child processes)
- `cli/tui/screens.mjs` — screen registry + navigation stack + toast system
- `cli/tui/screens/` — 20 screen components covering ALL 27 CLI commands
- `cli/tui/components/` — 13 reusable Ink components (SelectList, TextInput, Toggle, Form, ConfirmDialog, Toast, ScrollView, etc.)

#### Entry Point
- `dev-harness` (no args) + TTY → launches interactive TUI
- `dev-harness <command>` → CLI mode (unchanged, for AI agents + scripting)

#### ALL 27 CLI commands mapped to TUI keys
Every CLI command has a TUI equivalent — human never needs CLI.

#### ALL 29 config parameters editable from TUI
Config editor screen with inline editing by type.

#### ALL data files viewable from TUI
Feature list, lessons, progress, gate history, rubric, contract.

#### UX Features
- Setup wizard (first run): stack/tool/gate/mode selection + scaffold
- Gate fix flow: actionable fixes per check type
- Contract negotiation: inline form, propose/review/escalate
- Confirm dialogs for destructive actions
- Toast notifications, search/filter, scrollable views
- Help screen with keybindings + phase guide + troubleshooting

#### Backward Compatibility
- ALL 16 CLI commands unchanged — work exactly as before
- ALL existing tests pass (26/26)
- CLI remains as backend for AI agents + scripting

- **Impact:** dev-harness is now a TUI-first interactive application. Humans use `dev-harness` (no args) for full interactive control. CLI commands remain for AI agents and scripting.
- **Verification:** `npm test` — 26/26 pass; `npm run lint` — 0 errors

## 2026-06-23 — V2.2.0: Internal Consolidation Refactor

- **Agent:** GitHub Copilot
- **Type:** minor release (internal refactor, no breaking API changes)
- **Context:** Post-v2.1.0 audit found two parallel output strategies (output.mjs helpers vs raw process.stdout.write), two parallel error strategies (errors.mjs vs result objects with no documented boundary), an exit-code bug class where 9 command handlers emitted errors but returned (exiting 0 on failure, breaking --json scripting/CI), stale version constants, and dead code left over from the v2.0.0→v2.1.0 migration.

### Changes

#### Output & Error Strategy Consolidation
- **Extended `cli/lib/output.mjs`** with `emitCmdError({ command, subcommand?, json, message, ...extras })` and `emitResult(result, { command, json, okMessage, ... })` — replaces ~20 duplicated JSON/human error-emit blocks across command handlers.
- **Documented canonical boundary** in `cli/lib/errors.mjs` header: lib modules return `{ ok, error, ... }` result objects; command handlers translate via output.mjs; errors.mjs (CliError/die) is CLI-entry-boundary-only.
- **Migrated all 16 command handlers** to use `emitJson`/`emitHuman`/`emitCmdError` instead of raw `process.stdout.write(JSON.stringify(...))` and `process.stderr.write(...)`.

#### Exit-Code Bug Fixes (9 handlers)
- Fixed `checkpoint`, `worktree`, `rollback`, `config`, `run`, `select-tool`, `pause`, `resume`, `learn`, `set-mode` — error paths now exit with `EXIT.VALIDATION_FAILURE` (1) instead of returning (exit 0). Restores correct non-zero exit codes for `--json` scripting/CI consumers.

#### Standardized Markers
- Success marker standardized to `✓` (replaced `✅` in run.mjs, validate.mjs, select-tool.mjs).
- Error prefix standardized to `✗` (replaced `Error:` prefix in checkpoint, worktree, rollback, run, select-tool).
- JSON errors now go to **stderr** (keeping stdout parseable for `--json` consumers) via `emitCmdError`.

#### Quick Wins & Dead Code Removal
- **Fixed stale VERSION constant** in `cli/lib/help.mjs`: `2.0.0` → `2.2.0` (was out of sync with package.json since v2.1.0).
- **Removed dead `matchesType` function** from `cli/lib/validate-schema.mjs` — unused since ajv adoption in v2.1.0, no imports anywhere.
- **Removed dead comment** in `cli/lib/args.mjs` ("wantsJson removed — ...").
- **Removed dead comment** in `cli/lib/output.mjs` ("emitResult and emitFatalError removed — ...").

#### Version
- `package.json`: `2.1.0` → `2.2.0`
- `cli/lib/help.mjs` VERSION: `2.0.0` → `2.2.0`

#### Documentation
- `history/changelog.md`: this entry
- `history/decisions.md`: ADR for result-object boundary formalization

- **Impact:** All 16 command handlers now route output through a single emit layer (output.mjs). Exit codes are correct for CI/scripting. Error/success markers are consistent. Dead code from the v2.0.0→v2.1.0 migration is removed. Version constants are in sync.
- **Verification:** `npm test` — 26/26 pass; `npm run lint` — 0 errors (26 warnings, all pre-existing style); `dev-harness --version` → `v2.2.0`

## 2026-06-21 — V2.1.0: Modernized Runtime (minimal dependencies)

- **Agent:** GitHub Copilot
- **Type:** major release
- **Context:** Audit of v2.0.0's zero-runtime-dependency posture found that the hand-rolled replacements for schema validation, git ops, TUI rendering, retry backoff, and Unicode measurement were incomplete or fragile. This release introduces a minimal, audited dependency set — each chosen for a concrete robustness/performance/correctness win — while preserving 100% backward compatibility (all 26 test suites pass unchanged in behavior).

### Changes

#### Dependencies added (6)
- `ajv` ^8 — replaces hand-rolled `validate-schema.mjs`. Full JSON Schema draft-07 support (`$ref`, `format`, `oneOf`, `if/then/else`, `pattern`). Previous validator silently passed configs using unsupported keywords.
- `simple-git` ^3 — replaces `execSync`-based `git.mjs`. **Async** git ops unblock the orchestrator event loop during `dev-harness run`; typed results; eliminates string-concat command injection risk.
- `ink` ^5 + `react` ^18 — replaces manual ANSI `tui/dashboard.mjs`. Real layout engine, proper Unicode width, focus management, scrollable regions.
- `p-retry` ^6 — replaces hand-rolled exponential backoff in `supervisor.mjs`. Battle-tested retry with `shouldRetry` predicate.
- `picocolors` ^1 — replaces hand-rolled ANSI color codes in `ansi.mjs`. TTY detection, `NO_COLOR`/`FORCE_COLOR` conformance, Windows support.
- `string-width` ^7 — replaces emoji-width heuristic in `ansi.mjs`. Correctly measures emoji, combining marks, ZWJ sequences, East Asian wide chars.

#### Architecture
- **Full async git migration** — `git.mjs` is now async; cascade propagated through `state.mjs` (`transitionPhase`), `gates.mjs` (`runChecks` + all check functions), `ralph-phases.mjs` (`runPhase` dispatcher, `continuePipeline`, `runAutopilot`), `ralph-features.mjs` (`runFeatureLoop`), `ralph-tasks.mjs` (`runTaskLoop`), `ralph-shared.mjs` (shared utilities), and 8 command files. All command handlers were already async, so the top of the cascade was safe.
- **Ink-based TUI** — `tui/dashboard.mjs` rewritten using `React.createElement` (no JSX, since project ships .mjs without a transpile step). Preserves `startLiveDashboard`/`stopLiveDashboard`/`appendAgentOutput` API.
- **README rewrite** — removed "Zero Dependencies" badge; added 5 Mermaid block diagrams (system architecture, 7-phase pipeline, Ralph 3-level loop state machine, orchestrator data flow, Tier-1 vs Tier-2 agent integration); added Dependencies section documenting each dep's rationale.

#### Decisions deferred (with revisit paths in `history/decisions.md`)
- `xstate` for ralph loops: **not adopted**. The ralph loops are file-iterating task processors with retry escalation, not event-driven UIs — xstate would add weight without feature/perf improvement and carries real regression risk on tested semantics. Revisit path documented: build equivalence harness asserting byte-identical output across T8/T9/T10/T11/T12 scenarios before any swap.
- `commander` for arg parsing: **not adopted**. The hand-rolled `parseArgs` is robust and its return shape is load-bearing across the codebase; commander's `parseOptions` API didn't fit the pass-through pattern cleanly. `help.mjs` curated text is superior to auto-generated help. Revisit path documented: restructure `dev-harness.mjs` entry to use commander subcommand dispatch natively, preserve `parseArgs` as adapter, migrate curated help via `.addHelpText()`.

#### Bug Fixes (pre-existing, surfaced by migration)
- `tui/dashboard.mjs`: `setInterval`/`clearInterval` were undeclared in eslint globals — added to `eslint.config.mjs`.
- `gates.mjs`: `checkInitExecutable` was missing `async` keyword after `execGitCheck` became async — fixed.

#### Config Changes
- None. `harness-config.json` schema and defaults unchanged.

#### Documentation
- README.md: full rewrite with Mermaid diagrams + Dependencies section
- history/decisions.md: ADR for "Why we dropped zero-dep" + "Why xstate/commander were not adopted"
- docs/CONFIGURATION.md, docs/TOOL_INTEGRATION.md: unchanged (behavior preserved)

- **Impact:** dev-harness is now more robust (complete schema validation, async git, real TUI engine) with a minimal, audited dependency footprint. All 26 test suites pass with identical behavior to v2.0.0.
- **Verification:** `npm test` — 26/26 pass; `npm run lint` — 0 errors; `npm audit` — 0 vulnerabilities

## 2026-06-21 — V2.0.0: Hybrid Orchestrator Architecture

- **Agent:** GitHub Copilot
- **Type:** major release
- **Context:** User reported bugs with autopilot phase loop, task transitions, retry logic, session isolation, API downtime resilience, and dashboard UI. Major architectural shift from passive instruction emitter to hybrid orchestrator.

### Changes

#### Architecture
- **Hybrid orchestrator model** — dev-harness now spawns CLI/TUI agents (Hermes, OpenClaw, Claude Code) per task with fresh sessions; IDE tools (Cursor, Copilot, etc.) remain instruction-based
- **Live TUI dashboard** — split-pane with phases/features/tasks checkmarks on top, agent output streaming below, keyboard controls (p=pause, r=resume, q=quit)
- **Backend tool selection** — `dev-harness select-tool` wizard with tool detection

#### New Commands
- `dev-harness run` — start orchestrator (spawn agent per task, API retry, live dashboard)
- `dev-harness select-tool` — interactive backend tool selection wizard

#### New Files (11)
- `cli/lib/agent-spawn.mjs` — agent process spawning interface
- `cli/lib/task-prompt.mjs` — task prompt builder for spawned agents
- `cli/lib/supervisor.mjs` — watchdog with exponential backoff + API error detection
- `cli/lib/dashboard.mjs` — pipeline progress renderer with checkmarks
- `cli/lib/ansi.mjs` — ANSI escape code utilities (zero deps)
- `cli/tui/dashboard.mjs` — live TUI dashboard with split-pane layout
- `cli/commands/run.mjs` — orchestrator entry point
- `cli/commands/select-tool.mjs` — backend tool selection wizard
- `adapters/hermes/spawn.mjs` — Hermes spawn adapter
- `adapters/openclaw/spawn.mjs` — OpenClaw spawn adapter
- `adapters/claude-code/spawn.mjs` — Claude Code spawn adapter

#### Bug Fixes
- `DEFAULT_MAX_RETRIES` changed from 3 to 10 (per-task, not per-phase)
- Fixed task status schema mismatch (`'completed'` → `'complete'`)
- Fixed autopilot phase loop not auto-advancing after gate validation
- Fixed task loop not auto-advancing after task completion
- Fixed feature list not being updated on task validation pass
- Fixed retry count being poisoned by normal task advancement
- Added task-level retry (`taskRetryCount`) separate from phase-level retry

#### Config Changes
- `maxRetries` default: 3 → 10
- New: `taskRetryCount` (integer, default 0) — per-task retry counter
- New: `supervisor` group — `enabled`, `apiRetries` (5), `backoffMs` (60000), `lastHeartbeat`, `status`
- New: `retryCount` field on task objects in feature-list schema

#### Documentation
- Updated README.md with `run` and `select-tool` commands
- Updated docs/CONFIGURATION.md with taskRetryCount + supervisor group
- Updated docs/TOOL_INTEGRATION.md with Tier 1/2 split + orchestrator mode
- Updated adapter READMEs (hermes, openclaw, claude-code) with spawn.mjs docs
- Updated cli/lib/help.mjs with full per-command help for run + select-tool
- Updated all template config files with new fields

- **Impact:** dev-harness is now a hybrid orchestrator capable of autonomous pipeline execution with spawnable agents, while maintaining backward compatibility with IDE tools
- **Verification:** `npm test` — all 26 tests pass; `dev-harness select-tool --list` shows tools; `dev-harness run --agent-tool cursor` shows Tier-2 guidance

## 2026-06-16 12:00 — Project scaffolded

- **Agent:** Hermes Agent
- **Type:** change
- **Context:** User requested architecture plan for robust software development harness based on agentic loops. 15+ sources researched, synthesized into architecture plan.

### Changes
- Created project directory `Projects/dev-harness/` per ops-master Template A (SWE)
- Wrote folder note (`dev-harness.md`) with overview, status, references
- Wrote README.md with key document mapping
- Wrote SPEC.md with requirements, source constraints, deliverables, success criteria
- Wrote architecture plan (`docs/analysis/harness-architecture-plan.md`) — 643 lines across 16 sections
- Created history/ subfolder with changelog, decisions, issues, audit

- **Impact:** New project in ops/ structure for harness engineering research
- **Verification:** `ls ~/ops/Projects/dev-harness/` shows all expected files and subdirectories

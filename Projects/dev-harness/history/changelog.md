# Changelog — dev-harness

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
- **Full async git migration** — `git.mjs` is now async; cascade propagated through `state.mjs` (`transitionPhase`), `gates.mjs` (`runChecks` + all check functions), `ralph-inner.mjs` (`runPhase`), `ralph-outer.mjs` (`continuePipeline`, `runAutopilot`), `supervisor.mjs`, and 8 command files. All command handlers were already async, so the top of the cascade was safe.
- **Ink-based TUI** — `tui/dashboard.mjs` rewritten using `React.createElement` (no JSX, since project ships .mjs without a transpile step). Preserves `startLiveDashboard`/`stopLiveDashboard`/`appendAgentOutput` API.
- **README rewrite** — removed "Zero Dependencies" badge; added 5 Mermaid block diagrams (system architecture, 7-phase pipeline, Ralph inner/outer loop state machine, orchestrator data flow, Tier-1 vs Tier-2 agent integration); added Dependencies section documenting each dep's rationale.

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
- **Context:** User reported bugs with autopilot outer loop, task transitions, retry logic, session isolation, API downtime resilience, and dashboard UI. Major architectural shift from passive instruction emitter to hybrid orchestrator.

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
- Fixed autopilot outer loop not auto-advancing after gate validation
- Fixed inner loop not auto-advancing after task completion
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

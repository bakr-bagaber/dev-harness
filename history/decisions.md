# Decisions — dev-harness

## 2026-06-27 — ADR: G1-G24 Gap Closure + Session-Boundary Enforcement (v4.1.0)

- **Agent:** GitHub Copilot
- **Type:** architectural decision (enforcement-by-default + multi-agent role framework)
- **Context:** The v4.0.0 e2e report (198 cases) identified 24 gaps (G1-G24) where the harness described enforcement in docs but didn't implement it. Gates were off by default, criteria were optional, handoff was dead code, no role enforcement, no clean-state gate, no cleanup loop.

**Decisions:**

1. **Gates ON by default (G12):** Flip `gates.enabled` default from `false` to `true`. Existing projects keep explicit `false`. `--no-gates` escape hatch at init. Rationale: the harness's stated purpose is bringing determinism to AI-assisted development; permissive-by-default contradicts this.

2. **Autopilot cascade ON by default (G10):** Autopilot mode now defaults to full 3-level cascade (task 3× → feature 2× → phase 2× = 12 attempts before human). Copilot keeps human-in-loop. Lowered task default from 10 to 3 when cascade active (10×2×2=40 was excessive).

3. **Three-file handoff split (G13/G14/G18):** `session-handoff.md` (overwrite per boundary), `progress.md` (append-only history), `lessons-decisions.md` (append-only, lesson→decision paired). Replaces the dual-structure progress.md + orphaned session-handoff.md + docs/DECISIONS.md. Each file has one lifecycle, one job.

4. **Role-based gates + self-eval guard (G21/G23):** `validate` in BUILD/VERIFY requires `currentRole=evaluator`. `contract propose` requires `planner`, `review` requires `evaluator`. Self-eval guard: evaluator can't validate work they produced (`producedByRole === currentRole` → blocked). Multi-agent = separate external sessions (G22), not harness-spawned.

5. **Session-boundary enforcement (G17):** `checkCleanState` gate (5 conditions: lint, tests, handoff, no-stale, startup) wired into 4 CLI-driven boundary triggers via `fireSessionBoundary` helper. Advisory at boundaries (non-fatal); fatal via `validate --session-exit`. Triggers #5 (context budget) / #6 (human end) are advisory only.

6. **Criteria as lists (G5-G9):** All criteria fields (`acceptanceCriteria`, `definitionOfDone`, contract `## Verification Criteria`) are lists. Gates check for ≥1 non-placeholder line. Three-level criteria enforcement mirrors three-level retry: task criteria at task validation, feature criteria at feature completion, phase criteria at phase gate.

**Impact:** New commands `role`, `decision`, `cleanup`, `audit`. New gates `anti-placeholder`, `contract-criteria`, `task-criteria`, `rubric-content`, `clean-state`. New flags `--no-gates`, `--json-value`, `--session-exit`. E2E Suite G (168 cases) covers all G1-G24 features.

---

## 2026-06-26 — ADR: Agent-as-Frontend Architecture (v4.0.0, harness-backend branch)

- **Agent:** GitHub Copilot
- **Type:** architectural decision (reverses v3.0.0 TUI-first paradigm)
- **Context:** v3.0.0-v3.3.0 built a TUI (Ink/React) as the frontend with AI agents spawned as backend via supervisor. The TUI was complex to debug, had UX issues (navigation, dead keys, disconnected workflow), and added significant code surface (~40 TUI files). Users found the TUI harder to use than their existing agent tools' native UIs.

**Decision:** Reverse the architecture. AI agent tools (Claude Code, Codex, Cursor, OpenCode, Antigravity, OpenClaw, Hermes) become the **frontend** — they read AGENTS.md + phase skill files and call dev-harness CLI commands. Dev Harness becomes a **stripped CLI backend** (init, status, phase, validate, config, learn, contract, checkpoint, rollback).

**Removed:**
- `cli/tui/` — entire TUI directory (screens, components, app, actions)
- `run`, `select-tool`, `detect-tool` commands
- `supervisor.mjs`, `agent-spawn.mjs`, `task-prompt.mjs`, `dashboard.mjs`, `ralph-output.mjs`
- `ink`, `react`, `p-retry` dependencies

**Added:**
- `phase next` command — auto-advances with gate check (key agent command)
- Enhanced AGENTS.md template — workflow driver with phase mapping
- Phase skill files with addyosmani/agent-skills anatomy (Overview/When-to-Use/Process/Rationalizations/Red-Flags/Verification)
- Multi-agent support (`--agent-tool all`, comma-separated)

**Enforcement:** Gates (hard) + phase order (hard) + state machine (hard) + AGENTS.md instructions (soft). Agent tools natively read instruction files — no special integration needed.

**Alternatives considered:**
- **Keep TUI + fix UX** — rejected: TUI debugging was consuming disproportionate time; agent tools already have excellent native UIs.
- **Keep TUI as optional, CLI as primary** — rejected: maintaining two frontends doubles the work; TUI bugs kept recurring.

**Impact:** ~40 TUI files removed, 3 deps removed, simpler codebase, better UX (agent's native UI), stronger enforcement (CLI backend is single source of truth for gates/phases).

---

## 2026-06-25 — ADR: Generalized 3-level retry with per-level toggles (v3.1.0)

- **Agent:** GitHub Copilot
- **Type:** architectural decision (supersedes T8 retry scope in SPEC.md / PROJECT_PLAN.md)
- **Context:** The original SPEC.md (T8 algorithm) explicitly rejected whole-feature and whole-phase retry in favor of per-task retry (feature-iterate phases) and per-deliverable retry (deliverable-retry phases), escalating to a human at `maxRetries`. The implementation matched this spec: `taskRetryCount` for tasks, `retryCount` for deliverables, no `featureRetryCount` or `phaseRetryCount`. Three latent gaps existed: G1 (`validate --feature/--task` gate scoping was a stub — gates always ran at phase granularity), G9 (`gateHistory` only ever recorded `'pass'`, never `'fail'`), G10 (`config.features` summary stayed stale after feature_list mutations).

**Decision:** Generalize retry into three independently-toggleable levels — **task**, **feature**, **phase** — each with its own `enabled` flag and `maxRetries` budget. Escalation chain: task → feature → phase → human. Controllable from CLI (`config set retry.tasks.enabled false`) and TUI (new retry-config screen). Defaults preserve prior behavior (tasks enabled, features/phases disabled) for backward compatibility.

**Loop-responsibility split (critical — 3 distinct files + shared leaf):**
- **`ralph-shared.mjs`** (leaf module, no ralph-* imports): feature-list I/O (`loadFeatureList`/`saveFeatureList`), phase classification (`getPhaseType`), feature/task navigation (`getNextFeature`/`getNextTask`), output builders, shared config loader. Centralizing these breaks the circular dependency between tasks and features.
- **`ralph-tasks.mjs`** (`runTaskLoop`) — **task loop** (innermost): iterates tasks within a single feature. Owns **task-level** retry escalation (signals `task-exhausted` to the feature loop).
- **`ralph-features.mjs`** (`runFeatureLoop`) — **feature loop** (middle): iterates features within a phase, delegates each to the task loop. Owns **feature-level** retry escalation (signals `feature-exhausted` to the phase loop).
- **`ralph-phases.mjs`** (`runPhase` / `continuePipeline` / `runAutopilot`) — **phase loop** (outermost) + dispatcher: `runPhase` dispatches to the feature loop (feature-iterate phases) or deliverable handler (deliverable-retry phases). `continuePipeline` owns **phase-level** retry escalation. On `feature-exhausted`/`deliverable-exhausted`: if `retry.phases.enabled` and under max → reset all features in phase + re-run same phase; else → escalate to human (`paused` + `escalated`).
- **Dependency graph (acyclic):** `ralph-shared ← ralph-tasks ← ralph-features ← ralph-phases`

**Retry trigger semantics:**
- **Task retry** triggers on a per-task gate failure when `retry.tasks.enabled`. Counter: `taskRetryCount` (per-task, reset on success).
- **Feature retry** triggers when a task exhausts task-retries (or task-retry is disabled) and `retry.features.enabled`. Counter: `featureRetryCount` (per-feature, reset when feature passes). Action: reset the feature's task statuses + task retryCounts, re-sweep from first task.
- **Phase retry** triggers when a feature exhausts feature-retries (or feature-retry is disabled) and `retry.phases.enabled`. Counter: `phaseRetryCount` (per-phase, reset on new phase). Action: reset all features in the phase, re-run same phase.
- **Deliverable-retry phases** (init/define/plan/review/ship) have no features/tasks; they map directly to phase-level retry (`retry.phases.*` governs them; `retry.tasks/features` are no-ops).

**Gap fixes bundled in:** G1 (per-task gate scoping in `gates.mjs runChecks`), G9 (`recordGate(..., 'fail')` path in `state.mjs`), G10 (`syncFeatureSummary` recomputes `config.features` after each mutation). Also adds the previously-missing counter properties (`retryCount`, `taskRetryCount`, `featureRetryCount`, `phaseRetryCount`, `pipelineIteration`) to `harness-config.schema.json` (G8), and a `retryCount` field to feature/task objects in `feature-list.schema.json` (G7).

**Alternatives considered:**
- **Keep spec as-is (test current behavior only)** — rejected: user wants the flexibility to activate/deactivate retry at any level selectively from both CLI and TUI.
- **Add `--retry-tasks/--retry-features/--retry-phases` one-off flags on `phase`/`run`** — deferred: `config set retry.*` covers the use case with less surface area; flags can be added later if testing reveals a need.

**Impact:**
- `schema/harness-config.schema.json`: new top-level `retry` group + counter properties.
- `schema/feature-list.schema.json`: `retryCount` on feature + task objects.
- `cli/lib/state.mjs`: `getDefaultConfig` retry group; `transitionPhase` generalized counters; `recordGate` fail path; new `syncFeatureSummary`, `resetFeatureRetry`, `resetTaskRetry`, `incrementFeatureRetry`, `incrementPhaseRetry` helpers.
- `cli/lib/ralph-shared.mjs` (NEW): feature-list I/O, phase classification, output builders, shared config loader (leaf module).
- `cli/lib/ralph-tasks.mjs`: `runTaskLoop` task escalation chain; per-task gate scoping.
- `cli/lib/ralph-features.mjs` (NEW): `runFeatureLoop` feature escalation chain; delegates to task loop.
- `cli/lib/ralph-phases.mjs`: `runPhase` dispatcher + `continuePipeline` phase retry + escalation stop.
- `cli/lib/gates.mjs`: `runChecks` scoped overload; gateHistory fail recording.
- `cli/lib/constants.mjs`: retry default constants.
- `cli/commands/validate.mjs`: use new retry helpers; surface retry state in JSON.
- `cli/commands/status.mjs`: emit `retry` group.
- `cli/tui/screens/retry-config.mjs`: NEW screen; dashboard `y` key.
- `SPEC.md`, `PROJECT_PLAN.md`, `docs/CONFIGURATION.md`, `templates/AGENTS.md`: spec/docs amended.

**Verification:** new T42 retry-toggle matrix (8 combinations), T26-T43 CLI/TUI suites, expanded e2e-pipeline.sh, pty-driven TUI tests, standalone qa-comprehensive.mjs. Backward-compat: old configs without `retry` group default to current behavior.

---

## 2026-06-23 — ADR: Result-object boundary formalized (v2.2.0)

- **Agent:** GitHub Copilot
- **Type:** architectural decision
- **Context:** The v2.0.0→v2.1.0 migration left two parallel output strategies (output.mjs helpers vs raw process.stdout.write) and two parallel error strategies (errors.mjs throw-based vs { ok, error } result objects) coexisting without a documented boundary. 9 command handlers emitted errors but returned (exit 0 on failure), breaking --json scripting/CI. errors.mjs was a near-leaf module that almost nothing imported.

**Decision:** Formalize the boundary:
- **lib modules** return `{ ok, error, ... }` result objects (never throw).
- **command handlers** translate results to output via output.mjs (`emitJson`/`emitHuman`/`emitCmdError`/`emitResult`), and throw `CliError`/`ValidationError` only for usage/fatal errors.
- **errors.mjs** (`CliError`/`die`) is used at the CLI entry boundary (`dev-harness.mjs` top-level catch) to format and exit on thrown errors.
- **output.mjs** is the single emit layer for all CLI output. JSON errors go to stderr (stdout stays parseable).

**Alternatives considered:**
- **Migrate lib modules to throw-based** — rejected: the result-object pattern is deeply embedded across 30+ lib modules with consistent `{ ok, error, ... }` shapes. Throwing would require rewriting every caller and risks altering tested semantics.
- **Remove errors.mjs entirely** — rejected: the CLI entry point needs `CliError`/`die` for usage errors and the top-level catch. Scoping it to the boundary (rather than removing) is the right granularity.

**Impact:**
- 16 command handlers migrated to shared output helpers.
- 9 handlers fixed for correct non-zero exit codes on failure.
- errors.mjs header now documents the boundary explicitly.
- output.mjs extended with `emitCmdError` and `emitResult` helpers.

**Verification:** `npm test` (26/26), `npm run lint` (0 errors)

---

## 2026-06-21 — ADR: Drop zero-runtime-dependency guarantee (v2.1.0)

- **Agent:** GitHub Copilot
- **Type:** architectural decision
- **Context:** v2.0.0 shipped with zero runtime dependencies as a marketing differentiator and frictionless-install guarantee. An audit found the hand-rolled replacements for schema validation, git ops, TUI rendering, retry backoff, and Unicode measurement were incomplete or fragile:
  - `validate-schema.mjs` supported only type/required/enum/properties/items/minimum — silently passed configs using `$ref`, `format`, `oneOf`, `if/then/else`, `pattern`
  - `git.mjs` used blocking `execSync` — stalled the orchestrator dashboard during `dev-harness run`
  - `tui/dashboard.mjs` used an emoji-width heuristic (`code > 0x1F000` → 2 cols) that mis-measured combining marks, ZWJ sequences, and many CJK ranges
  - `supervisor.mjs` hand-rolled exponential backoff
  - `ansi.mjs` hand-rolled ANSI color codes without `NO_COLOR`/`FORCE_COLOR` conformance

**Decision:** Introduce a minimal, audited dependency set (6 direct deps): `ajv`, `simple-git`, `ink`+`react`, `p-retry`, `picocolors`, `string-width`. Remove the "Zero Dependencies" badge; replace with "Minimal Dependencies" + a transparency table in README documenting each dep's rationale.

**Alternatives considered:**
- **Keep zero-dep** — rejected because the hand-rolled gaps are correctness issues (silent schema-validation passes) and perf issues (blocking git), not just aesthetic.
- **Tier A (ajv + picocolors only)** — rejected as too conservative; leaves the blocking-git and fragile-TUI problems unaddressed.
- **Tier C (add xstate + commander)** — partially rejected. `xstate` for ralph loops: not adopted — the loops are file-iterating task processors, not event-driven UIs, and xstate carries regression risk on tested semantics without feature/perf improvement. `commander` for arg parsing: not adopted — the hand-rolled `parseArgs` return shape is load-bearing and commander's `parseOptions` didn't fit the pass-through pattern cleanly.

**Impact:**
- `package.json` gains 6 runtime dependencies; `npm audit` reports 0 vulnerabilities
- All public export signatures preserved — callers need no edits
- 26/26 test suites pass with identical behavior to v2.0.0
- README rewritten with Mermaid architecture diagrams + Dependencies section

**Verification:** `npm test` (26/26), `npm run lint` (0 errors), `npm audit` (0 vulns)

---

## 2026-06-21 — ADR: xstate and commander not adopted

- **Agent:** GitHub Copilot
- **Type:** decision (deferred alternatives from Tier C proposal)
- **Context:** The Tier C refactor proposal included `xstate` (formal FSM for ralph loops) and `commander` (arg parsing + help auto-generation).

**Decision:** Neither adopted in v2.1.0.

**Rationale — xstate:**
- The ralph inner/phase loops are procedural task iterators with retry escalation, not event-driven state machines. They load config, pick the next feature/task, emit instructions, and recurse. xstate shines for event-driven UIs and protocol state machines, not file-iterating loops.
- The loops have subtle, tested semantics: `retryCount` reset-on-new-phase vs increment-on-rerun, `taskRetryCount` separate tracking, escalation at `maxRetries`, recursive feature-completion, copilot-vs-autopilot branching. A state-machine port risks altering these behaviors.
- xstate adds ~50KB and a conceptual layer without a concrete feature or performance improvement. The "no breakage, only improve" rule disqualifies changes that don't improve features/perf.

**Rationale — commander:**
- The hand-rolled `parseArgs` is robust and its return shape (`{command, subcommand, flags, positionals, json, help, version}`) is load-bearing across `dev-harness.mjs` and all command handlers.
- commander's `parseOptions` helper doesn't cleanly support the pass-through pattern (collecting unknown flags into `result.flags` while routing positionals).
- `help.mjs` contains curated, formatted help text per command — superior to commander's auto-generated help, which would lose the curated examples and exit-code documentation.

**Impact:** 6 deps instead of 8. Smaller supply-chain surface. Both reconsidered if ralph loops evolve toward event-driven semantics or if arg-parsing complexity grows.

**Verification:** N/A (decision not to adopt)

### Revisit path — xstate

If ralph loops evolve toward event-driven semantics (e.g. agent emits events rather than files, or pipeline gains pause/resume/abort signals that benefit from formal FSM), revisit xstate with this approach:

1. **Build equivalence harness first** — before any production swap, create `test/test-ralph-equivalence.mjs` that:
   - Imports the current procedural `ralph-tasks.mjs`/`ralph-features.mjs`/`ralph-phases.mjs` as `oldRunTaskLoop`/`oldRunFeatureLoop`/`oldContinuePipeline`
   - Imports the new xstate-backed versions as `newRunPhase`/`newContinuePipeline`
   - For each scenario in the T8/T9/T10/T11/T12 matrix, asserts `JSON.stringify(old(...)) === JSON.stringify(new(...))` byte-identical
   - Scenarios must cover: null→first-phase transition, same-phase rerun (retryCount increment), new-phase transition (retryCount reset), feature-iterate with all-tasks-complete (recursive feature pass), deliverable-retry, escalation at maxRetries, copilot mode (instruction stop), autopilot mode (auto-advance chain), pipeline-complete (iteration increment), missing config, invalid transition
2. **Model the FSM** — states: `idle`, `loading`, `checkingRetries`, `gitReset`, `pickingTask`, `featureIterate`, `deliverableRetry`, `instruction`, `complete`, `escalated`. Events: `PHASE_REQUEST`, `RETRY`, `VALIDATE_PASS`, `VALIDATE_FAIL`, `EXHAUSTED`. Use xstate v5 `createMachine` + `setup`.
3. **Keep file I/O in actions/guards, not states** — xstate states should be pure; side effects (loadConfig, saveFeatureList, gitHardResetClean) belong in action handlers invoked on transitions.
4. **Swap only after harness passes 100%** — gate the production import swap behind the equivalence suite passing every scenario.
5. **Expected effort:** 1-2 days. **Expected gain:** architectural clarity, visualizable state diagram, easier to add pause/resume/abort later. **No feature/perf gain** — purely structural.

### Revisit path — commander

If arg-parsing complexity grows (e.g. typed subcommand options, shell completion, negatable flags become needed), revisit commander with this approach:

1. **Restructure `cli/dev-harness.mjs` entry** — replace the `COMMANDS` map + manual `parseArgs` routing with a commander `program` that declares each command as a subcommand with `.command()`, `.description()`, `.option()`, `.action()`. This is the cleanest integration point — commander owns dispatch natively.
2. **Preserve `parseArgs` return shape as adapter** — keep `cli/lib/args.mjs` exporting `parseArgs` but implement it by calling `program.parseAsync(argv)` and mapping commander's parsed result back to `{command, subcommand, flags, positionals, json, help, version}`. This keeps command handlers unchanged.
3. **Migrate `help.mjs` to commander's `.addHelpText()` / `.action()` callbacks** — attach curated per-command help text (with examples, exit codes) via `program.command('init').addHelpText('after', curatedInitHelp)`. This preserves the curated text while letting commander handle formatting/`--help` dispatch.
4. **API gotchas learned during v2.1.0 attempt:**
   - `passThroughOptions` (plural, not `passThroughOption`)
   - `parseOptions` is a `Command` *method*, not a named export — use `import { Command } from 'commander'` then `new Command().parseOptions(tokens)`
   - `helpOption(false)` then detect `--help`/`-h` from raw argv to avoid commander's auto-help conflicting with custom handling
   - `exitOverride()` is required to prevent `process.exit` on `--help`/`--version`
5. **Test after each command migration** — commander changes help output and error messages; run full `npm test` after each subcommand port to catch output-shape regressions.
6. **Expected effort:** 0.5-1 day. **Expected gain:** typed options, auto-completion, negatable flags. **Cost:** help text output changes (user-visible).

### Triggers to revisit

- **xstate**: pipeline gains pause/resume/abort signals, or agent interaction becomes event-driven, or onboarding friction from procedural loop complexity surfaces
- **commander**: arg-parsing needs typed coercion, shell completion, or subcommand validation beyond current pass-through pattern

---

## 2026-06-16 — Template A (SWE) selected as project template

- **Agent:** Hermes Agent
- **Type:** decision
- **Context:** ops-master requires every project declare its template at creation.

**Decision:** Use Template A (SWE — Software Engineering). This project produces code, scripts, and documentation for a development harness — it is primarily a software engineering project.

**Alternatives considered:**
- Template C (Simple) — rejected because the harness involves multiple components (CLI, state machine, gates, agents, integrations) and needs a full SWE structure.
- No template — rejected because ops-master mandates template declaration.

- **Impact:** Project structure follows Template A conventions: src/, tests/, deploy/, docs/ with subfolders
- **Verification:** `ls -d ~/ops/Projects/dev-harness/*/` shows src/, tests/, deploy/, docs/, history/

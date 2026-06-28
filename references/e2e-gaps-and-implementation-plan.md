# Dev-Harness — Gaps Registry & Implementation Plan

**Date:** 2026-06-27
**Companion to:** `references/e2e-full-report.md` (the 367-case e2e test report)
**Purpose:** Compile every gap identified across the e2e report (§11 findings, §11 gaps 9-24, §A/§B/§C, §14 resolutions, §15 enforcement) into a single coherent registry with stable IDs (G1-G25) and a phased implementation plan with explicit dependencies.

> **STATUS: ✅ ALL GAPS IMPLEMENTED (G1-G24) + 1 DOCUMENTED (G25) — 2026-06-27**
> All 28 test suites pass (28/28). Lint: 0 errors. New commands: `role`, `decision`, `cleanup`, `audit`. New gates: `anti-placeholder`, `contract-criteria`, `task-criteria`, `rubric-content`, `clean-state`. Gates ON by default. Autopilot cascade ON by default. Three-file handoff split wired.

> **How to read this file:** §1 is the master gap registry (read first). §2 is the implementation plan (read second — it references gap IDs). §3 is the verification matrix. §4 records decisions and scope.

---

## 1. Gap Registry (G1-G24)

Gaps are grouped by domain and assigned stable IDs. Each entry lists: severity, the report section(s) where it was identified, the current state, the recommended fix, and the files affected.

**Severity legend:** 🔴 Critical (breaks a stated purpose) · 🟠 High (soft enforcement, easy to bypass) · 🟡 Medium (UX/friction or missing convenience) · 🔵 Low (documentation/polish).

### 1.A — Config & CLI ergonomics (G1-G4)

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G1** | 🟡 | §11.3, §14.14 | `config set stackMeta.x` throws `TypeError` (stackMeta defaults to null); whole-object set blocked by shell JSON quoting | `setKey` doesn't auto-create null parents; test uses `setStackMeta()` helper to edit config.json directly | `setKey` auto-creates null parents; add `--json-value` flag reading from stdin/file for array/object values | `cli/lib/state.mjs` (setKey), `cli/commands/config.mjs` |
| **G2** | 🟡 | §11.4, §14.14 | `config set phases.enabled [array]` blocked by shell quoting of JSON | Test uses `setPhasesEnabled()` helper | Same `--json-value` flag as G1 (shared fix) | `cli/commands/config.mjs` |
| **G3** | 🔵 | §11.1 | Repo memory documented `DEFAULT_MAX_RETRIES=3`; actual is `10` | Memory corrected during test; code unchanged | Update any stale docs/comments referencing 3 | `cli/lib/constants.mjs` (comment only) |
| **G4** | 🔵 | §11.2 | `init` does not reject dirty git repos — `--force` only overwrites harness files | Documented behavior, now reflected in test (B6) | Document explicitly in `init --help` + README | `cli/commands/init.mjs`, `cli/lib/help.mjs` |

### 1.B — Pass-criteria enforcement (G5-G9)

The harness enforces *process* (contract exists + agreed, gates pass) but not *criteria quality*. A lazy agent can ship with placeholder criteria.

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G5** | 🟠 | §11.9, §14.12 | Contract criteria optional + never validated for content. `contract propose` with no `--criteria` succeeds; `contract-agreed` gate only checks `status==='agreed'` | `validateContract` (`cli/lib/contract.mjs:272`) checks status only | Make `--criteria` required for `contract propose`, OR require ≥1 non-placeholder criterion line | `cli/lib/contract.mjs`, `cli/commands/contract.mjs` |
| **G6** | 🟠 | §11.10 | No deterministic-vs-subjective criteria distinction. Nothing checks criteria are machine-verifiable | Harness has no opinion on criteria quality | Phase skill prompts for deterministic criteria; future gate parses `## Verification Criteria` section, requires ≥N non-placeholder lines | `templates/docs/phases/define.md`, `cli/lib/gates.mjs` (new check) |
| **G7** | 🔴 | §11.11, §14.12 | Feature-list schema has no `acceptanceCriteria`/`definitionOfDone` field. Task "done" = agent-asserted `status: 'complete'` | `schema/feature-list.schema.json` task = `{id, description, status}` | Add optional `acceptanceCriteria` **list** to task schema; `validate --feature --task` checks presence + non-placeholder before allowing `status: complete` | `schema/feature-list.schema.json`, `cli/lib/gates.mjs`, `cli/commands/validate.mjs` |
| **G8** | 🟠 | §11.12 | Gates are phase-level, not criteria-level. Build gate runs generic checks (lint/tests/coverage/contract-agreed) but never reads the contract's `## Verification Criteria` section | `PHASE_CHECKS.build` = generic checks only | New criteria gate parses `sprint-contract.md` criteria section, requires ≥N non-placeholder deterministic lines; ambitiously maps criteria to runnable checks | `cli/lib/gates.mjs`, `cli/lib/contract.mjs` |
| **G9** | 🟠 | §11.13, §14.7 | No backup subjective pass criteria. `evaluator-rubric.md` gated only for file-existence, not content | REVIEW gate `rubric-exists` checks file exists only | REVIEW gate checks rubric has ≥N filled-in score lines (mirrors `architecture-doc`/`decisions-logged` depth checks) | `cli/lib/gates.mjs` (checkRubricExists → checkRubricContent) |

**Three-level criteria summary (mirrors 3-level retry):** today the harness has 3-level retry but 1-level criteria (contract/phase only, and even there only presence-of-agreement). Closing G5-G9 means criteria enforcement mirrors retry: task criteria at task validation, feature criteria at feature completion, phase criteria at phase gate. All criteria fields are **lists** (a criterion is rarely single); gate passes only when *all* items met.

### 1.C — Retry cascade defaults (G10-G11)

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G10** | 🟠 | §11§A, §14.4, §15.2 | 3-level retry cascade (task→feature→phase→human) implemented but feature/phase levels **off by default**; task default `maxRetries=10` too loose when cascade active (40 attempts before human) | `retry.features.enabled=false`, `retry.phases.enabled=false` defaults | Autopilot: cascade **on by default** (task 3× → feature 2× → phase 2× = 12 attempts). Copilot: keep current (human in loop). Lower task default to **3** when cascade active. Existing projects keep explicit opt-out | `cli/lib/state.mjs` (getDefaultConfig), `cli/commands/init.mjs` |
| **G11** | 🟡 | §11§A | Counter resets not wired at feature→phase escalation. `taskRetryCount` resets on task success; `featureRetryCount` does NOT reset on feature→phase escalation | `ralph-phases.mjs` increments `phaseRetryCount` but doesn't reset `featureRetryCount` | Explicit reset at each escalation boundary: task→feature resets taskRetryCount (already does), feature→phase resets featureRetryCount, phase→human resets all on `resume` | `cli/lib/ralph-phases.mjs`, `cli/commands/resume.mjs` |

### 1.D — Gates default + enforcement (G12)

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G12** | 🔴 | §11§B Part 1, §14.5, §15.2 | Gates **off by default** — `validate` prints "Gates disabled", checks nothing. Agent can skip validate and advance freely | `gates.enabled=false` default | Flip default to `true`; `--no-gates` escape hatch at init. Existing projects keep explicit `false`. Generic gates (lint/tests/coverage) can flip immediately; criteria gates wait on G5-G9 schema | `cli/lib/state.mjs` (getDefaultConfig), `cli/commands/init.mjs` |

### 1.E — Progress handover & session continuity (G13-G18)

Researched against walkinglabs L05/L12. Agreed final architecture = **three-file split** (each file one lifecycle):

| File | Lifecycle | Purpose |
|------|-----------|---------|
| `harness/session-handoff.md` | OVERWRITE per boundary (7 triggers) | "Where are we now" — clock-out snapshot |
| `harness/progress.md` | APPEND-ONLY | "What did we do and when" — history log |
| `harness/lessons-decisions.md` | APPEND-ONLY, lesson→decision paired | "What did we learn + decide" |

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G13** | 🔴 | §11.14, §14.1 | `writeSessionState` is dead code — never called on transitions. `progress.md` Session State section frozen at init defaults forever | `cli/lib/progress.mjs:186` exports it; unit-tested in test-t6; no command calls it | Repurpose to write `harness/session-handoff.md` (overwrite) at every session boundary (7 triggers). Split current dual-structure `progress.md` | `cli/lib/progress.mjs`, `cli/lib/state.mjs` (transitionPhase), `cli/commands/validate.mjs`, `cli/commands/phase.mjs`, `cli/commands/pause.mjs` |
| **G14** | 🔴 | §11.15, §14.1 | `session-handoff.md` orphaned — scaffolded by init, `HANDOFF_PATH()` exists in paths.mjs, but no lib function reads/writes it | `cli/lib/paths.mjs:107` defines it; no usage | Becomes the **live handoff file** — overwritten at every boundary (7 triggers) with current snapshot. New session reads it first (clock-in). Points to progress.md + lessons-decisions.md for deeper context | `cli/lib/progress.mjs` (new writeHandoff/readHandoff), `cli/commands/status.mjs` |
| **G15** | 🟠 | §11.16, §14.13 | `status` doesn't surface session state. Reads lessons (last 3) but not `readSessionState`/handoff fields | `status` JSON omits sessionState | `status` JSON includes `sessionState` (from session-handoff.md) + tail progress.md (last 5) + tail lessons-decisions.md (last 3) + gate status. One command = full clock-in | `cli/commands/status.mjs` |
| **G16** | 🟠 | §11.17 | No clock-in/clock-out routine in AGENTS.md. walkinglabs L05 specifies explicit routine | `templates/AGENTS.md` has workflow steps but no clock-in/out | Add `## Session Routine (clock-in / clock-out)` section: clock-in = `status` → read phase skill → continue from Next Action; clock-out = `validate` → `role <next>`/`phase next` (writes handoff + appends progress) → commit | `templates/AGENTS.md` |
| **G17** | 🔴 | §11.18, §14.6 | No clean-state gate (walkinglabs L12 5 conditions). `validate` covers build+tests only; missing progress-recorded, no-stale-artifacts, startup-path | No clean-state gate exists | Add `clean-state` gate (or `session exit` subcommand) verifying all 5 conditions. Project-specific via config: `gates.cleanState.stalePatterns` (regex array, stack defaults), `gates.cleanState.startupCmd` (string). Fires at all 7 session-boundary triggers | `cli/lib/gates.mjs` (checkCleanState), `schema/harness-config.schema.json` (gates.cleanState) |
| **G18** | 🟠 | §11.19, §14.2, §14.3 | `DECISIONS.md` not written per-session — scaffolded as stub, gated at REVIEW only, nothing writes during DEFINE/PLAN/BUILD | `harness/docs/DECISIONS.md` manual; `decisions-logged` gate checks at REVIEW | Merge into `harness/lessons-decisions.md` (append-only, lesson→decision paired). Add `dev-harness decision "text"` command (mirrors `learn`). Extend `learn` with `--decision "text"`. REVIEW gate checks lessons-decisions.md has ≥N dated entries | `cli/commands/decision.mjs` (NEW), `cli/commands/learn.mjs`, `cli/lib/progress.mjs`, `cli/lib/gates.mjs` (checkDecisionsLogged) |

**Session boundaries — 7 triggers for handoff + clean-state gate (G13/G14/G17):**

| # | Trigger | Frequency |
|---|---------|-----------|
| 1 | Task complete | most common |
| 2 | Feature complete | less common |
| 3 | Phase transition | occasional |
| 4 | Pause / escalate | human-driven |
| 5 | Context budget low | as needed (agent self-reports) |
| 6 | Human-requested session end | on demand |
| 7 | Agent-to-agent role handoff | within tasks (planner→generator→evaluator) |

### 1.F — Multi-agent role framework (G19-G23)

The harness *describes* a planner/generator/evaluator committee in docs but implements none of it. Roles are text-only.

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G19** | 🟠 | §11.20 | No role state — `config.currentRole` doesn't exist. Can't fire handoff gate on role change (trigger #7) | `config.json` tracks currentPhase, retryCount, paused — not currentRole | Add `currentRole` to config (values: `planner` \| `generator` \| `evaluator` \| `simplifier` \| `null`) | `schema/harness-config.schema.json`, `cli/lib/state.mjs` (getDefaultConfig) |
| **G20** | 🟠 | §11.21 | No role dispatch/transition command. `ralph-tasks.mjs` prints a text block listing all roles then returns — string, not dispatch | External agent decides whether to act as each role or do everything as one | Add `dev-harness role <name>` command: sets `config.currentRole`, fires clean-state + writeSessionState handoff gate (trigger #7), prints role-specific skill instructions | `cli/commands/role.mjs` (NEW), `cli/dev-harness.mjs` (COMMANDS map) |
| **G21** | 🔴 | §11.22 | No role-based gate enforcement. No gate says "Evaluator must sign off before Generator's work accepted." `validate` runs generic checks regardless of role | Evaluator persona purely advisory; agent can skip it | `validate` in BUILD/VERIFY requires `currentRole === 'evaluator'`; `contract review` requires `currentRole === 'evaluator'`; `contract propose` requires `currentRole === 'planner'` | `cli/commands/validate.mjs`, `cli/commands/contract.mjs`, `cli/lib/gates.mjs` |
| **G22** | 🔵 | §11.23, §15.5 | No multi-agent spawning (by design — backend-only). "Multi-agent" must mean separate external sessions per role | Branch deliberately removed `run`/spawn | Document: each role = separate external agent session. Role-transition command (G20) is the mechanism; each transition = session boundary = clean handoff + new session. Harness enforces *what* (role separation, clean handoff, role gates); external tool provides *who* | `templates/AGENTS.md`, `docs/TOOL_INTEGRATION.md` |
| **G23** | 🔴 | §11.24, §15.5 | No "no agent evaluates its own work" enforcement. AGENTS.md states rule but harness can't enforce — doesn't track which session produced work vs evaluating | Single session can build + self-review | Record `producedByRole` on task/feature completion; `validate` in evaluator mode refuses if `currentRole === producedByRole` (self-evaluation guard) | `schema/feature-list.schema.json` (producedByRole), `cli/commands/validate.mjs`, `cli/lib/gates.mjs` |

### 1.G — Cleanup, quality, simplification (G24)

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G24** | 🟠 | §13.4, §13.10, §14.9-11, §15.3 | No cleanup loop, no anti-placeholder gate, no quality-doc content gate, no harness-simplification mechanism. walkinglabs L12 emphasizes entropy growth is default state | No `cleanup`/`audit` commands; no `checkNoPlaceholders` gate; `evaluator-rubric.md` static | (a) Add `dev-harness cleanup` command (stale artifacts, empty dirs, quality-doc freshness, drift; idempotent; `--auto-fix`). (b) Add `checkNoPlaceholders` gate (greps TODO/FIXME/NotImplemented/pass/throw-not-implemented; config `gates.antiPlaceholder.patterns`). (c) Repurpose `evaluator-rubric.md` as live quality doc (gate checks ≥N filled score lines — overlaps G9). (d) Add `dev-harness audit` command (reports active gates/retry/phases, suggests removals). (e) Cron config: `cleanup.schedule` (cron expr, default weekly), `cleanup.autoFix` (bool) | `cli/commands/cleanup.mjs` (NEW), `cli/commands/audit.mjs` (NEW), `cli/lib/gates.mjs` (checkNoPlaceholders), `schema/harness-config.schema.json` (gates.antiPlaceholder, cleanup) |

### 1.H — Session restart enforcement (tool-dependent, G25 — informational)

| ID | Severity | Report ref | Gap | Current state | Recommended fix | Files |
|----|----------|------------|-----|---------------|------------------|-------|
| **G25** | 🔵 | §15.9-15.11 | Harness can't force agent session restart. Fresh-context boundaries depend on agent tool capabilities | Hermes/OpenClaw: ✅ support `--exit-on-complete` + `--fresh-session` (external shell loop = full enforcement). Claude Code/Cursor/Codex: ❌ interactive, no programmatic restart (fresh context advisory, human must restart) | Document the Ralph loop pattern for Hermes/OpenClaw in `docs/TOOL_INTEGRATION.md` with the bash script. For interactive tools, document that fresh context is human-controlled; role-based gates (G21) still enforce role separation regardless | `docs/TOOL_INTEGRATION.md`, `templates/AGENTS.md` |

> **Note on G25:** this is a fundamental backend limitation, not a fixable code gap. The harness enforces the *what* (state, gates, handoffs, role separation) for all tools; the *when* (session restart) is only enforced for Hermes/OpenClaw via external shell loop. Documented, not "fixed."

---

## 2. Implementation Plan

Phased by dependency. Each phase is independently verifiable. Steps within a phase marked *parallel* can run concurrently; otherwise sequential.

### Phase 0 — Schema foundations (*blocks G5-G9, G17, G19, G23, G24*)

**Why first:** criteria gates (G5-G9), clean-state gate (G17), role state (G19), self-eval guard (G23), and cleanup config (G24) all depend on schema fields existing before gates can check them.

1. **G7** — Add `acceptanceCriteria` (array of strings) to task schema in `schema/feature-list.schema.json`; add `definitionOfDone` (array) to feature object. *parallel with step 2*
2. **G19** — Add `currentRole` (enum: null|planner|generator|evaluator|simplifier) to `schema/harness-config.schema.json` + `getDefaultConfig()` in `cli/lib/state.mjs`. *parallel with step 1*
3. **G23 (schema part)** — Add `producedByRole` (string) to task schema in `schema/feature-list.schema.json`. *parallel with steps 1-2*
4. **G17 (schema part)** — Add `gates.cleanState` object (`stalePatterns` array, `startupCmd` string) + `gates.antiPlaceholder.patterns` array + `cleanup` object (`schedule` string, `autoFix` bool) to `schema/harness-config.schema.json`. *parallel with steps 1-3*
5. **G18 (schema part)** — Add `harness/lessons-decisions.md` to scaffolded file list; deprecate `harness/docs/DECISIONS.md` path (keep for migration). *parallel*

**Verification (Phase 0):** `npm test` passes (existing tests unaffected — new fields optional); `node cli/dev-harness.mjs init --json` in a tmpdir shows new fields in config.json defaults; schema validation accepts new fields.

### Phase 1 — Config & CLI ergonomics (*parallel with Phase 0*)

6. **G1 + G2** — Fix `setKey` in `cli/lib/state.mjs` to auto-create null parents (stackMeta). Add `--json-value` flag to `config set` reading from stdin or `@file` path for array/object values. Removes need for test helpers `setStackMeta()`/`setPhasesEnabled()`.
7. **G3** — Update any stale comments/docs referencing `DEFAULT_MAX_RETRIES=3`.
8. **G4** — Document dirty-repo init behavior in `init --help` + README.

**Verification:** `config set stackMeta.lintCmd "echo hi"` succeeds (no TypeError); `config set phases.enabled --json-value '["define","plan","build"]'` succeeds; `config set gates.cleanState.stalePatterns --json-value '["console.log","TODO"]'` succeeds.

### Phase 2 — Gates default flip + generic gates (*depends on Phase 0 step 4 only; can start in parallel with Phase 1*)

9. **G12** — Flip `gates.enabled` default to `true` in `getDefaultConfig()`. Add `--no-gates` flag to `init`. Existing projects keep explicit `false` (migration: don't force-on). Generic gates (lint/tests/coverage/git-clean/contract-agreed) now enforce by default.
10. **G24(b)** — Add `checkNoPlaceholders` gate function in `cli/lib/gates.mjs`; wire into `PHASE_CHECKS.build` and `PHASE_CHECKS.ship`. Reads `gates.antiPlaceholder.patterns` (stack-specific defaults: node = `['console\\.log','debugger','TODO','FIXME']`, python = `['print\\(','TODO','pass$']`).

**Verification:** Fresh `init` (no flags) → `config get gates.enabled` returns `true`; `init --no-gates` → `false`; existing project with `gates.enabled=false` in config.json keeps `false`; `validate` on a project with a `TODO` in src fails build gate with `anti-placeholder` failure name.

### Phase 3 — Criteria gates at 3 levels (*depends on Phase 0 steps 1, 3; depends on Phase 2 for gates-on default*)

11. **G5** — Make `--criteria` required for `contract propose` (or require ≥1 non-placeholder criterion line). Update `cli/lib/contract.mjs` `validateContract` to check criteria non-empty.
12. **G8** — Add `checkContractCriteria` gate in `cli/lib/gates.mjs`: parses `sprint-contract.md` `## Verification Criteria` section, requires ≥N non-placeholder deterministic lines. Wire into `PHASE_CHECKS.define` and `PHASE_CHECKS.build`.
13. **G7 (gate part)** — Add `checkTaskCriteria` gate: `validate --feature --task` checks task's `acceptanceCriteria` list is non-empty + non-placeholder before allowing `status: complete`. Wire into validate.mjs task path.
14. **G9** — Change `checkRubricExists` → `checkRubricContent` in `cli/lib/gates.mjs`: requires ≥N filled-in score lines (mirrors `checkArchitectureDoc` depth check). Wire into `PHASE_CHECKS.review`.
15. **G6** — Update `templates/docs/phases/define.md` to prompt for deterministic criteria (machine-verifiable: "tests pass", "coverage ≥ 80%"). Soft guidance complementing the hard gate (G8).

**Verification:** `contract propose --scope "x"` (no criteria) → exit 2 or rejected; `validate` on a task with empty `acceptanceCriteria` → fails `task-criteria` gate; REVIEW gate fails when rubric has <N filled score lines.

### Phase 4 — Retry cascade defaults + counter resets (*depends on Phase 2 for gates-on; parallel with Phase 3*)

16. **G10** — In `getDefaultConfig()`: autopilot mode → `retry.features.enabled=true`, `retry.phases.enabled=true`, `retry.tasks.maxRetries=3`. Copilot mode → keep current (features/phases off, tasks=10). Init detects `--mode autopilot` and sets cascade-on defaults. Existing projects keep explicit config.
17. **G11** — In `cli/lib/ralph-phases.mjs`: when escalating feature→phase, reset `featureRetryCount=0`. In `cli/commands/resume.mjs`: when resuming from phase→human escalation, reset all counters (`taskRetryCount`, `featureRetryCount`, `phaseRetryCount`).

**Verification:** Fresh `init --mode autopilot` → `config get retry.features.enabled` returns `true`, `retry.tasks.maxRetries` returns `3`; fresh `init` (copilot) → `false`/`10`; inject task exhaustion with `retry.features.enabled=true` → featureRetryCount increments, taskRetryCount resets to 0; resume from phase escalation → all counters reset.

### Phase 5 — Handover wiring (3-file split) (*depends on Phase 0 step 5; parallel with Phases 3-4*)

18. **G13** — Repurpose `writeSessionState` in `cli/lib/progress.mjs` to write `harness/session-handoff.md` (overwrite) instead of the `## Session State` section of `progress.md`. Change `progress.md` to append-only history log (remove the overwrite section). Wire calls in: `transitionPhase` (state.mjs), `validate` (task complete), `phase next`, `pause`.
19. **G14** — Add `readHandoff(targetDir)` + `writeHandoff(targetDir, snapshot)` in `cli/lib/progress.mjs` using `HANDOFF_PATH()`. Snapshot fields: currentPhase, currentFeature, currentTask, currentRole, gateStatus, nextAction, retryCount (task/feature/phase), lastCommit. Write at all 7 boundary triggers.
20. **G15** — Update `cli/commands/status.mjs` JSON output: add `sessionState` (from readHandoff), `progressTail` (last 5 progress.md entries), `lessonsTail` (last 3 lessons-decisions.md entries), `gateStatus`.
21. **G16** — Add `## Session Routine (clock-in / clock-out)` section to `templates/AGENTS.md`: clock-in = `status` → read `harness/docs/phases/<phase>.md` → continue from Next Action; clock-out = `validate` (clean-state gate) → `role <next>` or `phase next` (writes handoff + appends progress) → commit.
22. **G18 (command part)** — Add `cli/commands/decision.mjs` (NEW): `dev-harness decision "text"` appends a decision entry to `lessons-decisions.md` linked to the last lesson. Extend `learn` with `--decision "text"` flag. Update `checkDecisionsLogged` gate to check `lessons-decisions.md` (not `docs/DECISIONS.md`).
23. **G17 (gate part)** — Add `checkCleanState` gate in `cli/lib/gates.mjs`: 5 conditions (build passes, tests pass, progress recorded, no stale artifacts via `gates.cleanState.stalePatterns`, startup path works via `gates.cleanState.startupCmd`). Wire to fire at all 7 boundary triggers (alongside writeHandoff).

**Verification:** Run a phase transition → `harness/session-handoff.md` overwritten with current snapshot, `progress.md` appended (not overwritten); `status --json` includes `sessionState` field; `dev-harness decision "use postgres"` appends to lessons-decisions.md; `validate` at session end runs clean-state gate (fails if `console.log` present and `stalePatterns` includes it).

### Phase 6 — Multi-agent role framework (*depends on Phase 0 steps 2-3, Phase 5 G13/G14/G17*)

24. **G20** — Add `cli/commands/role.mjs` (NEW): `dev-harness role <name>` sets `config.currentRole`, fires clean-state + writeHandoff (trigger #7), prints role-specific skill from `harness/docs/agents/<role>.md`. Register in `cli/dev-harness.mjs` COMMANDS map.
25. **G21** — Add role-based gate enforcement: `validate` in BUILD/VERIFY requires `currentRole === 'evaluator'` (else exit 1 with "validate requires currentRole=evaluator"); `contract review` requires `currentRole === 'evaluator'`; `contract propose` requires `currentRole === 'planner'`. Update `cli/commands/validate.mjs`, `cli/commands/contract.mjs`.
26. **G23 (guard part)** — Record `producedByRole` on task/feature completion (set to `currentRole` when marking complete). In `validate` evaluator mode: refuse if `currentRole === producedByRole` (self-evaluation guard). Update `cli/commands/validate.mjs`, `cli/lib/gates.mjs`.
27. **G22** — Document in `templates/AGENTS.md` + `docs/TOOL_INTEGRATION.md`: each role = separate external agent session; role-transition command (G20) is the mechanism; each transition = session boundary = clean handoff + new session.

**Verification:** `dev-harness role generator` sets currentRole, writes handoff, prints generator.md; `validate` with `currentRole=generator` → exit 1 ("requires evaluator"); `contract propose` with `currentRole=evaluator` → exit 1 ("requires planner"); task completed by generator → `producedByRole=generator` → evaluator `validate` on same task → exit 1 ("self-evaluation guard: producedByRole matches currentRole").

### Phase 7 — Cleanup, audit, tool integration docs (*depends on Phase 0 step 4, Phase 5; parallel with Phase 6*)

28. **G24(a)** — Add `cli/commands/cleanup.mjs` (NEW): scans stale artifacts (`gates.cleanState.stalePatterns`), empty dirs, quality-doc freshness, drift; `--auto-fix` flag; `--json` output. Idempotent. Register in COMMANDS map.
29. **G24(d)** — Add `cli/commands/audit.mjs` (NEW): reports active gates/retry levels/phases, suggests removing unused ones. Not automatic; agent/human decides.
30. **G24(e)** — Cron config: `cleanup.schedule` (cron expr, default `"0 2 * * 0"`), `cleanup.autoFix` (bool, default false). `cleanup` command detects OS, generates cron entry / scheduled task, outputs for install, records schedule in config.
31. **G25** — Document Ralph loop pattern in `docs/TOOL_INTEGRATION.md` with bash script for Hermes/OpenClaw; document interactive-tool limitations (Claude Code/Cursor/Codex: fresh context advisory, human-controlled).

**Verification:** `dev-harness cleanup --json` on a project with `console.log` → reports staleArtifacts; `--auto-fix` removes them; `dev-harness audit --json` lists active gates; `docs/TOOL_INTEGRATION.md` contains the Ralph loop bash script.

### Phase 8 — Test & docs update (*depends on all above*)

32. Update `test/e2e-full-workflow.mjs` to cover new behavior: gates-on-by-default init, criteria gates, role-based gates, self-eval guard, handoff write on transitions, clean-state gate, `decision` command, `cleanup`/`audit` commands. Remove `setStackMeta()`/`setPhasesEnabled()` helpers (G1/G2 fixed).
33. Update `references/e2e-full-report.md` §11 to mark gaps as RESOLVED with phase references.
34. Update `README.md`, `docs/CONFIGURATION.md`, `docs/TOOL_INTEGRATION.md` with new commands (`role`, `decision`, `cleanup`, `audit`) + new config fields.
35. Update `cli/lib/help.mjs` with new command help text.

**Verification:** `node test/e2e-full-workflow.mjs` passes (expanded cases); `npm test` passes; `npm run lint` clean; `dev-harness help role` / `help decision` / `help cleanup` / `help audit` print usage.

---

## 3. Verification Matrix

| Gap IDs | Phase | Verification command | Expected |
|---------|-------|----------------------|----------|
| G1, G2 | 1 | `config set stackMeta.lintCmd "x"`; `config set phases.enabled --json-value '["x"]'` | exit 0, persisted |
| G7, G19, G23(schema) | 0 | `init --json` → inspect config.json + feature-list schema | new fields present |
| G12 | 2 | fresh `init` (no flags) → `config get gates.enabled` | `true` |
| G12 | 2 | `init --no-gates` → `config get gates.enabled` | `false` |
| G10 | 4 | `init --mode autopilot` → `config get retry.features.enabled` | `true` |
| G10 | 4 | `init` (copilot) → `config get retry.features.enabled` | `false` |
| G11 | 4 | inject feature→phase escalation → inspect `featureRetryCount` | resets to 0 |
| G5, G8 | 3 | `contract propose --scope "x"` (no criteria) | exit 2 or rejected |
| G7(gate) | 3 | `validate --feature --task` on task with empty `acceptanceCriteria` | fails `task-criteria` |
| G9 | 3 | REVIEW `validate` with rubric <N filled lines | fails `rubric-content` |
| G13, G14 | 5 | `phase next` → inspect `session-handoff.md` + `progress.md` | handoff overwritten, progress appended |
| G15 | 5 | `status --json` | includes `sessionState`, `progressTail`, `lessonsTail` |
| G17 | 5 | `validate` at session end with `console.log` present | fails `clean-state` |
| G18 | 5 | `dev-harness decision "x"` | appends to lessons-decisions.md |
| G20 | 6 | `dev-harness role generator` | sets currentRole, writes handoff, prints generator.md |
| G21 | 6 | `validate` with `currentRole=generator` | exit 1 ("requires evaluator") |
| G23(guard) | 6 | evaluator `validate` on task with `producedByRole=evaluator` | exit 1 ("self-eval guard") |
| G24 | 7 | `dev-harness cleanup --json` | reports staleArtifacts |
| G24 | 7 | `dev-harness audit --json` | lists active gates |
| All | 8 | `node test/e2e-full-workflow.mjs` | all pass |

---

## 4. Decisions & Scope

### Decisions

- **Three-file split (G13/G14/G18):** `session-handoff.md` (overwrite), `progress.md` (append-only), `lessons-decisions.md` (append-only, lesson→decision paired). Replaces current dual-structure `progress.md` + orphaned `session-handoff.md` + `docs/DECISIONS.md`. Each file has one lifecycle, one job.
- **Retry cascade (G10):** autopilot = cascade on by default (task 3× → feature 2× → phase 2× = 12 attempts before human); copilot = current behavior (human in loop). Lower task default to 3 when cascade active (legacy 10 made sense as only retry level; with 3 levels, 10 is excessive).
- **Gates default (G12):** flip to on by default with `--no-gates` escape hatch. Existing projects keep explicit `false`. Generic gates flip immediately; criteria gates wait on schema (Phase 0).
- **Criteria as lists (G5-G9):** all criteria fields (`acceptanceCriteria`, `definitionOfDone`, contract `## Verification Criteria`) are **lists** — a criterion is rarely single. Gate passes only when *all* items met.
- **Multi-agent = separate external sessions (G22):** backend-only branch can't spawn. Each role = separate external agent session. Harness enforces *what* (role separation, clean handoff, role gates); external tool provides *who*.
- **Session restart (G25):** fundamental backend limitation, not fixable in code. Documented: Hermes/OpenClaw get full enforcement via external shell loop; Claude Code/Cursor/Codex get partial (fresh context advisory, human-controlled).
- **Migration:** existing projects with explicit `gates.enabled=false` / `retry.features.enabled=false` keep their opt-out. Only new `init` runs get new defaults.

### Scope boundaries

**Included:**
- All 24 code gaps (G1-G24) + 1 informational gap (G25)
- Schema changes, gate additions, new commands (`role`, `decision`, `cleanup`, `audit`), config defaults, handover wiring, role framework, cleanup loop
- Test + docs updates

**Excluded:**
- Real external agent tool invocation (backend-only by design)
- TUI (removed on this branch)
- `run`/supervisor/agent-spawn (deliberately removed — "multi-agent" = separate external sessions, not harness-spawned)
- Publishing to npm
- Forced session restart for interactive tools (G25 — fundamental limitation, documented only)

### Dependency graph (summary)

```
Phase 0 (schema) ─┬─→ Phase 2 (gates default + anti-placeholder)
                   ├─→ Phase 3 (criteria gates) [needs P0 steps 1,3; needs P2]
                   ├─→ Phase 4 (retry defaults) [needs P2]
                   ├─→ Phase 5 (handover) [needs P0 step 5]
                   ├─→ Phase 6 (multi-agent) [needs P0 steps 2,3; needs P5 G13/G14/G17]
                   └─→ Phase 7 (cleanup/audit) [needs P0 step 4; needs P5]
Phase 1 (config/cli ergonomics) — parallel with Phase 0
Phase 8 (test/docs) — depends on all above
```

### Rollout order (minimum viable enforcement)

If a subset must ship first, the recommended order (from §11§B Part 5):
1. **Schema changes** (Phase 0) — `acceptanceCriteria`/`definitionOfDone` lists, `currentRole`, `producedByRole`, `gates.cleanState`/`antiPlaceholder`/`cleanup`
2. **Gates-on default + anti-placeholder** (Phase 2) — immediate enforcement win, no schema dependency
3. **Criteria gates** (Phase 3) — depends on schema
4. **Retry cascade defaults** (Phase 4) — depends on gates-on
5. **Handover wiring** (Phase 5) — independent, high value (dead code → live)
6. **Multi-agent framework** (Phase 6) — depends on handover + schema
7. **Cleanup/audit** (Phase 7) — independent, lower urgency
8. **Test/docs** (Phase 8) — final

**Net effect of full rollout:** a new autopilot project gets full 3-level cascade (12 attempts before human) with gates enforcing both generic + criteria checks at every level, live handoff at every boundary, role separation with self-eval guard, and periodic cleanup. A new copilot project gets gates-on-by-default with human-driven retry. Existing projects keep their explicit config. The harness moves from "permissive by default, enforcement opt-in" to "enforcement by default, permissive opt-out" — matching its stated purpose of bringing determinism to AI-assisted development.

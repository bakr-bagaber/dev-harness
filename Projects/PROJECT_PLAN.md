# Project Plan — dev-harness

Implementation breakdown from architecture plan to working CLI. Each task is designed to be built independently with clear verification criteria.

---

## Milestones

| Milestone | Tasks | Deliverable | Est. Effort |
|-----------|-------|-------------|-------------|
| M0: Foundation | T1–T5 | `harness-dev init` scaffolds all 15+ files | Medium |
| M1: Ralph Engine | T6–T9 | Inner/outer loops, state machine, progress.md | Large |
| M2: Phase Orchestration | T10–T13 | Phase commands, copilot/autopilot, gates | Large |
| M3: Depth Features | T14–T16 | Sprint contract, 3-agent templates, evaluator rubric | Medium |
| M4: Git Workflow Depth | T17–T18 | Worktree management, rollback/checkpoint | Medium |
| M5: Distribution | T19–T20 | Hermes skill wrapper, packaging | Medium |

---

## TASK T1 — CLI Skeleton

**Depends on:** Nothing  
**Files created:** `cli/harness-dev.mjs`, `cli/lib/args.mjs`, `cli/lib/errors.mjs`, `package.json`

**Goal:** Parseable CLI entry point. Any agent can call it and get machine-readable output.

**Design:**

```
Usage:
  harness-dev <command> [options]

Commands:
  init      Scaffold harness in current directory
  status    Show current phase + gate state (JSON output)
  phase     Invoke a phase by name
  validate  Run gate checks for current phase
  set-mode  Switch copilot/autopilot
  config    Get/set config values
  pause     Pause autopilot execution
  resume    Resume autopilot execution
  learn     Append a lesson to progress.md
  contract  Sprint Contract workflow (propose/review/status/escalate)
  worktree  Git worktree management (create/list/prune/remove)
  rollback  Checkpoint recovery (list/to/branch)
  checkpoint Manual checkpoint tagging (create)
  help      Alias for --help

Global flags:
  --json       Machine-parseable JSON output (for agents)
  --help       Show help
  --version    Show version

Exit codes:
  0 = success
  1 = validation failure
  2 = usage error
  3 = internal error
```

**Verification:**
```bash
node cli/harness-dev.mjs --help
# → Prints usage, exits 0

node cli/harness-dev.mjs --version
# → Prints semver, exits 0

node cli/harness-dev.mjs unknown
# → Prints "Unknown command", exits 2

node cli/harness-dev.mjs status --json
# → Prints {"phase":null,"mode":"copilot","gates":{}}, exits 0
```

**Key constraint:** Every command supports `--json` for machine parsing. Agents read JSON output, humans read formatted text.

**Standard JSON output contract (all commands, all future tasks):**
```json
{
  "command": "<command_name>",
  // command-specific fields (like "phase", "subcommand", etc.)
  "status": "ok" | "not_implemented" | "error",
  "message": "Human-readable status or error detail"
}
```
Every command MUST include `command`, `status`, and `message` in JSON output. Additional command-specific fields are encouraged but the three standard fields must always be present. Errors MUST go to stderr (not stdout) so stdout stays parseable.

**Additional T1 implementation details (implemented during audit):**
- A `help` command alias was added — `harness-dev help` is equivalent to `harness-dev --help`. Supports `--json`.
- All 13 command stubs use the standard JSON output contract above.
- Eslint (flat config) was added as a dev dependency. Config in `eslint.config.mjs`.
  Run with: `npm run lint` (or `npx eslint cli/`). Auto-fix with `npm run lint:fix`.

---

## TASK T2 — Stack Detection

**Depends on:** T1 (uses CLI skeleton)  
**Files created:** `cli/lib/detect-stack.mjs`, `cli/lib/schemas/stacks.json`

**Goal:** Intelligently detect project stack by scanning files.

**Detection rules (priority order — first match wins):**

| Stack | Detect By |
|-------|-----------|
| Python | `pyproject.toml`, `setup.py`, `requirements.txt`, `*.py` |
| Node | `package.json`, `tsconfig.json`, `*.js`/`*.ts` |
| Go | `go.mod`, `*.go` |
| Rust | `Cargo.toml`, `*.rs` |
| C | `*.c` (ext-only — build system not required per skill lesson #2) |
| C++ | `*.cpp`/`*.hpp`/`*.cc`/`*.cxx` (ext-only — build system not required) |
| VHDL | `*.vhdl`, `*.vhd` |
| Verilog | `*.v`, `*.sv` |
| Generic | Fallback — no matches |

**Verification:**
```bash
mkdir -p /tmp/test-c && echo "int main(){}" > /tmp/test-c/main.c
cd /tmp/test-c && node ../cli/harness-dev.mjs status --json
# → stack: "c"

mkdir -p /tmp/test-vhdl && echo "" > /tmp/test-vhdl/top.vhdl
cd /tmp/test-vhdl && node ../cli/harness-dev.mjs status --json
# → stack: "vhdl"
```

---

## TASK T3 — Template System

**Depends on:** T1, T2  
**Files created:** `templates/*.md` (one per harness file), `templates/init.sh.ejs`, `cli/lib/templates.mjs`, `cli/lib/vars.mjs`

**Goal:** Template system with stack-aware variable substitution.

**Variables injected per stack:**

```json
{
  "stack": "python",
  "testCmd": "python3 -m pytest",
  "lintCmd": "python3 -m ruff check",
  "typeCheckCmd": "python3 -m mypy",
  "buildCmd": "python3 -m build",
  "versionFile": ".python-version",
  "configFile": "pyproject.toml",
  "installCmd": "python3 -m pip install -e ."
}
```

Each stack has different defaults for verification commands. The template system substitutes these into AGENTS.md, init.sh, and other files.

**Design rules:**
- Templates are pure markdown with `{{VAR}}` substitution (no template engine dependency — simple regex replace)
- Each template has required variables documented at the top
- `init.sh` template generates executable shell scripts with stack-appropriate commands

**Verification:**
```bash
node cli/lib/templates.mjs --stack python --target /tmp/out
# → Creates AGENTS.md, init.sh, etc. with python commands in them
# → init.sh is executable
# → AGENTS.md contains "python3 -m pytest" not "npm test"
```

---

## TASK T4 — Scaffold Command

**Depends on:** T3 (templates), T2 (stack detection)  
**Files created:** `cli/commands/init.mjs`

**Goal:** `harness-dev init` creates all 15+ harness files with correct content.

**Files created:**
```
AGENTS.md
harness-config.json
feature_list.json
feature-list.schema.json
init.sh
progress.md
session-handoff.md
clean-state-checklist.md
evaluator-rubric.md
sprint-contract.md
ARCHITECTURE.md
CONSTRAINTS.md
DECISIONS.md
docs/api-patterns.md
<stack-config-file>  (pyproject.toml / package.json / Cargo.toml / CMakeLists.txt)
<stack-version-file> (.python-version / .nvmrc / rust-toolchain.toml)
```

**Scaffold rules:**
- Does NOT overwrite existing files unless `--force`
- Auto-creates `docs/` directory
- `init.sh` gets `chmod +x` applied
- Sets `feature_list.json` with one placeholder story (status: "not_started")
- Sets `progress.md` with initial Session State (phase: INIT) and empty Lessons Learned
- Sets `harness-config.json` with default `mode: "copilot"`
- **Runs `git init` if not already in a git repo** (skips with `--no-git` flag)
- **Creates initial commit** with message `"harness: initial scaffold"` if git repo was just initialized or is empty
- **Writes `.gitignore`** with common patterns for detected stack

**Verification:**
```bash
harness-dev init --stack python --target /tmp/test-project
ls /tmp/test-project
# → AGENTS.md, feature_list.json, init.sh, progress.md, ...
head -1 /tmp/test-project/init.sh
# → #!/usr/bin/env bash
test -x /tmp/test-project/init.sh
# → executable
```

---

## TASK T5 — Harness Config & State Machine

**Depends on:** T1 (CLI skeleton), T4 (files exist)  
**Files created:** `cli/lib/state.mjs`, `schema/harness-config.schema.json`, `schema/feature-list.schema.json`

**Goal:** Read/write harness state from `harness-config.json` and `progress.md`. Manages phase transitions deterministically.

**harness-config.json schema:**
```json
{
  "version": "1.0",
  "mode": "copilot",
  "currentPhase": null,
  "paused": false,
  "features": {
    "remaining": 0,
    "passing": 0,
    "total": 0
  },
  "gates": {
    "enabled": false,
    "checks": ["all"]
  },
  "git": {
    "enabled": false,
    "autoCommit": false,
    "autoTag": false,
    "resetOnRetry": false,
    "branch": null,
    "clean": true,
    "hasUpstream": false,
    "lastCommitMessage": null
  },
  "phases": {
    "enabled": ["define", "plan", "build", "verify", "review", "ship"]
  },
  "agents": {
    "tone": {
      "planner": "Analytical and precise. Define clear boundaries.",
      "generator": "Focused and practical. Build what's specified, nothing more.",
      "evaluator": "Skeptical and thorough. Accept only compelling evidence.",
      "simplifier": "Relentless about clarity. Delete more than you add."
    }
  },
  "maxRetries": 3,
  "gateHistory": []
}
```

**State transitions (not the phase pipeline — the meta-state):**

```
null → INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP → (complete)
```

SIMPLIFY phase is **only present if `phases.enabled` includes `"simplify"`**. By default it is absent. The transition skips directly from VERIFY to REVIEW when disabled.

Each transition:
1. **Git check first** — run `git diff --quiet` to verify clean state (except during INIT where repo may not exist yet). If dirty, print warning and offer to auto-commit with `git commit -am "harness: auto-commit before phase <phase>"`
2. Writes old phase gate results to `gateHistory` in config
3. Updates `currentPhase` in config
4. Updates `git.branch` in config via `git rev-parse --abbrev-ref HEAD`
5. Updates `git.clean` in config via `git diff --quiet && git diff --cached --quiet`
6. Writes new Session State section in `progress.md` (includes branch name + clean status)
7. If copilot mode: prints instructions for human to invoke next phase
8. If autopilot mode: automatically triggers next phase

**Verification:**
```bash
harness-dev status --json
# → {"currentPhase":null,"mode":"copilot","gateHistory":[]}

harness-dev phase define
# → Runs define phase inner loop
# → Updates config currentPhase: "define"
# → If copilot: prints "Define complete. Run: harness-dev phase plan"
```

---

## TASK T6 — progress.md Dual Structure Writer

**Depends on:** T5 (state machine)  
**Files created:** `cli/lib/progress.mjs`

**Goal:** Read/write the dual-structure progress.md consistently. Any agent can parse it.

**Write rules:**
- **Session State section** — always overwrites the top section. Uses these fields:
  ```markdown
  Current Phase: BUILD
  Current Feature: US-003 (token refresh)
  Gate Status: pending — 2 failing tests
  Next Action: fix test_auth.py assertions
  Retry Count: 2/3
  ```
- **Lessons Learned section** — always appends. Format:
  ```markdown
  2026-06-16 | Author | Lesson
  ```

**Read rules:**
- Parse Session State by scanning for `Current Phase:`, `Current Feature:`, `Gate Status:`, `Next Action:`
- Parse Lessons Learned by scanning for `\d{4}-\d{2}-\d{2} \|`
- Return structured JSON via `--json` flag
- If file missing or malformed, return empty state, print warning, exit 0

**Verification:**
```bash
harness-dev learn "Found gotcha in X middleware"
# → Appends line to Lessons Learned
# → Returns success

harness-dev status --json
# → {"phase":"build","feature":"US-003","gate":"pending","lessons":["..."]}
```

---

## TASK T7 — Gate Validation Engine

**Depends on:** T5 (state machine), T6 (progress.md)  
**Files created:** `cli/lib/gates.mjs`, `cli/commands/validate.mjs`

**Goal:** Two gate types that serve different purposes:

1. **Contract Gate** (Anthropic-style) — agent-to-agent negotiation before BUILD. Planner proposes scope + criteria in sprint-contract.md → Evaluator reviews → reject/revise/agree. This is a **subjective quality check**: "Is the design sound? Are the criteria specific enough?" Managed by T14 (Sprint Contract), not by CLI commands.

2. **Phase Gate** (our innovation) — deterministic shell commands at each phase boundary. Binary pass/fail from tool exit codes. This is an **objective correctness check**: "Does the code compile? Do tests pass? Is git clean?" Managed by `harness-dev validate`.

**Phase gates are disabled by default** — enable with `gates.enabled: true` in harness-config.json. When disabled, `harness-dev validate` prints "Gates disabled" and exits 0. The Contract Gate is always active (it's agent-to-agent, not CLI-controlled).

**Phase gate checks by phase — each check maps to a shell command:**

| Phase | Checks |
|-------|--------|
| **INIT** | `git rev-parse --git-dir` returns 0? `harness-config.json` exists? `feature_list.json` valid? `init.sh` executable? |
| **DEFINE** | `git symbolic-ref HEAD 2>/dev/null` returns a feature branch (not main)? */
| **PLAN** | `plan.json` valid JSON? tasks ≤1 context window? `git diff --quiet` (plan committed)? DAG acyclic? |
| **BUILD** | `git diff --quiet` (clean working tree)? lint passes? imports resolve? tests pass? feature_list.json updated? progress.md appended? |
| **VERIFY** | `git diff --quiet` (clean before tests)? full suite passes? coverage ≥80%? browser evidence recorded? |
| **SIMPLIFY** | `git diff --quiet` (clean after refactoring)? no dead code? no unused imports? no commented-out code? nesting ≤4 levels? |
| **REVIEW** | `git merge-base --is-ancestor main HEAD` (branch up-to-date)? evaluator approves? sprint contract met? |
| **SHIP** | `git status --porcelain` clean? `git describe --exact-match HEAD 2>/dev/null` (tagged)? rollback script exists? changelog updated? |

* INIT is skipped for git checks (repo is being created). DEFINE's ref check ensures we don't define features directly on main.

**Output format (--json):**

**Output format (--json):**
```json
{
  "phase": "build",
  "checks": [
    {"name": "lint", "pass": true, "detail": "ruff check — 0 errors"},
    {"name": "imports", "pass": false, "detail": "ModuleNotFoundError: auth/middleware.py"},
    {"name": "tests", "pass": true, "detail": "pytest — 47/47 pass"}
  ],
  "overall": false,
  "failures": ["imports"]
}
```

**Gate pass requires ALL features pass.** The inner loop iterates features/tasks — only when all features pass does the gate check run at phase level. No partial credit.

**Task-level validation:** `harness-dev validate --feature X --task Y` checks only that specific task's criteria (lint for that file, tests for that module). This is what the inner loop calls per iteration.

**Verification:**
```bash
harness-dev validate --json
# → {"phase":"build","overall":false,"checks":[...]}

harness-dev validate
# → "BUILD Gate: FAIL — 1/4 checks pass"
# → "  ❌ imports: ModuleNotFoundError in auth/middleware.py"
# → "  ✅ lint: 0 errors"
```

---

## TASK T8 — Inner Ralph Loop Engine

**Depends on:** T6 (progress.md), T7 (gates)  
**Files created:** `cli/lib/ralph-inner.mjs`

**Goal:** The inner loop runs in **every phase**. It retries until the unit of work passes. The unit of work depends on the phase type:

| Phase Type | Phases | Unit of Work | Loop Behavior |
|------------|--------|-------------|---------------|
| **Feature-iterate** | BUILD, VERIFY, SIMPLIFY | One incomplete feature (from feature_list.json) | Pick next feature → work → validate → pass=next / fail=retry → all features done → phase gate passes |
| **Deliverable-retry** | INIT, DEFINE, PLAN, REVIEW, SHIP | One deliverable (harness files, PRD, plan.json, review report, release) | Work on deliverable → validate → pass=done / fail=retry same deliverable |

**Both modes follow the same pattern: work → validate → pass or retry.** The only difference is what the loop body picks on each iteration — a new feature or the same deliverable.

**Validation granularity:**
- Feature-iterate phases: `harness-dev validate --feature <name> --task <id>` — checks one task
- Deliverable-retry phases: `harness-dev validate` — checks the deliverable against phase criteria

**Algorithm (both modes):**

```
1. Identify current phase from harness-config.json
2. Determine loop mode from phase type:
   
   FEATURE-ITERATE mode (BUILD, VERIFY, SIMPLIFY):
   
     For each feature in feature_list.json where passes=false:
       For each uncompleted task in feature's task list:
         a. Git freshness reset (if git.resetOnRetry is true)
         b. Read progress.md + AGENTS.md
         c. Print task instructions:
            "<PHASE> — Feature: <name> — Task: <description>
             Planner: scope of this task
             Generator: implement/test/simplify
             Evaluator: verify against acceptance criteria
             Run: harness-dev validate --feature <name> --task <id>"
         d. Agent works on this single task
         e. Run task validation:
            harness-dev validate --feature <name> --task <id>
            (skip if gates.enabled is false)
         f. If passes → mark task complete, continue to next task
         g. If fails (≤ maxRetries times):
            - Append lesson to progress.md
            - Git auto-commit (if git.autoCommit is true)
            - Retry from step (a) with fresh context
         h. If fails > maxRetries times → escalate to human
       All tasks pass → mark feature passes=true in feature_list.json
     All features pass → phase gate passes → outer loop advances
   
   DELIVERABLE-RETRY mode (INIT, DEFINE, PLAN, REVIEW, SHIP):
   
     a. Git freshness reset (if git.resetOnRetry is true)
     b. Read progress.md + AGENTS.md
     c. Print phase instructions:
        "<PHASE>: produce the deliverable
         Planner: define scope of this deliverable
         Generator: produce it
         Evaluator: verify against phase criteria
         Run: harness-dev validate"
     d. Agent produces the deliverable
     e. Run phase validation:
        harness-dev validate
        (skip if gates.enabled is false)
     f. If passes → phase gate passes → outer loop advances
     g. If fails (≤ maxRetries times):
        - Append lesson to progress.md
        - Git auto-commit (if git.autoCommit is true)
        - Retry from step (a) with fresh context
     h. If fails > maxRetries times → escalate to human
```

**Key difference from previous design:** The loop no longer retries the entire phase — it retries individual tasks. This is more resource-efficient (a failing lint on one task doesn't redo completed tasks) and matches the Ralph/walkinglabs pattern of "one feature at a time."

**Key design:** The engine does NOT implement the work itself. It prints clear instructions for the agent. The agent reads the instructions, does the work, then calls `harness-dev validate` to check. This makes it tool-agnostic — any agent can follow the printed instructions.

**Why the git reset matters:** Without step 1, the agent inherits artifacts from the previous iteration — failed test outputs, half-edited files, junk in `node_modules`. The fresh git state guarantees each iteration is a genuine retry, not an accumulation of garbage. This is what Ralph calls "fresh context" and it's the single most important implementation detail of the entire harness.

**Loop guard:** Max iterations = 10 per phase (configurable). After 10 failures, escalate to human.

**Verification:**
```bash
# Simulate a phase with failing gates
harness-dev phase build
# → "BUILD phase started."
# → "Gate: FAIL — imports failing"
# → "Iteration 1/10"
# → "Please fix: ModuleNotFoundError in auth/middleware.py"
```

---

## TASK T9 — Outer Ralph Loop Engine

**Depends on:** T8 (inner loop — handles all task/feature/deliverable iteration)  
**Files created:** `cli/lib/ralph-outer.mjs`

**Goal:** The outer loop only advances phases. It does NOT iterate tasks or features — that's entirely the inner loop's job. The outer loop's job is to move through the pipeline in order, calling the inner loop at each phase.

**Copilot mode (default):**
The outer loop is conceptually trivial — it runs one phase and exits. The human decides when to start the next phase:
```
harness-dev phase define   → inner loop runs DEFINE → gate passes → exit
harness-dev phase plan     → inner loop runs PLAN → gate passes → exit
...human decides when to continue...
```

**Autopilot mode:**
The outer loop auto-advances through all phases. After each phase gate passes, it immediately starts the next phase without waiting for human input.

**Algorithm (autopilot):**
```
1. Git freshness reset — only if `git.resetOnRetry` is true
2. Read progress.md + AGENTS.md
3. Execute the ordered phase pipeline:
   INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP
   (Skip SIMPLIFY if not in phases.enabled)
4. At each phase:
   a. Run inner loop (T8) which handles all task/feature/deliverable iteration
   b. Inner loop returns: PASSED (all work complete) or ESCALATED (human needed)
   c. If PASSED → advance currentPhase in config
   d. If ESCALATED → stop, print reason, wait for human resolution
5. All phases complete → one full pipeline iteration finished
6. Tag iteration (if git.autoTag is true)
7. Append lessons to progress.md
8. If features remain → repeat from step 1
9. If all features passing → print "All features complete!"

**In copilot mode:** After each phase gate passes, print "Phase X complete. Run: harness-dev phase <next>" and stop. Does NOT auto-advance.

**In autopilot mode:** After each phase gate passes, automatically call `harness-dev phase <next>`.

**Verification:**
```bash
harness-dev set-mode autopilot
harness-dev phase define
# → Planner designs outer loop in DEFINE phase
# → Autopilot: auto-advances to PLAN after gate passes
# → Autopilot: auto-advances to BUILD after gate passes
# → ... continues through SHIP
# → Prints: "Pipeline iteration complete. 3 features remaining."
```

---

## TASK T10 — Phase Command Orchestrator

**Depends on:** T8 (inner loop), T9 (outer loop)  
**Files created:** `cli/commands/phase.mjs`

**Goal:** Unified `harness-dev phase <name>` command that:
1. Loads phase configuration (what checks, what agents do)
2. Runs inner Ralph loop
3. In copilot mode: prints next phase instruction and exits
4. In autopilot mode: chains to next phase automatically
**Phase instructions printed to agent — two formats depending on phase type:**

**Format 1: Deliverable-retry phases (DEFINE, PLAN, REVIEW, SHIP)** — the agent produces one deliverable, validates it, retries if needed:
```
═══ DEFINE PHASE ═══

This is a deliverable-retry phase. You produce one deliverable.
If validation fails (up to {maxRetries} attempts), retry with fresh context.

Planner: interview the user, write PRD in specs/*.md, 
         define acceptance criteria per feature

Generator: produce spec documents (specs/*.md, 
           sprint-contract.md) following the PRD

Evaluator: verify against these criteria:
  - All 5 spec sections present (overview, requirements, 
    acceptance criteria, edge cases, open questions)
  - No TODO/FIXME placeholders in specs
  - Sprint Contract agreed between Planner and Evaluator

When done, run: harness-dev validate
```

**Format 2: Feature-iterate phases (BUILD, VERIFY, SIMPLIFY)** — the agent works on one feature/task at a time, iterating through the feature list:
```
═══ BUILD PHASE ═══

This is a feature-iterate phase. You pick one incomplete 
feature at a time. If validation fails (up to {maxRetries} 
attempts), retry that task with fresh context.

Planner: pick next feature from feature_list.json where passes=false
         Select one uncompleted task from that feature's task list

Generator: implement ONE task only. When done, call validate.

Evaluator: verify against that task's acceptance criteria.
           Run the verification commands yourself.

Iteration pattern:
  Pick task → implement → validate --feature <name> --task <id>
  → Pass: mark task complete, pick next task
  → Fail (≤{maxRetries}x): git auto-commit, retry with fresh context
  → Fail (>{maxRetries}x): escalate to human
```

**SIMPLIFY phase instructions** — uses feature-iterate format:
```
═══ SIMPLIFY PHASE ═══

This is a feature-iterate phase. Pick one feature at a time.

Planner: identify code smells, excessive nesting, 
         DRY violations, premature optimization
         Set targets: "flatten nested loop X", 
         "extract validation logic from controller Y"

Simplifier (Generator persona): refactor code for clarity
  - Extract repeated logic into shared functions
  - Flatten nested conditionals (max 4 levels)
  - Remove dead code and commented-out blocks
  - Rename unclear variables
  - Break functions exceeding ~40 lines
  - ⚠ Never change behavior — tests must still pass

Evaluator: verify against these criteria:
  - No dead code or unused imports
  - No commented-out code blocks
  - No nesting beyond 4 levels
  - No DRY violations (same logic repeated 3+ times)
  - All tests still pass after refactoring

Iteration: validate --feature <name> → pass → next feature
                                   → fail → retry (≤maxRetries)
                                   → fail → escalate
```

**Verification:**
```bash
harness-dev phase define
# → Prints DEFINE phase instructions
# → Agents work → user/agent runs `harness-dev validate`
# → Gate passes → prints "DEFINE complete. Next: harness-dev phase plan"
```

---

## TASK T11 — Copilot Mode

**Depends on:** T10 (phase orchestrator)  
**Files created:** `cli/lib/modes.mjs`, `cli/commands/set-mode.mjs`

**Goal:** Copilot mode where human invokes each phase and reviews gates.

**Behavior:**
- `harness-dev set-mode copilot` (default on init)
- Phase runs when invoked: `harness-dev phase <name>`
- Inner loop runs autonomously
- Gate result printed for human review
- Human decides to advance: `harness-dev phase <next>`
- Auto-prompt: if gate passes, print "Advance to <next>? (y/n)"
  - If `y` → runs next phase
  - If `n` → stays in current phase
- Mid-phase intervention: human can run any terminal command, edit files, then call `harness-dev validate` again

**Config in harness-config.json:**
```json
{
  "mode": "copilot",
  "copilot": {
    "autoPrompt": true,
    "confirmGates": true
  }
}
```

**Verification:**
```bash
harness-dev set-mode copilot
harness-dev phase build
# → Runs build phase, prints gate result
# → "BUILD gate: PASS. Advance to VERIFY? (y/n)"
human: y
# → Runs VERIFY phase
```

---

## TASK T12 — Autopilot Mode

**Depends on:** T10 (phase orchestrator), T11 (copilot as base)  
**Files created:** (extends T11 — same modes.mjs)

**Goal:** Fully autonomous mode after DEFINE phase. Agents run the entire outer loop.

**Behavior:**
- `harness-dev set-mode autopilot`
- Must be in DEFINE phase or later
- In DEFINE: Planner designs full outer loop (feature order, gate criteria per phase)
- After DEFINE gate passes: agents auto-advance through PLAN→BUILD→VERIFY→SIMPLIFY→REVIEW→SHIP
- Human notified only at:
  - Gate failures (with escalation after 3×)
  - Pipeline iteration complete
  - All features complete
- Pause/resume: `harness-dev pause` → outer loop stops after current phase gate
- In DEFINE phase, Planner writes `plans/outer-loop-plan.md` with:
  - Feature delivery order
  - Estimated iterations per feature
  - Risk factors and escalation thresholds

**Verification:**
```bash
harness-dev set-mode autopilot
harness-dev phase define
# → Planner writes outer-loop-plan.md
# → Gate passes → auto-advances to PLAN
# → ... continues through SHIP
# → "Pipeline complete. 3 features remaining."
# → "Outer loop will repeat. Next: DEFINE (iteration 2)"
# → human can `harness-dev pause` anytime
```

---

## TASK T13 — Progress Reading (status command)

**Depends on:** T6 (progress.md writer), T5 (state machine)  
**Files created:** `cli/commands/status.mjs`

**Goal:** Human-readable + machine-parseable status report. This is what agents call to understand current state.

**Output (human):**
```
═══ dev-harness Status ═══
Project: ~/projects/my-app
Stack: Python
Mode: Copilot

Current Phase: BUILD
Current Feature: US-003 (token refresh)
Gate Status: pending — 2/4 checks passing

Last 3 lessons:
  2026-06-16 | Token refresh gotcha found
  2026-06-16 | Rate limiter conflict with refresh path
  2026-06-15 | pytest-asyncio needed for async views

Run: harness-dev validate to re-check
```

**Output (--json):**
```json
{
  "project": "my-app",
  "stack": "python",
  "mode": "copilot",
  "currentPhase": "build",
  "currentFeature": "US-003",
  "gateStatus": "pending",
  "checksPassing": 2,
  "checksTotal": 4,
  "recentLessons": [
    "Token refresh gotcha found",
    "Rate limiter conflict with refresh path"
  ],
  "nextAction": "harness-dev validate"
}
```

**Verification:**
```bash
harness-dev status
# → Formatted table

harness-dev status --json
# → Machine-parseable JSON (exit 0)
```

---

## TASK T14 — Sprint Contract Template + Validation

**Depends on:** T4 (scaffold creates sprint-contract.md), T7 (gates)  
**Files created:** `templates/sprint-contract.md`, `cli/lib/contract.mjs`

**Goal:** The pre-build verification agreement. Generator proposes, Evaluator reviews, iterates until agreement. The negotiation loop is: **propose → review → reject/revise → re-propose → repeat until "Agreed"**.

**Negotiation process (handled by the agents, not the CLI):**
```
1. Planner proposes:
   - Scope: "I will build X, Y, Z. I will NOT build W."
   - Verification criteria: "Test A, Test B, lint check"
   
2. Evaluator reviews:
   - Is scope bounded? (no vague terms like "improve", "enhance")
   - Are criteria specific? (must be runnable commands, not "looks good")
   - Are exclusions reasonable?
   
3. If Evaluator rejects → feedback to Planner:
   - "Scope X is ambiguous — specify what 'optimize' means"
   - "Criteria Y is untestable — replace with a concrete test"
   
4. Planner revises and re-submits:
   - Returns to step 2
   
5. Max 5 negotiation rounds. After 5, escalate to human adjudication.
```

**The CLI supports negotiation with one command:**
- `harness-dev contract propose` — writes/updates sprint-contract.md with Planner's proposal
- `harness-dev contract review` — Evaluator reviews and sets status (Agreed / Needs Revision)
- `harness-dev contract status` — shows current contract state (pending / in-negotiation / agreed / rejected)
- `harness-dev contract escalate` — human adjudication when agents can't agree

**Template structure:**
```markdown
# Sprint Contract — [Feature Name]

## Scope (Generator proposes)
I will build: [clear statement of what will be built]
I will NOT build: [explicit exclusions]

## Verification Criteria (Generator proposes)
1. [Specific test or command to verify]
2. [Specific test or command to verify]

## Evaluator Review (Evaluator fills in)
- [ ] Scope is clear and bounded: [yes/no — if no, explain]
- [ ] Verification criteria are sufficient: [yes/no — if no, explain]
- [ ] Exclusions are reasonable: [yes/no — if no, explain]

## Agreement Status: [Agreed / Needs Iteration]
```

**Validation rules:**
- Scope must be clear (no ambiguous language like "improve", "enhance", "optimize")
- Verification criteria must be specific commands or tests (not "looks good")
- Evaluator must explicitly approve each dimension
- Contract must be "Agreed" before BUILD gate can pass

**Verification:**
```bash
harness-dev validate --json
# → If DEFINE phase: checks sprint-contract.md exists and is "Agreed"
# → If BUILD phase without agreed contract: gate fails
```

---

## TASK T15 — 3-Agent Templates

**Depends on:** T4 (scaffold)  
**Files created:** `templates/AGENTS.md` (TOC-style, ~100 lines), `templates/docs/agents/planner.md`, `templates/docs/agents/generator.md`, `templates/docs/agents/evaluator.md`, `templates/docs/agents/simplifier.md`

**Goal:** AGENTS.md template that acts as a **table of contents** (~100 lines). No inline procedure. Pointers only. Follows OpenAI's progressive disclosure principle — the agent reads AGENTS.md to understand the project structure, then deep-dives into `docs/agents/` for role-specific instructions.

**AGENTS.md template:**
```markdown
# [Project Name] — Harness

## Quick Start
```bash
harness-dev status        # Where are we?
harness-dev phase <name>  # Invoke a phase
harness-dev validate      # Check gate criteria
```

## Project
- **Stack:** {detected_stack}
- **Mode:** {mode}
- **Phase:** {current_phase}

## Phase Pipeline
```
INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP
```
See `docs/phases/` for phase-specific instructions.

## Agent Roles
| Role | File | Tone |
|------|------|------|
| Planner | `docs/agents/planner.md` | Analytical, precise. Define clear boundaries |
| Generator | `docs/agents/generator.md` | Focused, practical. Build what's specified |
| Evaluator | `docs/agents/evaluator.md` | Skeptical, thorough. Accept only compelling evidence |
| Simplifier | `docs/agents/simplifier.md` | Relentless about clarity. Delete more than you add |

## Key Files
| File | Purpose |
|------|---------|
| `harness-config.json` | Config + state |
| `feature_list.json` | Feature list with passes |
| `progress.md` | Session state + lessons |
| `sprint-contract.md` | Pre-build agreement |
| `init.sh` | Install → verify → start |

## Rules (non-negotiable)
1. No agent evaluates its own work — Evaluator always judges
2. Read progress.md + AGENTS.md before each operation
3. Commit frequently — each iteration is a checkpoint
4. If unsure → read the role guide in `docs/agents/`
5. Never skip gates — run `harness-dev validate` after each phase
```

**Role guide templates — each < 50 lines, focused on tone + process:**

`docs/agents/planner.md`:
```markdown
# Planner Role
Tone: Analytical and precise. Define clear boundaries.

You design the approach. You write criteria. You set scope.
- Propose what to build in sprint-contract.md
- Define unambiguous acceptance criteria
- Set exclusions explicitly ("We will NOT build X")
- Hand off to Generator when criteria are clear
```

`docs/agents/generator.md`:
```markdown
# Generator Role
Tone: Focused and practical. Build what's specified.

You implement. You produce artifacts. You self-check.
- Build exactly what the Planner specified
- Do not add scope or "future-proof"
- Run lint + tests before handoff
- During SIMPLIFY phase, adopt the Simplifier persona
```

`docs/agents/evaluator.md`:
```markdown
# Evaluator Role
Tone: Skeptical and thorough. Accept only compelling evidence.

You verify. You gate. You are the final authority.
- Do NOT trust "seems right" — require proof
- Run the verification commands yourself
- If criteria are ambiguous, reject with specific reason
- "Pass" means all checks pass; "Fail" means at least one check is insufficient
```

`docs/agents/simplifier.md`:
```markdown
# Simplifier (Generator Persona for SIMPLIFY Phase)
Tone: Relentless about clarity. Delete more than you add.

You refactor. You clean. You never change behavior.
- Flatten nesting — max 4 levels
- Remove dead code and commented-out blocks
- Extract repeated logic into shared functions
- Break long functions (~40 line threshold)
- ⚠ All tests must still pass after your changes
```

**Verification:**
```bash
# AGENTS.md is ~100 lines
wc -l output/AGENTS.md  # Should be < 120
# All role guides exist
ls output/docs/agents/  # planner.md generator.md evaluator.md simplifier.md
```

---

## TASK T17 — Worktree Management (OpenAI Pattern)

**Depends on:** T5 (state machine — tracks current branch)  
**Files created:** `cli/commands/worktree.mjs`, `scripts/clean-worktrees.sh`

**Goal:** Git worktree isolation per feature. Each feature gets its own directory — no cross-contamination of dependencies or state.

**Commands:**
- `harness-dev worktree create <feat-name>` → `git worktree add ../feat-<name> feat/<name>` and scaffolds harness skeleton
- `harness-dev worktree list` → lists active worktrees with branch, path, phase
- `harness-dev worktree prune` → `git worktree prune`, removes orphaned worktrees
- `harness-dev worktree remove <feat-name>` → cleans up worktree, optionally merges branch first

**Integration:**
- `harness-dev init --worktree` flag: create a new worktree instead of modifying in-place
- DEFINE phase: `harness-dev phase define --worktree feat-auth` creates worktree + branch
- Each worktree gets its own `harness-config.json`, `progress.md`, `feature_list.json`
- Gate checks: `harness-dev validate` should detect if running inside a worktree (via `git rev-parse --git-common-dir`)
- `scripts/clean-worktrees.sh` — cron job to prune stale worktrees after branches merge

**Verification:**
```bash
harness-dev worktree create feat-auth
# → Creates ../feat-auth with harness initialized, branch feat/auth
harness-dev worktree list
# → Lists worktrees
cd ../feat-auth && harness-dev status
# → Shows correct branch and isolated state
```

---

## TASK T18 — Rollback & Branch Recovery (Anthropic Middle Iterations)

**Depends on:** T9 (outer loop tags iterations), T10 (phase orchestrator)  
**Files created:** `cli/commands/rollback.mjs`, `cli/commands/checkpoint.mjs`

**Goal:** Support Anthropic's "middle iteration" pattern — the user can stop progress and recover a previous iteration. Also supports full feature rollback.

**The problem:** Anthropic observed that the best version is often not the last one. An agent can degrade its own work on subsequent iterations. The user needs to say "iteration 3 was better — go back there."

**Commands:**
- `harness-dev rollback list` → show available checkpoints (iteration tags + phase commits)
- `harness-dev rollback to <checkpoint>` → `git checkout <checkpoint>` and restore harness state files from that point
- `harness-dev rollback branch <checkpoint>` → create a recovery branch: `git checkout -b recovery/<name> <checkpoint>`
- `harness-dev checkpoint create <label>` → force a manual checkpoint: `git tag -a manual/<label> -m "checkpoint: <label>"`

**How it works:**
1. Each phase commit is tagged: `phase/define`, `phase/plan`, `phase/build`, etc. (if `git.autoTag` is enabled)
2. Each iteration commit is tagged: `iter/N` (if `git.autoCommit` is enabled)
3. Manual checkpoints: `harness-dev checkpoint create "before-refactor"`
4. `rollback list` reads all these tags and presents them chronologically
5. `rollback to iter/5` checks out the git state AND restores harness-config.json, progress.md, feature_list.json from that commit
6. `rollback branch iter/5` creates `git checkout -b recovery/from-iter-5 iter/5`

**Middle iteration workflow:**
```
User: "I prefer iteration 3."
Agent: harness-dev rollback branch iter/3
       → Creates branch recovery/from-iter-3 at the iter/3 commit
       → Continue working on recovery branch
       → If better, merge back to feature branch
```

**Verification:**
```bash
harness-dev rollback list
# → Shows checkpoint: phase/verify, 2026-06-17
harness-dev rollback to phase/verify
# → Restores state to VERIFY gate pass, resets phase in config
harness-dev status
# → phase: verify
```

---

## TASK T16 — Evaluator Rubric Template

**Depends on:** T4 (scaffold)  
**Files created:** `templates/evaluator-rubric.md`

**Goal:** Quality scorecard template with 6 dimensions scored 0-2.

**Template structure:**
```markdown
# Evaluator Rubric

Score each dimension 0-2:
  0 = Unacceptable (blocker — must fix)
  1 = Acceptable with minor issues
  2 = Excellent (no issues)

| Dimension | Score | Evidence | Notes |
|-----------|-------|----------|-------|
| **Correctness** | 0-2 | [test results] | Does it work? |
| **Test Coverage** | 0-2 | [coverage report] | ≥80%? |
| **Code Quality** | 0-2 | [lint/output] | Clean? Idiomatic? |
| **Security** | 0-2 | [scan results] | Vulnerabilities? |
| **Performance** | 0-2 | [benchmarks] | Regressions? |
| **Handoff Readiness** | 0-2 | [docs updated] | Next agent can continue? |

**Thresholds:**
- 10-12: Accept (pass gate)
- 5-9: Revise (fix issues, re-check)
- 0-4: Block (escalate to human)
```

---

## Stack Support: C/C++ and HDL (Completed — absorbed into T2/T4)

**C/C++ and HDL stack support was already implemented as part of T2 (stack detection)**
**and T4 (scaffold command). The earlier numbering (T17/T18 for stacks) conflicted with**
**the Worktree Management (T17) and Rollback (T18) tasks. These are now recorded here**
**for reference only.**

**C detection:** ✅ `.c` files → detected, `CMakeLists.txt` generated, `ctest` + `gcc -Wall -Wextra` verification commands
**C++ detection:** ✅ `.cpp`/`.hpp`/`.cc`/`.cxx` files → detected, `CMakeLists.txt` generated, `ctest` + `clang++ -Wall -Wextra` verification commands
**VHDL detection:** ✅ `.vhdl`/`.vhd` files → detected, simulator-agnostic `ghdl` commands
**Verilog detection:** ✅ `.v`/`.sv` files → detected, `iverilog`-based commands

**Files implemented:**
- `cli/lib/detect-stack.mjs` — detection rules (C #7, C++ #8, VHDL #11, Verilog #12)
- `cli/lib/schemas/stacks.json` — full metadata with lintCmd, testCmd, buildCmd, installCmd
- `cli/commands/init.mjs` — `STACK_CONFIG_STUBS` with CMakeLists.txt, .gitignore patterns, version files
- `templates/AGENTS.md` — correct stack-specific commands in Development Commands table
- `templates/init.sh` — correct install/lint/test commands per stack

**init.sh template (C):**
```bash
#!/usr/bin/env bash
INSTALL_CMD="apt-get install -y build-essential cmake 2>/dev/null || \
             brew install cmake 2>/dev/null || \
             echo 'Install build-essential and cmake manually'"
VERIFY_CMD="mkdir -p build && cd build && cmake .. && make && ctest --output-on-failure"
START_CMD="echo 'No dev server — compile and run: ./build/bin/myapp'"
```

**init.sh template (VHDL):**
```bash
#!/usr/bin/env bash
INSTALL_CMD="apt-get install -y ghdl 2>/dev/null || \
             brew install ghdl 2>/dev/null || \
             echo 'Install GHDL from https://github.com/ghdl/ghdl'"
VERIFY_CMD="ghdl -a --std=08 src/*.vhdl && \
            ghdl -e $(head -1 spec/entity.txt) && \
            ghdl -r $(head -1 spec/entity.txt) --assert-level=error"
START_CMD="echo 'No dev server — run testbench: ghdl -r <entity> --vcd=wave.vcd'"
```

---

## TASK T19 — Hermes Skill Wrapper

**Depends on:** All CLI tasks (T1–T18)  
**Files created:** `hermes/skill/dev-harness/SKILL.md`, `hermes/skill/dev-harness/scripts/*.mjs`

**Goal:** Optional Hermes skill that wraps the standalone CLI for Hermes-native users.

**Structure:**
```
hermes/skill/dev-harness/
├── SKILL.md          # Skill metadata + usage
├── scripts/
│   ├── init.mjs       # Calls ../cli/harness-dev.mjs init
│   ├── phase.mjs      # Calls ../cli/harness-dev.mjs phase
│   └── validate.mjs   # Calls ../cli/harness-dev.mjs validate
└── templates/         # Symlinks to ../../cli/templates/
```

**SKILL.md trigger:**
```markdown
# dev-harness

Triggers on: "harness-dev", "harness init", "harness scaffold", "new project"

Actions:
- `harness-dev init` — Scaffold harness in current project
- `harness-dev phase <name>` — Run a phase
- `harness-dev status` — Show current state
```

---

## TASK T20 — CLI Packaging & Distribution

**Depends on:** All CLI tasks  
**Files created:** `dist/install.sh`, `package.json` (publish), `README.md` (final)

**Goal:** Make CLI installable with a one-liner. No npm required.

**Install methods:**
1. **npm global:** `npm install -g @dev-harness/cli`
2. **One-liner:** `curl -fsSL https://dev-harness.dev/install.sh | bash`
3. **Manual:** Download binary from GitHub Releases
4. **npx:** `npx @dev-harness/cli init`

**install.sh design:**
```bash
#!/usr/bin/env bash
# Detects OS + arch
# Downloads latest release binary from GitHub
# Installs to /usr/local/bin/harness-dev
# Prints usage
```

**README.md sections:**
- Quick start (one-liner installation)
- Usage by example
- Agent integration (Claude Code, Codex, Cursor, OpenCode, Copilot)
- Stack reference
- API reference (all commands + JSON output)
- Project structure reference

---

## Task Dependency Graph

```
T1 (CLI skeleton)
├── T2 (stack detection)
│   ├── T3 (template system)
│   │   ├── T4 (scaffold command)
│   │   │   ├── T5 (config + state machine)
│   │   │   │   ├── T6 (progress.md writer)
│   │   │   │   │   ├── T7 (gate engine)
│   │   │   │   │   │   ├── T8 (inner Ralph loop)
│   │   │   │   │   │   │   ├── T9 (outer Ralph loop)
│   │   │   │   │   │   │   └── T10 (phase orchestrator)
│   │   │   │   │   │   │       ├── T11 (copilot mode)
│   │   │   │   │   │   │       └── T12 (autopilot mode)
│   │   │   │   │   │   └── T13 (status command)
│   │   │   │   │   ├── T14 (sprint contract)
│   │   │   │   │   ├── T15 (3-agent templates)
│   │   │   │   │   └── T16 (evaluator rubric)
│   │   │   │   ├── T17 (worktree management)
│   │   │   │   └── T18 (rollback & checkpoint)
│   │   │   └── T19 (Hermes skill wrapper)
│   │   └── T20 (packaging + distribution)
```

---

## Build Order

| Step | Tasks | Why This Order |
|------|-------|----------------|
| 1 | T1 | Need a working CLI to test anything |
| 2 | T2, T3 | Need detection + templates before scaffold |
| 3 | T4 | Scaffold creates all files — core milestone |
| 4 | T5, T6, T7 | Config, progress, gates — state machinery |
| 5 | T8, T9, T10 | Inner/outer loops + phase command — the engine |
| 6 | T11, T12, T13 | Modes + status — the user-facing controls |
| 7 | T14, T15, T16 | Contracts, agents, rubric — depth features |
| 8 | T17, T18 | Worktree management, rollback/checkpoint — git workflow depth |
| 9 | T19 | Hermes wrapper — platform integration |
| 10 | T20 | Packaging — distribution |

---

## How Any Agent Tool Uses the CLI

**Claude Code:**
```bash
# Inside your project
harness-dev init --stack python
cat AGENTS.md  # Claude reads this automatically
# Claude follows the phase instructions naturally
```

**Codex CLI:**
```bash
harness-dev init --stack go
# Codex reads AGENTS.md from the project
# Uses harness-dev status --json to understand current state
```

**Cursor:**
```bash
harness-dev init --stack rust
# .cursorrules can include: "Check project state with: harness-dev status"
```

**OpenCode:**
```bash
harness-dev init --stack cpp
# CLAUDE.md gets generated with harness commands
```

**Generic (any agent):**
```bash
harness-dev phase build
# → Prints clear instructions any agent can follow
# → Agent reads AGENTS.md + progress.md + sprint-contract.md
# → Agent implements → calls `harness-dev validate`
# → Gate passes → `harness-dev phase verify`
```

---

## Git Integration

Git is the backbone every phase runs on — not a phase itself.

### Phase-by-Phase Git Roles

| Phase | Git Role | Key Actions |
|-------|----------|------------|
| **INIT** | Foundation | `git init`, create `main`, initial commit of harness files. Gate requires valid git repo |
| **DEFINE** | Branch creation | `git checkout -b feat/<name>`. Commit spec docs. Gate requires feature branch (not main) |
| **PLAN** | Lock plan | Commit `plan.json` + DAG. Plan becomes immutable reference point |
| **BUILD** | Iteration commits | Each Ralph iteration commits. Gate requires clean `git diff --quiet` |
| **VERIFY** | Clean state tests | `git stash` before tests. Tag test evidence commits |
| **SIMPLIFY** | History cleanup | Interactive rebase to squash WIP commits. Review diff per commit |
| **REVIEW** | Diff review | `git diff main...feat/xxx`. Gate requires branch is up-to-date with main |
| **SHIP** | Release | Merge to main. Tag release (`v1.2.3`). Create rollback reference |

### Key Git Patterns

**Worktree isolation (OpenAI):** `git worktree add ../feat-auth feat/auth` — each feature in isolated directory. No cross-contamination.

**Clean state as gate:**
```bash
git diff --quiet && git diff --cached --quiet
```
If dirty → gate fails. Prevents evaluating half-finished work.

**Rollback protocol:**
- Each release gets annotated tag
- `scripts/rollback.sh` runs `git revert <tag>..HEAD` or `git checkout <previous-tag>`
- Must be tested (dry-run) during SHIP gate validation

### Gate Checks Across All Phases

```
INIT:      git rev-parse --git-dir → repo exists
DEFINE:    git symbolic-ref HEAD → not on main
BUILD:     git diff --quiet → clean working tree
VERIFY:    git diff --quiet → clean before tests
REVIEW:    git merge-base --is-ancestor main HEAD → up-to-date
SHIP:      git status --porcelain → clean. git describe --exact-match → tagged
```

---

## TASK T21 — Documentation Site Scaffolding

**Depends on:** T4 (scaffold), T3 (templates)
**Files created:** `docs-site-templates/docusaurus/`, `docs-site-templates/sphinx/`

**Goal:** Template scaffolding for documentation sites (Docusaurus 3 or Sphinx/ReadTheDocs), placed in `docs-site-templates/` outside the main `templates/` to prevent `.js` files from polluting project stack detection.

**Migration note:** Files were originally at `templates/docs-site/` but moved to `docs-site-templates/` during T25 cleanup. The `--docs` CLI flag is not yet wired — templates are available for manual deployment. To activate, symlink or copy the desired template into your project.

**Docusaurus scaffold:**
- `docs-site/docusaurus.config.js` — Docusaurus 3 config with project name
- `docs-site/sidebars.js` — auto-generated sidebar
- `docs-site/src/pages/index.js` — landing page
- `docs-site/docs/` — symlinked to project `docs/`

**Sphinx/ReadTheDocs scaffold:**
- `docs-site/source/conf.py` — Sphinx config with HTML + RTD theme
- `docs-site/source/index.rst` — root toctree
- `docs-site/Makefile` — `make html`, `make serve`

**Verification:**
```bash
harness-dev init --docs docusaurus --target my-project
ls my-project/docs-site/  # → docusaurus.config.js, sidebars.js, src/, docs/
```

---

## TASK T22 — Test Coverage Gates

**Depends on:** T7 (gate engine), T5 (config)
**Files created:** (extends `cli/lib/gates.mjs`, `cli/lib/schemas/stacks.json`)

**Goal:** Coverage enforcement as a configurable gate check.

**Config in harness-config.json:**
```json
{
  "gates": {
    "enabled": true,
    "checks": ["all"],
    "coverage": {
      "enabled": false,
      "threshold": 80
    }
  }
}
```

**Check function:**
- Runs stack-specific coverage command
- Parses percentage from output
- Compares against threshold
- Fails gate if below threshold

**Stack coverage commands:**
- Python: `pytest --cov --cov-report=term-missing`
- Node: `npx c8 --reporter=text npm test`
- Go: `go test -coverprofile=cover.out ./...`
- Rust: `cargo tarpaulin --out xml`

**Verification:**
```bash
harness-dev config set gates.coverage.enabled true
harness-dev config set gates.coverage.threshold 80
harness-dev validate --json
# → {"phase":"build","checks":[...{"name":"coverage","pass":false,"detail":"67% < 80% threshold"}...]}
```

---

## TASK T23 — Windows/macOS Cross-Platform

**Depends on:** T4 (scaffold — init.sh)
**Files created:** `templates/init.ps1`, `cli/lib/platform.mjs`

**Goal:** The harness init script works on all three major platforms.

**init.ps1 (PowerShell for Windows):**
- Detects package manager (choco, scoop, winget)
- Runs stack-specific install commands
- Verifies with test command
- Uses `Invoke-WebRequest` instead of `curl`

**cli/lib/platform.mjs:**
- `getPlatform()` → 'win32' | 'darwin' | 'linux'
- `isWindows()` → boolean
- `shellQuote(str)` — handles cross-platform quoting
- `crossExec(cmd)` — runs cmd with platform-appropriate shell

**Verification:**
```bash
harness-dev init --stack python --target my-project
ls my-project/init.ps1  # → exists alongside init.sh
```

---

## TASK T24 — CI/CD Integration

**Depends on:** T4 (scaffold), T3 (templates)
**Files created:** `templates/ci/github-actions.yml`, `templates/ci/gitlab-ci.yml`

**Goal:** CI/CD pipeline templates that are scaffolded with `harness-dev init`. Templates live in `templates/ci/` and are auto-discovered by the template engine during init. No separate `ci` CLI command — templates are scaffolded as part of the standard init flow.

**Implementation note:** The `ci` CLI command (`harness-dev ci setup`) was deferred. CI templates are bundled in `templates/ci/` and included automatically when running `harness-dev init`. Future work can add a `harness-dev ci setup --provider github` command.

**GitHub Actions:**
- `.github/workflows/harness.yml`
- Runs on push/PR to main
- Steps: lint → test → coverage → gate validate
- Matrix across Node versions (18, 20, 22)

**GitLab CI:**
- `.gitlab-ci.yml`
- Stages: lint, test, coverage, gate
- Uses `needs` for DAG ordering

**Verification:**
```bash
harness-dev ci setup --provider github
cat .github/workflows/harness.yml
# → Lint + test + coverage + validate pipeline
```

---

## TASK T25 — Cleanup & Refactor

**Depends on:** All previous tasks
**Files created:** (none — modifies existing files)

**Goal:** Consolidate, deduplicate, and standardize the codebase.

**Work items:**
1. Consolidate test runner: `test/run-all.mjs` runs all 12 suites via `npm test`
2. Moved `templates/docs-site/` → `docs-site-templates/` (prevents .js files from polluting stack detection)
3. Updated `test-t7.mjs` — BUILD checks 4→5 (added coverage), VERIFY checks 2→3 (added coverage)
4. Updated `test-t15.mjs` — template count 10→13 (added CI templates + init.ps1)
5. Cleaned up duplicate test copies from `test/` directory — runner references root `test-t*.mjs` files
6. Added `gates.coverage` config defaults to `state.mjs` getDefaultConfig
7. Added `npm test` / `npm run test:verbose` scripts to package.json

**Verification:**
```bash
node test/run-all.mjs
# → All 12 suites pass, single exit code
```

# Decisions — dev-harness

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
- The ralph inner/outer loops are procedural task iterators with retry escalation, not event-driven state machines. They load config, pick the next feature/task, emit instructions, and recurse. xstate shines for event-driven UIs and protocol state machines, not file-iterating loops.
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
   - Imports the current procedural `ralph-inner.mjs`/`ralph-outer.mjs` as `oldRunPhase`/`oldContinuePipeline`
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

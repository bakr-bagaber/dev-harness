# Implementation Workflow — Conventions for Working on This Harness

This file covers how to WORK ON the dev-harness CLI itself (not how to use it).

## 1. Audit-Before-Modify

When the plan has been iterated significantly since the last implementation session:

1. **Read the plan first** — re-read PROJECT_PLAN.md tasks relevant to what you're about to do. The plan may have changed since implementation began.
2. **Check existing implementation** — read the actual code files. Do NOT assume they match the plan. Plans evolve; implementations may be stale.
3. **Identify gaps** between what the plan specifies and what was built. Fix those gaps BEFORE adding new work.
4. **Modify with context** — once you understand both plan and reality, make changes. The plan is the spec; the code is the artifact.

### Schema-vs-code drift check

During implementation audits, cross-reference JSON schema files (like `stacks.json`) against the code that consumes them. Common drifts:

- **DetectFiles/signals mismatch:** The schema documents one set of detection signals (`detectFiles` array), but the code checks additional files or extensions. The schema is not the source of truth.
- **Field name drift:** Schema field names differ from what the code reads (`pairExts` vs `extensions`, `detectFiles` vs `files`).
- **Missing fields:** Some stacks in the schema have fields (`pairExts`, `detectFiles`) while others don't, even when the code treats them uniformly.

**Rule of thumb:** If a JSON schema file exists alongside detection/routing code, audit the schema as part of code review. The schema should be either (a) the exclusive source of truth that the code derives from, or (b) explicitly documented as a subset.

**Why:** This session's plan was iterated 7+ times before implementation began. T1 (CLI skeleton) had been partially built against an older plan. Jumping straight into T2 without auditing T1 first would have built on a wrong foundation.

### Audit-only discipline

When the user requests "audit", "test", "verify", or "validate" — do NOT modify project files. Run tests against /tmp/ directories, read files, report findings. Do not patch, write, or scaffold inside the project tree. The audit is a read-only assessment.

**Pitfall — creating test scripts in the project tree:** Writing a test script under `tests/` or `cli/` counts as a modification. Write test scripts to /tmp/ or execute inline. If the user later asks to keep a test, they will say so explicitly.

**Signal:** Look for phrases like "dont change anything, just audit", "just test", "verify only", "report what you find" — these are audit-mode commands that prohibit file writes to the project.

**After-audit fix policy:** When the user says "fix all" or asks "do we need to change anything?" about audit findings — fix everything immediately, don't defer. The user's preference is "do it now not later" for non-blocking findings that would otherwise be documented and deferred. This applies to spec deviations, dead code, and cosmetic issues, not just bugs. Exception: If a fix would change a deliberate design decision, clarify with the user first.

## 2. Comprehensive Scenario Testing (Required After Every Task)

Before marking any implementation task "done", run comprehensive testing. This is NOT just smoke tests.

### What to test:

| Category | What | Example count |
|----------|------|--------------|
| **A: Entry point routing** | All commands route correctly, unknown commands error, --help/--version work | 24 checks |
| **B: Argument parser** | --flag value, --flag=value, --boolean, --, subcommands, edge cases | 19 checks |
| **C: Error handling** | Exit codes (0,2,3), errors→stderr, success→stdout, JSON errors on stderr | 21 checks |
| **D: Help text** | All commands documented in human + JSON, exit codes documented, consistency between formats | 60 checks |
| **E: All stubs/commands** | Every command executes, returns valid JSON, doesn't crash | 48 checks |
| **F: Realistic scenarios** | Agent discovering project, full workflow, error recovery, git workflow, contract workflow, mode switching, edge cases | 69 checks |

### Testing methodology:

- Each test is an assertion with clear pass/fail output
- Use artificial data that mimics real interfaces (--feature auth, --task 1, rollback to iter/3)
- **When testing filesystem commands, test bare-flags-without-value** (e.g., `--target` with no argument). Our custom arg parser sets valueless flags to boolean `true`, which crashes `path.resolve(true)` if the command doesn't validate before passing to path functions. This is a recurring edge case for any command that accepts an optional path flag.
- Verify the invariant: errors go to stderr, success goes to stdout (critical for agent parseability)
- Test both human and --json output formats
- Test edge cases: empty strings, very long values, unicode, duplicate flags, -- before flags
- Run after every TASK implementation, not just at the end of a phase

### Testing filesystem-dependent features

When a command reads the filesystem (stack detection, init scaffold, validate gates), use this pattern:

1. **Create temp directories** with specific file structures for each test case
2. **Use `--target <dir>`** (or the relevant path flag) to isolate tests from cwd
3. **Assert via JSON** — grep or `jq` keys like `"stack"`, `"evidence"` from `--json` output
4. **Test priority ordering** by placing conflicting detection signals in the same directory (e.g., `.py` + `go.mod` → Python wins because its entire block runs first)
5. **Test edge cases specific to filesystem scanning:**
   - Empty directory (no files at all)
   - Only ignored/blacklisted directories (`.git`, `node_modules`, `__pycache__`)
   - Files beyond scan depth limits (should not trigger detection)
   - Non-existent directory (should catch and return fallback)
   - Mixed stacks (verify the priority order defined in spec, not assumed)

**Key gotcha — priority order is per-block, not per-rule:** When testing stack priority, remember that Python's entire detection block (config checks + extension checks) runs before Go's entire block. So a directory with `.py` files + `go.mod` returns "python", not "go". This is correct per spec — don't "fix" this by reordering. If you want to test Go beating something, test against Node or Rust (which run after Go).

**Pitfall — temporary directory pollution:** If using shell `mktemp` or `$$` in test scripts, always `trap cleanup EXIT` so temp dirs don't accumulate. Failing tests that leave temp dirs behind confuse the next session.

## 3. Standard JSON Output Contract

Every CLI command MUST output JSON when `--json` flag is set. The JSON MUST include these three fields:

```json
{
  "command": "<command_name>",
  "status": "ok" | "not_implemented" | "error",
  "message": "Human-readable status or error detail"
}
```

Additional command-specific fields are encouraged (e.g., `"phase": "build"`, `"stack": "python"`) but the three standard fields must always be present.

**Error invariant:** Errors go to stderr. Success goes to stdout. This is critical so that agent can always parse stdout as valid JSON without error contamination.

Implementation pattern (stub):
```javascript
if (json) {
  process.stdout.write(JSON.stringify({
    command: 'mycommand',
    status: 'not_implemented',
    message: 'T<n> not yet implemented',
  }) + '\n');
  return;
}
process.stdout.write('mycommand: not yet implemented. See T<n> in PROJECT_PLAN.md\n');
```

**Pitfall — stub contract drift:** Stub commands commonly omit required fields or use wrong field names (e.g., `note` instead of `message`). Verify EVERY command's JSON output against the contract—not just the ones you created this session. `status --json` is the most-used command and easy to overlook when you're adding stack-detection fields. Run ALL registered commands with `--json` and assert the three standard fields exist.

**Pitfall — errors in error handler:** When a fatal error helper (like `die()`) calls `process.exit()` unconditionally, any code after the `die()` call in the same handler is unreachable. Remove dead-code tails after fatal exits.

## 4. Quality Gates

- `npm run lint` — eslint flat config, must pass clean (exit 0, zero warnings)
- `npm run check` — `node --check` syntax validation on entry point
- `.mjs` files must be valid ESM (import/export, no require)

## 5. Discovered Patterns

- **help alias**: Some agents call `harness-dev help` instead of `harness-dev --help`. Register it as a valid command that redirects to help text. Add it to the COMMANDS map with a null handler and inline the logic before module resolution.
- **-- stops flag parsing**: When an agent passes `--json` after `--`, it should be treated as a positional literal, not a flag.
- **Version synchronization**: The VERSION constant in help text must match package.json version. Two approaches: (a) read version from package.json via static import (`import { readFileSync } from 'fs'`), or (b) define VERSION once and reference it. Check version consistency during every task's quality gates.
- **Short-flag value parsing**: Custom argument parsers often treat short flags as always-boolean. If a short flag like `-t` needs a value, the parser must explicitly consume the next token — else `-t /tmp` sets flag `t` to `true` instead of `"/tmp"`. Either implement short-flag value support or document that only the long form (`--target`) works.
- **Truthiness on array returns**: Standard library functions like `readdirSync()` return truthy arrays even when empty (`[]` is truthy). Avoid `if (!someArray)` as a test for emptiness — use `.length === 0` instead. This is a JavaScript gotcha that produces dead code paths.

### Config state management (deepMerge + structured results)

The `cli/lib/state.mjs` module establishes a pattern for any module that manages a JSON config file:

1. **Define a `getDefaultConfig()`** that returns the canonical default (all fields present, opt-in defaults).
2. **`loadConfig(dir)`** reads the file, parses JSON, and **deep-merges** with defaults so missing fields get sensible defaults and extra fields are preserved. Never throws — returns `{ config, ok, path, error }`.
3. **`saveConfig(dir, cfg)`** writes the merged config back. Returns `{ ok, error }`.
4. **`get(dir, key)`** and **`set(dir, key, value)`** use dot-notation access (`"gates.enabled"` → `config.gates.enabled`), with type coercion in the command layer (`true`/`false`/numbers/null/strings).
5. **Phase-specific state** (phase transitions, git metadata updates) lives on the same config object via `transitionPhase()`, which validates, records gate history, updates git fields, and saves in one atomic call.

**When to apply:** Every module that reads/writes a JSON file in the harness should follow this pattern. The key invariants are: never throw, always return structured result, deep-merge with defaults before returning.

### Progress.md dual structure (overwrite vs append)

`cli/lib/progress.mjs` manages two sections with different lifecycles:

- **`## Session State`** — atomic overwrite. `writeSessionState(dir, fields)` replaces the entire section. Callers must provide all fields they want preserved (not merged). Missing fields in the `fields` argument revert to defaults. This is by design — session state is a point-in-time snapshot, not a cumulative log.
- **`## Lessons`** — append-only. `appendLesson(dir, text, author)` adds a new `YYYY-MM-DD | Author | Text` line at the end of the section. If the file doesn't exist, creates it. If the section doesn't exist, creates it. Lessons are never modified or deleted.

**When to apply:** Any future module that manages sections with different write behaviors should adopt this pattern. The key insight is that two sections in the same file can have opposite write semantics, and the read function (`readProgress()`) must parse both correctly regardless of file state (missing, empty, malformed).

### Phase transition validation (forward-only, no skip, no self-transition)

The `transitionPhase()` function in `state.mjs` applies these rules deterministically:

1. **Forward-only**: `fromPhase → toPhase` must advance by exactly one step in the phase order (`define → plan → build → verify → review → ship`). No backwards transitions.
2. **No skipping**: `plan → verify` (skipping `build`) is rejected. Every phase must be visited in order.
3. **No self-transitions**: `build → build` is rejected. You cannot re-enter a phase once you've left it.
4. **null → first**: Starting state (`currentPhase: null`) can only transition to the first enabled phase.
5. **SIMPLIFY**: Excluded from the default phase order. Only present if explicitly added to `phases.enabled`.

**Gate recording:** When leaving a phase (transitioning from A to B where A is non-null), the gate result is recorded in `gateHistory[]` with a timestamp. This provides an audit trail of all phase completions.

**When to apply:** Any phase orchestration logic must use `transitionPhase()` rather than manually setting `currentPhase`. The validation in the function is the single source of truth for phase ordering — duplicate it in the command layer and they will drift.

### Gates disabled by default (opt-in validation)

The `validate` command always returns exit 0 with `"Gates disabled"` message when `gates.enabled` is `false` (the default). This is the opt-in philosophy:

- Users must explicitly enable gates: `harness-dev config set gates.enabled true`
- Gates are off by default because they run real commands (lint, test type checks) that may not be configured yet
- The `areGatesEnabled()` check happens before any phase detection or check execution
- The `--phase` override flag still respects the gates-disabled check

**When to apply:** Any feature that runs external commands or imposes checks should be opt-in with a clear enable mechanism. The default state should produce exit 0, not errors.

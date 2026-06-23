# T2 Stack Detection Audit — June 2026

## Summary

T2 (stack detection) was audited on 2026-06-18. 50/50 functional tests passed, 27/27 code quality tests passed, ESLint clean. Three non-blocking issues found.

## Issues Found

### 1. Bare `--target` flag crashes CLI

**File:** `cli/lib/detect-stack.mjs`, line 69

```
const absDir = resolve(targetDir);
```

When `harness-dev status --target` is called with no value, `args.flags.target` is boolean `true` (our arg parser's convention for valueless flags). `path.resolve(true)` throws `TypeError` before the try/catch on line 72, propagating as exit code 3 (INTERNAL_ERROR).

**Fix location:** `cli/commands/status.mjs` — type-guard with `typeof args.flags?.target === 'string'`.

**Detection:** `harness-dev status --json --target` with no value → exit 3 with no useful error message.

**Status:** ✅ FIXED (2026-06-18). Added `typeof` guard in status.mjs. When `--target` has no value, falls back to `process.cwd()` instead of passing boolean `true` to `resolve()`. See `references/cli-reference.md` for the guard pattern.

### 2. Stacks.json detectFiles inconsistent with code

**File:** `cli/lib/schemas/stacks.json`

The `detectFiles` field claims to list files that trigger stack detection, but omits several signals the code actually checks:

| Stack | detectFiles lists | Code ALSO checks |
|-------|------------------|------------------|
| python | pyproject.toml, setup.py, requirements.txt | Pipfile |
| node | package.json, tsconfig.json | yarn.lock, pnpm-lock.yaml |

This means stacks.json is not the authoritative source of truth for detection rules — the code has additional heuristics the schema doesn't reflect. A future maintainer editing stacks.json would not see the full picture.

**Fix:** Add missing entries to stacks.json `detectFiles` arrays.

**Status:** ✅ FIXED (2026-06-18). Added `Pipfile` to Python, `yarn.lock` + `pnpm-lock.yaml` to Node in `stacks.json`. Schema now matches `detect-stack.mjs` lines 116 and 124.

### 3. PROJECT_PLAN.md C/C++ table conflicts with implementation

**File:** `PROJECT_PLAN.md` T2 section

The detection table says C requires `CMakeLists.txt + *.c` or `Makefile + *.c`, but the implementation is extension-only (matching dev-harness skill lesson #2 — "C/C++ extension-only detection"). The PROJECT_PLAN was never updated after the skill lesson was established.

**Fix:** Update PROJECT_PLAN.md T2 table to say `*.c` (ext-only, build system as optional confidence signal). Or: update the skill lesson if build-system-required was the intended final design.

## Test Methodology

The 50-test battery covered:

1. **Per-stack detection** (28 tests): Each stack tested with all config files + all extensions
2. **Priority ordering** (9 tests): Every adjacent pair in the priority chain (Python > Node > Go > Rust > C > C++ > VHDL > Verilog > Generic) plus a 3-way test
3. **Generic fallback** (3 tests): Empty dir, unknown files, non-existent dir
4. **Edge cases** (10 tests): Ignored dirs (node_modules, .git), depth limits (scan depth 2), mixed stacks, C-vs-C++ priority, Verilog-not-C for .v files, unknown languages (Java, HTML)

**Running methodology:**
- Each test creates an isolated temp directory with specific files
- `harness-dev status --json --target <dir>` extracts `"stack"` field from JSON
- Assert output matches expected stack name
- `trap cleanup EXIT` prevents temp directory pollution

## Key Code Locations

- `cli/lib/detect-stack.mjs` — detection engine (186 lines)
- `cli/lib/schemas/stacks.json` — stack metadata (9 stacks, 112 lines)
- `cli/commands/status.mjs` — status command that calls detectStack (57 lines)
- `cli/lib/vars.mjs` — template variable loader from stacks.json (89 lines)

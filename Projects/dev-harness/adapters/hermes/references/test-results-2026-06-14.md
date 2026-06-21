# Dev Harness — Full Cycle Test Results

Date: 2026-06-14
Project: dev-harness-test (dummy Python project)
Location: ~/ops/Projects/dev-harness-test/

## Phase-by-Phase Gate Output

### SPEC
```
✗ Gate 'spec': FAIL: 1 checks
     spec.md not found
```
→ Created .hermes/harness/spec.md with 5 required sections
```
✓ Gate 'spec': PASS: 0 items
```

### PLAN
```
✓ Gate 'plan': PASS: 0 items
```
plan.json with 4 tasks (calculator, formatter, tests, docs) including acceptance criteria and dependency DAG.

### BUILD
```
✓ Gate 'build': PASS: 0 items
```
Before fix: ruff clean (0 lint errors). Gate passes because ruff returncode=0 is treated as success.
```
✗ Gate 'build': FAIL (ruff exit code != 0)
```
Lint errors reported with file:line:col format. Fix with `ruff check --fix .`

### TEST
```
✓ Gate 'test': PASS: 2 items
  2 test files found
  all 9 tests passed
```
Non-error items (file count, pass message) are INFO, not gate-blocking. Only actual failures block.

### REVIEW
```
✓ Gate 'review': PASS: 0 items
```
Checks: no bare print(), no bare except, no TODO comments, missing docstrings on public functions.

### SHIP
```
✓ Gate 'ship': PASS: 2 items
  version: 0.1.0
  2 uncommitted files (expected during dev)
```
Changelog, Readme, License, version check. Uncommitted files are INFO not errors.

## Known Gate Behaviors

1. **ruff output parsing**: ruff writes "All checks passed!" to stdout on success (exit 0). Gate checks `returncode != 0` before processing output.
2. **PYTHONPATH**: All gates that run subprocesses (ruff, pytest) set `PYTHONPATH=src/` for src-layout projects automatically via `_run_env()` helper.
3. **Info vs Errors**: Gate functions return `(passed, items)`. Items are always printed. Gate only fails on actual errors — informational messages (file counts, pass confirmations) are printed but do not block.
4. **State transitions**: `pending → active → done` with checkpoint at each completion. `gate=pass` vs `gate=fail` tracked in state.json.
5. **Hard gate breaks**: Missing spec.md, missing plan.json, invalid JSON, circular deps, no test directory, no test files — these always fail immediately with `return False`.
6. **Soft passes**: ruff not available, pytest not available, coverage missing — these are soft-fail (pass anyway) to not block environments without full toolchain.

## Integration Patterns Tested

| Tool | Test | Result |
|------|------|--------|
| OpenProject | Create WP #143-148 in project #18 | ✓ |
| GitHub | `gh repo create` + push | ✓ |
| Ops/Obsidian | `ops_write_note` to Arease | ✓ |
| Zulip | API reachability check | N/A (offline) |

## OpenProject Quirks

- **lockVersion required** on every PATCH. Must GET WP first to get current version.
- **?pageSize=100** needed to see all WPs in a project (default page = 10).
- **Admin login**: check both `admin` and `admin@example.net`. Locked account shows "invalid password" even if correct — reset via Rails console.
- **Project deletion** cascades to WPs. WP GET shows 404 if project was deleted.
- **No `failed_login_count` in user table by default** in older OpenProject versions — check schema first.

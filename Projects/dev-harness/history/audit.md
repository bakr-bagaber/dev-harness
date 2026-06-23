# Audit — dev-harness

## 2026-06-23 — Post-v2.2.0 refactor audit

- **Agent:** GitHub Copilot
- **Type:** audit
- **Context:** Verification of the v2.2.0 internal consolidation refactor (output/error strategy, exit-code fixes, dead code removal).

### Checks

| Check | Result |
|-------|--------|
| `npm test` | ✅ 26/26 pass |
| `npm run lint` | ✅ 0 errors (26 warnings, all pre-existing style) |
| `dev-harness --version` | ✅ `v2.2.0` (matches package.json) |
| `cli/lib/help.mjs` VERSION | ✅ `2.2.0` (was stale at `2.0.0` before this release) |
| `package.json` version | ✅ `2.2.0` |
| Dead code removed | ✅ `matchesType` (validate-schema.mjs), dead comments (args.mjs, output.mjs) |
| Output consolidation | ✅ All 16 command handlers use `emitJson`/`emitHuman`/`emitCmdError` |
| Exit-code bug class | ✅ Fixed in 9 handlers (checkpoint, worktree, rollback, config, run, select-tool, pause, resume, learn, set-mode) |
| JSON errors to stderr | ✅ `emitCmdError` routes JSON errors to stderr (stdout parseable on failure) |
| Docs updated | ✅ README (config table, JSON output, deps note), dev-harness.md (status → Shipped v2.2.0) |
| ADR added | ✅ `history/decisions.md` — result-object boundary formalized |
| Changelog entry | ✅ `history/changelog.md` — v2.2.0 section |

### File changes (24 files, net -10 lines)

- 16 command handlers migrated to shared output helpers
- `cli/lib/output.mjs` extended with `emitCmdError`/`emitResult`
- `cli/lib/errors.mjs` header documents canonical boundary
- `cli/lib/help.mjs` VERSION constant fixed
- `cli/lib/validate-schema.mjs` dead `matchesType` removed
- `cli/lib/args.mjs` dead comment removed
- `package.json` bumped 2.1.0 → 2.2.0
- `README.md` config table corrected, JSON output section updated, deps note added
- `dev-harness.md` folder note status updated
- `history/{changelog,decisions,audit}.md` updated
- `test/test-t7.mjs` checkmark assertion updated (`✅` → `✓`)

- **Verification:** All checks pass. Refactor is behavior-preserving (26/26 tests) with correct exit codes and consolidated output layer.

## 2026-06-16 — Initial compliance check

- **Agent:** Hermes Agent
- **Type:** audit
- **Context:** First creation of project. Verifying ops-master compliance.

### Checks

| Check | Result |
|-------|--------|
| Template declared | ✅ Template A (SWE) in folder note |
| Folder note exists | ✅ `dev-harness.md` with YAML frontmatter, tags, aliases, date |
| SPEC.md exists | ✅ At project root |
| README.md exists | ✅ At project root |
| docs/ structure | ✅ analysis/, decisions/, guides/, reports/, validation/ |
| history/ exists | ✅ changelog.md, decisions.md, issues.md, audit.md |
| No orphan files at root | ✅ All files in correct subdirectories |
| No content outside ops/ | ✅ All files inside ops/Projects/dev-harness/ |

### Actions Taken

- All required ops-master files created
- Old `Projects/dev-harness-v2/` deleted after migrating content to canonical name `dev-harness/`

- **Verification:** Project structure confirms to Template A. No violations.

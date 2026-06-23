# T19/T20 Implementation — 2026-06-20

## Summary

T19 (Hermes skill wrapper) was entirely missing from the project — no `hermes/` directory existed. T20 (CLI packaging & distribution) was partially implemented — `package.json` publish config and `README.md` existed but `dist/install.sh` was missing and `.gitignore` blocked `dist/`.

**Created:**
- `hermes/skill/dev-harness/SKILL.md` — 88-line Hermes skill with metadata + all 13 command docs + trigger patterns
- `hermes/skill/dev-harness/scripts/init.mjs` — wrapper for `harness-dev init`
- `hermes/skill/dev-harness/scripts/phase.mjs` — wrapper for `harness-dev phase`
- `hermes/skill/dev-harness/scripts/validate.mjs` — wrapper for `harness-dev validate`
- `hermes/skill/dev-harness/templates` → symlink to `../../../templates`
- `dist/install.sh` — 109-line curl-pipe-bash installer (npm/npx/GitHub fallback)

**Modified:**
- `.gitignore` — removed `dist/` line (conflicted with ops-level `.gitignore`; now documented as force-add requirement)
- `README.md` — 141→373 lines, added Agent Integration section, API Reference, Project Structure
- `dev-harness` Hermes skill (v1.0.0→v1.1.0) — Layer 7, new pitfalls, new triggers

**Tests:** All 12 suites pass (829/829, no regressions).

---

## T19 — Hermes Skill Wrapper

### Files Created

```
hermes/skill/dev-harness/
├── SKILL.md              # Skill metadata + usage
├── scripts/
│   ├── init.mjs          # Wrapper for harness-dev init
│   ├── phase.mjs         # Wrapper for harness-dev phase
│   └── validate.mjs      # Wrapper for harness-dev validate
└── templates/            # Symlink → ../../../templates
```

### Design Decisions

**Relative path resolution:** Wrapper scripts resolve the CLI relative to the project root using `../../../../cli/harness-dev.mjs`. Walk through:
```
scripts/init.mjs is at:          hermes/skill/dev-harness/scripts/init.mjs
projectRoot = resolve(__dirname, '..', '..', '..', '..')
  = resolve('hermes/skill/dev-harness/scripts', '..', '..', '..', '..')
  = resolve('hermes/skill/dev-harness', '..', '..', '..')
  = resolve('hermes/skill', '..', '..')
  = resolve('hermes', '..')
  = project root
```

**Template symlink:** The T19 spec said `../../cli/templates/` (relative to `hermes/skill/dev-harness/templates`), which would resolve to `hermes/cli/templates/` — wrong. Templates live at the project root `templates/`, so the correct relative path is `../../../templates`. Verified with `readlink -f` and `ls`.

**Scripts are thin wrappers** — they pass all arguments through to the CLI via `spawnSync('node', [cliPath, ...args], { stdio: 'inherit' })`. No filtering or transformation. Exit code is forwarded.

### Verification

```bash
# Syntax check all scripts
for f in hermes/skill/dev-harness/scripts/*.mjs; do node --check "$f" && echo "✓ $f" || echo "✗ $f"; done

# Symlink resolution
readlink -f hermes/skill/dev-harness/templates  # → project-root/templates
ls hermes/skill/dev-harness/templates/AGENTS.md # → AGENTS.md

# Frontmatter validity
head -15 hermes/skill/dev-harness/SKILL.md | grep -c "^---"  # → 2
```

---

## T20 — CLI Packaging & Distribution

### Files Created/Modified

| Artifact | Status | Purpose |
|---|---|---|
| `dist/install.sh` | Created (109 lines) | curl-pipe-bash installer |
| `.gitignore` | Modified | Removed `dist/` line |
| `README.md` | Enhanced (141→373 lines) | Agent integration + API ref + project structure |
| `package.json` | Verified (no changes needed) | Already had bin/files/publishConfig |

### Dist/install.sh Design

Three install methods attempted in order:

1. **npm global** — `npm install -g @dev-harness/cli` (preferred, works on most systems)
2. **npx** — `npx @dev-harness/cli ...` (always works, no install required)
3. **Direct download** — `curl` or `wget` the entry point from GitHub raw

Pre-flight checks: Node.js >= 18 required, provides clear error messages.

### Ops-Level Gitignore Conflict

**Problem:** The ops root `.gitignore` (at `~/ops/.gitignore`) has `dist/` which matches any `dist/` directory at any depth. All files inside `dist/` are invisible to git regardless of the project-local `.gitignore`.

**Fix:** Remove `dist/` from the harness-local `.gitignore` (since it was duplicating the ops-level rule anyway, and the harness needs `dist/` for distribution). Use `git add -f dist/install.sh` to force-track it. The ops-level `.gitignore` can't be overridden locally for directory patterns.

**How to re-stage after editing:**
```bash
git add -f dist/install.sh
git ls-files --cached dist/install.sh  # Verify it's tracked
```

### README Enhancements

| Section | Content |
|---|---|
| Agent Integration | Claude Code / Codex CLI / OpenCode / Cursor / Generic Agent with example workflows |
| API Reference | JSON output contract, error contract, exit codes table, all 13 commands with JSON fields |
| Project Structure | Full tree showing cli/, templates/, schema/, dist/, hermes/ |

---

## Cross-Cutting

### Skill Update

The `dev-harness` Hermes skill (at `~/ops/Infra/.hermes/skills/software-development/dev-harness/SKILL.md`) was updated:

- Description mentions "Hermes skill wrapper, and distribution packaging. Covers T1-T20."
- Version: 1.1.0
- Changelog entry for T19-T20
- Architecture table now has Layer 7: Distribution (T19 + T20)
- New subsections: "Hermes Skill Wrapper" with file tree and deployment instructions
- New pitfalls:
  - #11: `dist/install.sh` requires `git add -f` due to ops-level gitignore
  - #12: Wrapper scripts use relative path resolution — must be invoked from harness project dir
- New trigger examples for install/deploy/test

### Spec Deviation

The original T19 spec said the templates symlink should point to `../../cli/templates/`. This was wrong — templates are at the project root `templates/`, not `cli/templates/`. Corrected to `../../../templates`.

### Verification (Full Suite)

```bash
# Run all 12 test suites
for t in test-t5.mjs test-t5-cli.mjs test-t6.mjs test-t7.mjs \
         test-t9.mjs test-t10.mjs test-t11.mjs test-t12.mjs \
         test-t13.mjs test-t14.mjs test-t15.mjs test-t16.mjs; do
  node "$t"
done
# Expect: all REPORT lines show X/X passed
```

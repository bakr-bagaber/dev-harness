# T4 — Init Command Architecture (June 2026)

## Overview

`harness-dev init` scaffolds 15–17 files in target directory. Replaced a stub at `cli/commands/init.mjs` with full implementation.

## Files Generated

| Source | Files | Count |
|--------|-------|-------|
| Templates (T3 engine) | AGENTS.md, harness-config.json, init.sh, progress.md, sprint-contract.md | 5 |
| Extra scaffold (inline) | feature_list.json, feature-list.schema.json, session-handoff.md, clean-state-checklist.md, evaluator-rubric.md, ARCHITECTURE.md, CONSTRAINTS.md, DECISIONS.md | 8 |
| Stack config file | pyproject.toml / package.json / go.mod / Cargo.toml / CMakeLists.txt | 0–1 |
| Stack version file | .python-version / .nvmrc / go.ver / rust-toolchain.toml | 0–1 |
| Git | .gitignore (stack-specific patterns) | 1 |
| Docs | docs/api-patterns.md | 1 |
| **Total** | | **15–17** |

## Key Design Decisions

### 1. Existing project file protection

Stack config files (package.json, go.mod, etc.) are the user's actual project files — init MUST NOT overwrite them. Split file list into two categories:

- **Harness files** (templates + extra scaffold + .gitignore + docs) — collision aborts without --force
- **Project files** (stack config + version file) — silently skipped if they exist, no --force needed

This means `harness-dev init` into an existing Node project won't blow up because package.json already exists.

### 2. Git integration

- Checks `git rev-parse --git-dir` to detect existing repo
- `git init` if not in a repo
- `git add -A && git commit -m "harness: initial scaffold"` if repo is empty
- `--no-git` flag skips all git operations
- No commit created if repo already has commits (even with --force)

### 3. Auto-detect vs explicit --stack

- `--stack` takes priority; validated against `listStacks()`
- Without `--stack`, calls `detectStack(targetDir)` from T2
- If detection returns `generic`, errors with "Could not auto-detect project stack. Specify with --stack <name>."

### 4. .gitignore per stack

Embedded patterns in `GITIGNORE_PATTERNS` constant per stack (Python, Node, Go, Rust, C, C++, VHDL, Verilog, Generic). Harness-specific ignores always prepended (harness-config.json, feature_list.json, etc.).

### 5. Extra files as inline content

Extra files (beyond the 5 templates) are embedded as JavaScript template literals in `getExtraFiles(stack)` function. The ARCHITECTURE.md, CONSTRAINTS.md, and docs/api-patterns.md templates use `${stack}` interpolation for stack-specific references.

## The `--override` Parser Triple-Form Pattern

Found across T3 + T4: `parseOverrides()` must handle three forms:

```javascript
--override=key=value       // equals in flag
--override key=value       // space-separated, = in value arg
--override key value       // two separate args, no =
```

Implementation (in templates.mjs `parseOverrides()`):

```javascript
if (arg.startsWith('--override=')) {
  // --override=key=value
  const val = arg.slice('--override='.length);
  const eqIdx = val.indexOf('=');
  if (eqIdx !== -1) {
    overrides[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
  }
} else if (arg === '--override' && i + 1 < args.length) {
  const key = args[i + 1];
  const eqIdx = key.indexOf('=');
  if (eqIdx !== -1) {
    // --override key=value (one arg with =)
    overrides[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
    i++;
  } else if (i + 2 < args.length) {
    // --override key value (two separate args, no =)
    overrides[key] = args[i + 2];
    i += 2;
  }
}
```

**Pitfall:** Omitting the triple-arg branch silently ignores the override — no error, no warning.

## The `isMain` Guard Pattern

Template modules that double as both CLI entry points and importable libraries need an `isMain` guard:

```javascript
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  main();
}
```

Without this guard, `import()` of the module triggers `main()`, which parses `process.argv` and crashes with missing argument error — making the module's exports unreachable.

## Stack File Counts

| Stack | Config file | Version file | Total files |
|-------|------------|--------------|-------------|
| python | pyproject.toml | .python-version | 17 |
| node | package.json | .nvmrc | 17 |
| go | go.mod | go.ver | 17 |
| rust | Cargo.toml | rust-toolchain.toml | 17 |
| c | CMakeLists.txt | (none) | 16 |
| cpp | CMakeLists.txt | (none) | 16 |
| vhdl | (none) | (none) | 15 |
| verilog | (none) | (none) | 15 |
| generic | (none) | (none) | 15 |

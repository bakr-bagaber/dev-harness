# Common Bug Patterns (T1-T16 Audits)

Durable patterns caught repeatedly across audits. Check these when modifying harness CLI.

## 1. `??` vs `||` for Config Fallbacks

**Caught:** T9, T10, T11 audits (3 occurrences)

**Pattern:** When reading config values where `0`, `false`, or `""` are valid settings,
use nullish coalescing (`??`) not logical OR (`||`):

```javascript
// BAD — treats 0, false, "" as missing
const maxRetries = config.maxRetries || 3;   // maxRetries=0 → 3
const mode = config.mode || 'copilot';      // mode="" → 'copilot'
const retryCount = config.retryCount || 0;  // retryCount=0 → 0 (works but by accident)

// GOOD — nullish coalescing
const maxRetries = config.maxRetries ?? 3;   // maxRetries=0 → 0 ✓
const mode = config.mode ?? 'copilot';       // mode="" → "" ✓
const retryCount = config.retryCount ?? 0;   // retryCount=0 → 0 ✓
```

**Trigger:** Any `config.XXX || default` pattern in state.mjs, ralph-inner.mjs, ralph-outer.mjs, phase.mjs, gates.mjs.

## 2. Unguarded `main()` in Modules

**Caught:** T3 audit

**Pattern:** Modules with a CLI entry point must guard the `main()` call so importing
the module doesn't execute the CLI:

```javascript
// BAD — crashes on import
main();

// GOOD — guard with isMain check
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  main();
}
```

**Trigger:** Any `cli/lib/*.mjs` file that has a `main()` or equivalent CLI entry point.
Check all new lib modules.

## 3. Else-If Chaining in Section/State Detection

**Caught:** T6 audit

**Pattern:** When scanning for section boundaries (e.g. parsing progress.md sections),
use independent `if` blocks, not `else if`. Multiple conditions can match the same line:

```javascript
// BAD — second condition never evaluated
if (isSessionStateStart(line)) { /* mark start */ }
else if (isLessonsHeader(line)) { /* mark end — but blocked by else if */ }

// GOOD — independent ifs
if (isSessionStateStart(line)) { /* mark start */ }
if (isLessonsHeader(line)) { /* mark end — always evaluated */ }
```

**Trigger:** Any parser that scans for multiple headers/section boundaries in sequence.

## 4. Pre-Transition State Checks

**Caught:** T9/T12 audit

**Pattern:** When a `transitionPhase()` or similar mutation clears state (e.g. clears
`config.paused`), check the state BEFORE the transition:

```javascript
// BAD — check after transition clears paused
const result = transitionPhase(dir, phase);
if (result.config.paused) { /* never reached — already cleared */ }

// GOOD — check before transition
const { config } = loadConfig(dir);
if (config.paused) { /* block before transitioning */ }
const result = transitionPhase(dir, phase);
```

**Trigger:** Any command that calls a mutation function which may reset/clear state fields.
Check `transitionPhase` in `state.mjs` for cleared fields.

## 5. Event-Driven Branch Silently Ignoring `--override` Forms

**Caught:** T3 audit (parseOverrides)

**Pattern:** Flag parsers that accept only one form (`--flag=value`) silently ignore
other forms (`--flag value value`). Ensure all natural forms are handled:

```javascript
// Handle all three
if (arg.startsWith('--override=')) {
  // --override=key=value  (equals in flag)
} else if (arg === '--override' && i + 1 < args.length) {
  const next = args[i + 1];
  if (next.includes('=')) {
    // --override key=value  (space-separated, value has =)
  } else if (i + 2 < args.length) {
    // --override key value  (three separate args)
  }
}
```

**Trigger:** Any custom flag parser in CLI commands or lib modules that accepts
repeatable flags with values.

## 6. Regex Missing Bold Markers in Markdown Files

**Caught:** T14 audit

**Pattern:** When parsing markdown files, content may use bold formatting (`**text**`)
that regex `\s` does not match. Allow for optional non-word characters between key
and value:

```javascript
// BAD — fails on "**Rounds:** 0/5"
line.match(/Rounds:\s(\d+)/);

// GOOD — allows bold markers
line.match(/Rounds:?\s\{0,2}(\d+)\/(\d+)/);
```

**Trigger:** Any regex that parses `**Key:** value` patterns in markdown-based state files
(sprint-contract.md, progress.md).

## 8. Test Expectations Not Updated When Adding Checks

**Caught:** T14, T16 audits (test-t7.mjs stale expectations)

**Pattern:** Adding new gate checks to a phase (`checkContractAgreed` to DEFINE, `checkRubricExists` to REVIEW) changes the check count for that phase. Any test that hardcodes check counts must be updated:

```javascript
// BAD — hardcoded count
assert.equal(result.checks.length, 1, 'define should have 1 check');

// GOOD — flexible assertion or updated count
assert(result.checks.length >= 1, `define should have at least 1 check, got ${result.checks.length}`);
```

**Checklist when adding a new check function to `PHASE_CHECKS`:**
1. Update all tests that hardcode check counts for that phase
2. Update tests that reference specific check indices
3. Update tests that assert `overall === true` when the new check may fail
4. Add an assertion that the new check exists in the output

## 9. `null` Config Stubs Crash Downstream

**Caught:** Stack expansion (java/kotlin/dotnet/matlab)

**Pattern:** When `STACK_CONFIG_STUBS[stack]` or `getConfigFileContent(stack)` returns `null`, the caller must check before attempting to write:

```javascript
// BAD — writes "null" to file
const content = getConfigFileContent(stack);
writeFileSync(path, content);  // writes "null" string!

// GOOD — skip if null
const content = getConfigFileContent(stack);
if (content !== null) {
  writeFileSync(path, content);
}
```

**Trigger:** Adding a new stack with no config file template (like `dotnet` or `matlab`). Check `init.mjs`'s `getConfigFileContent()` and `getVersionFileContent()` for null returns before writing.

## 7. Dotfile Visibility in Test Assertions

**Caught:** T4 audit

**Pattern:** Files starting with `.` (like `.gitignore`, `.nvmrc`) are hidden by `ls` and `find` without `-a`. Tests that compare file counts must account for this:

```javascript
// BAD — misses dotfiles
const files = fs.readdirSync(dir); // 15 instead of 17

// GOOD — counts all files
const files = fs.readdirSync(dir).filter(f => f !== '.' && f !== '..');
```

**Trigger:** Any test that counts generated files in a directory that may contain dotfiles.

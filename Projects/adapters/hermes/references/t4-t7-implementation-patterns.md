# T4–T7 Implementation Patterns — CLI Scaffold, State, Progress & Gates

These patterns emerged during T4 (init scaffold), T5 (state machine), T6 (progress.md dual writer), and T7 (gate validation engine) implementation. They complement the foundational rules in `implementation-workflow.md`.

## 1. `--target` Flag Convention

Every command that operates on a project directory MUST support `--target <dir>`. This is required for test isolation — tests create projects in /tmp and use `--target` to point at them. Commands that ignore `--target` cause hard-to-find test bugs where state is accidentally read/written from cwd (the harness project root).

**Pattern (every command handler):**
```javascript
const rawTarget = args.flags?.target;
const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
```

**Pitfall — bare `--target` without value:** Our argument parser sets valueless flags to boolean `true`. The type guard `typeof rawTarget === 'string'` catches this and falls back to cwd instead of crashing with `path.resolve(true)`. Do NOT skip the type guard.

**Pitfall — missing `--target` from new commands:** Every time you create or rewrite a command handler, add `--target` support at the top of the handler function. It's easy to forget because the command works fine when run from a project directory — it breaks silently when run with `--target` from another location. Retro-fitting is error-prone (see T5 where config/phase/learn commands each needed separate fixes).

## 2. Standard Command Handler Pattern

Every command handler follows this shape:

```javascript
export default async function commandName(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();

  // Validate inputs (early exit via die())
  if (!valid) {
    die(new CliError('Usage: ...', EXIT.USAGE_ERROR), json);
    return;
  }

  // ... main logic ...

  // Output
  if (json) {
    process.stdout.write(JSON.stringify({
      command: 'command-name',
      status: ok ? 'ok' : 'error',
      message: 'Human-readable result',
      // ... command-specific fields ...
    }) + '\n');
    return;
  }

  // Human output
  process.stdout.write('human-readable result\n');
}
```

## 3. JSON Output Contract: Success vs Error Divergence

The success and error paths intentionally use different JSON schemas:

**Success (stdout):**
```json
{ "command": "cmd", "status": "ok", "message": "..." }
```

**Error via `die()` (stderr):**
```json
{ "error": "CliError", "message": "...", "exitCode": 2 }
```

The `die()` function writes to stderr so stdout stays parseable. Its schema comes from `formatError()` in `errors.mjs` and includes `error`, `message`, and `exitCode` keys. This is different from the success schema (`command`, `status`, `message`). This is **intentional** — errors use a separate contract because they come from a shared error handler, not from individual command logic.

**Pitfall — inline error handlers:** Some commands write their own errors (instead of using `die()`) with shapes like `{error: true, message}` (T3 templates.mjs had this). This creates a third schema. Always use `die()` or match the die output shape for consistency.

## 4. The `main()` Guard for Module Files

If a `.mjs` file serves dual purpose (CLI entry AND importable module), the `main()` call MUST be guarded:

```javascript
// Only run as CLI when called directly (not when imported as module)
if (process.argv[1] && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  main();
}
```

Without this guard, `import()` of the module crashes because `main()` parses `process.argv` and calls `process.exit()`. This was bug in T3's `templates.mjs`.

## 5. Template Drift Prevention

When a template generates output that includes embedded content from another template (e.g., `init.sh` embeds a copy of `harness-config.json`), both copies MUST be updated together. Drift happens when the main template is updated but the embedded copy is forgotten.

**Pattern:** After editing any template file, search for embedded copies in other templates. The init.sh embedded config and the dedicated harness-config.json template must remain identical except:
- The embedded copy uses `'CFG'` quoted heredoc delimiter (prevents shell expansion)
- The dedicated template uses `{{VAR}}` substitution via the JS template engine

**Verification:** After template changes, regenerate all output and diff the embedded vs dedicated config to confirm parity.

## 6. `--override` Parser Evolution (Three Forms)

The `parseOverrides()` function handles three argument forms. This evolved through multiple bug reports — do not simplify back:

| Form | Example | Consumes | Parser branch |
|------|---------|----------|---------------|
| `--override=key=value` | `--override=testCmd='go test'` | 1 arg (equals in flag) | `arg.startsWith('--override=')` |
| `--override key=value` | `--override testCmd='go test'` | 2 args (equals in value) | `arg === '--override' && key.includes('=')` |
| `--override key value` | `--override testCmd 'go test'` | 3 args (no equals) | `arg === '--override' && i+2 < args.length` |

All three must work. Each was caught by a different test scenario.

## 7. Section Boundary Detection in Markdown Files

When parsing sections in a `.md` file (used by progress.mjs), section boundaries are detected by `## ` headers. Critical implementation detail:

**Use independent `if` statements, NOT `else if` chains**, when tracking both session-start and session-end boundaries in the same loop. An `else if` chain causes one condition to skip another when they could match on the same iteration. The T6 Bug 1 was exactly this — the `## Lessons` header matched the LESSONS_HEADER condition but the session-end check was in an `else if` branch and never evaluated, causing the entire file to be treated as the Session State section.

**Pattern:**
```javascript
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === SESSION_HEADER) sessionStart = i;
  if (lines[i].trim() === LESSONS_HEADER) lessonsStart = i;     // independent
  if (sessionStart >= 0 && sessionEnd === -1 && lines[i].startsWith('## ') && i > sessionStart) {
    sessionEnd = i;                                               // independent
  }
  if (lessonsStart >= 0 && lessonsEnd === -1 && lines[i].startsWith('## ') && i > lessonsStart) {
    lessonsEnd = i;                                               // independent
  }
}
```

## 8. `appendLesson` Should Append at End of File

When appending the first lesson to a file that has a `## Session State` section but no `## Lessons` section, the simplest correct behavior is: **append at end of file**. Do NOT try to insert mid-file between the last section and trailing content. The T6 Bug 2 was inserting after the last `## ` header but before the section content below it, corrupting the document structure.

**Pattern:** Strip trailing whitespace/newlines, append `\n\n## Lessons\n\nDATE | Author | lesson\n`, and write. No mid-file insertion logic.

## 9. Phase Transition Validation Rules

The state machine enforces these transition rules (codified in `state.mjs`):

- **Forward-only**: can only advance to the next phase in order
- **No skipping**: cannot skip phases (e.g., plan → verify without build)
- **No backwards**: cannot go back to a previous phase
- **Null → first**: from null (unstarted) only the first enabled phase is valid
- **SIMPLIFY excluded by default**: `getPhaseOrder()` filters it out unless explicitly enabled in `phases.enabled`

## 10. Gates Disabled Returns Exit 0

When `gates.enabled` is `false`, `harness-dev validate` prints a message and **exits 0**, not 1. Exit code 1 means "validation failure" — gates disabled is not a failure, it's a configuration choice. The `--phase` override still respects the disabled check.

## 11. Session State is Atomic Replace

`writeSessionState()` always replaces ALL 5 fields in the `## Session State` block. Fields not passed in the `fields` argument revert to defaults. This is by design — the section is a single atomic state snapshot. Callers (phase transitions, status updates) must provide the complete desired state.

Default fields:
```
Current Phase: not started
Current Feature: —
Gate Status: pending
Next Action: —
Retry Count: 0/3
```

## 12. The Two Development Profiles

The CLI has two distinct usage modes that affect testing:

| Mode | Typical user | How cwd is used | --target relevance |
|------|-------------|-----------------|-------------------|
| **Agent** | Hermes, Claude Code, etc. | Runs from project root, uses --json, reads from cwd | Optional (agents normally cwd into project) |
| **Human dev** | User at terminal | Runs from project root, wants formatted output | Explicit when testing multiple projects |

Both modes must work. Always test both human and `--json` output paths.

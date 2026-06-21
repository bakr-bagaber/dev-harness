# Session Lessons — published from various sessions

## 9. Template CLI modules must guard main() and use consistent JSON contracts (2026-06-19)

T3 audit (templates.mjs) revealed three recurring patterns that apply to any CLI module that's both a library and an entry point:

**A) Unguarded main() blocks programmatic import:**
The module calls `main()` at line 221 unconditionally. Importing it via `import('./cli/lib/templates.mjs')` runs main(), which parses process.argv, fails with "--stack is required", and calls process.exit(2). The module's three exports (`substitute`, `discoverTemplates`, `generateTemplates`) are unreachable.

Fix pattern — guard with isMain check at bottom of file:
```javascript
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && (basename(process.argv[1]) === basename(__filename) ||
    resolve(process.argv[1]) === __filename)) {
  main();
}
```

**B) Standalone CLI modules use a different JSON contract than subcommands:**
- Subcommands (init, status, phase, ...) use `{command, status, message}` — the standard contract.
- templates.mjs (standalone entry) uses `{command, status, stack, target, filesCreated, files, errors}` on success (no `message`), and `{error: true, message}` on errors (no `command`/`status`).
- Two different schemas from the same entry point is confusing for agent consumers. Decide on one contract and use it for both success and error paths.
**C) --override flag syntax has three forms, not two:**

The help text shows `--override k=v`, but the parser originally only handled `--override=k=v`. The space form (`--override k=v`) was silently ignored — no warning, no error, the override simply didn't apply. This is worse than a loud error because the agent thinks it set the value but the output is unchanged.

After fixing, the parser now supports all three forms:
| Form | Example | Mechanism |
|------|---------|-----------|
| Equals in flag | `--override=testCmd="go test -v"` | Flag has `=` → slice after `--override=` |
| Space + equals in value | `--override testCmd="go test -v"` | Next arg contains `=` → split on first `=` |
| Triple-arg | `--override testCmd "go test -v"` | No `=` in next arg → consume two more args |

**Pitfall — triple-arg was the last edge found by user:** The original space branch consumed one arg and checked for `=` in it. When the next arg was `testCmd` (no `=`), the condition failed silently and the override was skipped. The agent got no output change and no error. Fix: add a second branch that consumes two extra args when the first has no `=`.

**Design rule for CLI flag parsers:** If a flag accepts a compound value (`key=value`), support all three positional forms. The triple-arg form is expected by users who type `--override key value` naturally.

**Why it matters:** Template modules are often both importable (for the `init` command to call `generateTemplates()`) and runnable standalone (for testing). The unguarded `main()` means the `init` command can't use the template engine via import — it would have to shell out or require, defeating the purpose of ESM modularity.

## 10. Cross-cutting patterns from T1-T14 implementation (2026-06-19)

### A) Every CLI command must support `--target` with the same type guard

All commands that read project state must use the two-line pattern (not just `process.cwd()`):

```javascript
const rawTarget = args.flags?.target;
const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
```

Without the type guard, `--target` passed without a value becomes `boolean true`, which `resolve(true)` converts to a TypeError (exit 3). Bug was found in T4 init command and the fix pattern was retroactively applied to status (T2), config (T5), phase (T5), learn (T6), validate (T7), set-mode (T9), pause (T11), resume (T11), and contract (T14).

**Rule:** When adding a new CLI command, always include this pattern even if `--target` isn't documented — it prevents a crash class that's hard to debug.

### B) Nullish coalescing (`??`) not logical OR (`||`) for config defaults

Multiple bugs across T10 and T11 came from `||` treating `0`, `false`, and `''` as falsy. The `??` operator only falls back on `null`/`undefined`, which is the correct semantics for config reads.

**Fixed occurrences:**
- `ralph-inner.mjs:148` — `config.maxRetries ?? 3` (T10 audit)
- `ralph-outer.mjs:42` — `config.mode ?? 'copilot'` (T11 audit)
- `phase.mjs:49,78` — `preConfig.mode ?? 'copilot'` (T11 audit)

### C) Phase command returns `instruction` status (not `ok`)

The `harness-dev phase <name>` command returns `status: 'instruction'` for both deliverable-retry and feature-iterate phases. It only returns `status: 'complete'` when all features in a feature-iterate phase have passed. Tests that check `r.status === 'ok'` must be updated to accept `'instruction'` as a valid status.

### D) HTML comment stripping in contract status parsing

The sprint-contract.md template uses `**Status:** <!-- Agreed / Needs Revision -->` as a placeholder. The `getContractStatus()` function must strip HTML comments from the status line before matching, otherwise the presence of "Agreed" inside a comment causes a false positive match.

```javascript
const cleanRaw = raw.replace(/<!--.*?-->/g, '').trim();
```

### E) The `--feature` / `--task` flags are parsed but not actioned

The validate command supports `--feature <id> --task <id>` flags (plumbed in T8 audit) and echoes them in JSON output, but gates.mjs still runs full phase-level checks. Per-task filtering requires task-aware check functions which are deferred to a later task. The contract is established for agents to use.

### F) Config field completeness (as of T14)

The canonical harness-config.json has these fields (defaults in parens):

| Top-level | Sub-fields |
|-----------|-----------|
| version | "1.0" |
| stack | null |
| mode | "copilot" |
| currentPhase | null |
| paused | false |
| features | remaining(0), passing(0), total(0) |
| gates | enabled(false), checks(["all"]) |
| git | autoCommit(f), autoTag(f), resetOnRetry(f), branch(null), clean(t), hasUpstream(f), lastCommitMessage(null) |
| phases | enabled(["define","plan","build","verify","review","ship"]) |
| agents | tone (planner/generator/evaluator/simplifier strings) |
| maxRetries | 3 |
| retryCount | 0 |
| pipelineIteration | 0 |
| copilot | autoPrompt(t), confirmGates(t) |
| gateHistory | [] |

T3 audit (templates.mjs) revealed three recurring patterns that apply to any CLI module that's both a library and an entry point:

**A) Unguarded main() blocks programmatic import:**
The module calls `main()` at line 221 unconditionally. Importing it via `import('./cli/lib/templates.mjs')` runs main(), which parses process.argv, fails with "--stack is required", and calls process.exit(2). The module's three exports (`substitute`, `discoverTemplates`, `generateTemplates`) are unreachable.

Fix pattern — guard with isMain check at bottom of file:
```javascript
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && (basename(process.argv[1]) === basename(__filename) ||
    resolve(process.argv[1]) === __filename)) {
  main();
}
```

**B) Standalone CLI modules use a different JSON contract than subcommands:**
- Subcommands (init, status, phase, ...) use `{command, status, message}` — the standard contract.
- templates.mjs (standalone entry) uses `{command, status, stack, target, filesCreated, files, errors}` on success (no `message`), and `{error: true, message}` on errors (no `command`/`status`).
- Two different schemas from the same entry point is confusing for agent consumers. Decide on one contract and use it for both success and error paths.
**C) --override flag syntax has three forms, not two:**

The help text shows `--override k=v`, but the parser originally only handled `--override=k=v`. The space form (`--override k=v`) was silently ignored — no warning, no error, the override simply didn't apply. This is worse than a loud error because the agent thinks it set the value but the output is unchanged.

After fixing, the parser now supports all three forms:
| Form | Example | Mechanism |
|------|---------|-----------|
| Equals in flag | `--override=testCmd="go test -v"` | Flag has `=` → slice after `--override=` |
| Space + equals in value | `--override testCmd="go test -v"` | Next arg contains `=` → split on first `=` |
| Triple-arg | `--override testCmd "go test -v"` | No `=` in next arg → consume two more args |

**Pitfall — triple-arg was the last edge found by user:** The original space branch consumed one arg and checked for `=` in it. When the next arg was `testCmd` (no `=`), the condition failed silently and the override was skipped. The agent got no output change and no error. Fix: add a second branch that consumes two extra args when the first has no `=`.

**Design rule for CLI flag parsers:** If a flag accepts a compound value (`key=value`), support all three positional forms. The triple-arg form is expected by users who type `--override key value` naturally.

**Why it matters:** Template modules are often both importable (for the `init` command to call `generateTemplates()`) and runnable standalone (for testing). The unguarded `main()` means the `init` command can't use the template engine via import — it would have to shell out or require, defeating the purpose of ESM modularity.

## 8. Every Phase is a Loop — No Single-Shot (2026-06-17)

User rejected the "single-shot" framing for non-BUILD phases:

| Before (wrong) | After (correct) |
|-----------|-----------|
| DEFINE, PLAN, REVIEW, SHIP are "single-shot" — agent produces deliverable once, done | Every phase runs the inner loop. DEFINE/PLAN/REVIEW/SHIP are **deliverable-retry** phases: same loop, same work→validate→fail/retry pattern, but the loop retries the same deliverable rather than picking the next feature. |
| "There's nothing to iterate" | There's always iteration — retries on failure capped by maxRetries. |

**Rule embedded in skill:** SKILL.md now explicitly says "There are NO single-shot phases" in the triggers.

**Why it matters:** Proposing "single-shot" as a concept creates confusion when implementing the phase orchestrator (T10). Every command handler must support retry logic. There's no simpler code path.

## 7. CLI must have all commands pre-registered (2026-06-17)

User approved expanding the CLI from 8 to 13 commands in one pass. Key approach:
- Register all command routes in harness-dev.mjs upfront
- Create stub handlers that return `not_implemented` with task reference
- Update help text to show all commands immediately
- Never defer routing — the CLI always knows what commands exist even before they're implemented

**Rule:** Stubs must mention the task number (e.g., "T5 not yet implemented") so both user and agent know where to look.

## 6. Config Schema — maxRetries is per-model (2026-06-17)

User said: "smart model may require 3 iterations before escalation, dumb model may require 10."

**Rule:** maxRetries is a config value in harness-config.json, not hardcoded. Document per-model guidance in the config reference.

## 5. Gate Types Clarification (2026-06-16)

User asked: "gates concept is not clear to me, you need to explain that better, and how are we implementing it against how Anthropic does it."

**Resolution:** Two distinct mechanisms:
- **Contract Gate (Anthropic-style):** agent-to-agent negotiation, subjective quality check, always active, managed by sprint-contract.md flow
- **Phase Gate (deterministic):** CLI shell commands, objective correctness check, disabled by default, managed by `harness-dev validate`

**Note:** Previous versions of the skill used "gate" as a single overloaded term. The `references/gate-types.md` reference now documents both.

## 4. User persona (2026-06-15)

**Electrical engineer + entrepreneur. Home infra: WSL Docker/Dockhand/OmniRoute/Honcho/Qwen3-Embedding/pgvector+redis. dockhand-deployments repo. Android user wants LAN container access. Cost-conscious: scale to zero, no idle compute.**

(This lesson is appended; user preference is primary storage in memory.)

## 3. Testing must include real integration tests

User said: "testing should include actual use cases using my kicad installation on windows, otherwise you are just assuming you are done."

**What went wrong:** Phase 1 tests were pure Python smoke tests — function signatures, offline error handling, structure verification. They never exercised the toolchain against a real system.

**Fix:** Distinguish two levels in the Test Gate:
- **Unit/smoke tests** — verify function signatures, logic, error handling (no external deps)
- **Integration tests** — require real system (KiCad CLI, services, APIs). Marked as `@pytest.mark.kicad` or similar. Skipped cleanly when the dependency is absent.

## 2. OpenProject tracking must include child tasks

User said: "I checked openproject, I only saw workpages without actual charts or tasks or progress."

**What went wrong:** Phase summary WPs were created empty — no child tasks, no estimated hours, no %done, no status transitions. The orchestrator API key's workflow didn't allow status transitions from New(1) to Tested(10), and this was not reported.

**Fix required:**
- Create child tasks under every phase WP at init time, not after phases complete
- Track status transitions explicitly — if workflow blocks a transition, document it
- Avoid deep parent-only status updates; build hierarchy early

## 1. Autopilot must never stop at phase boundaries

User said: "I dont want you to ask me to start any phase" and "this has to be real autopilot."

**Rule embedded in skill:** Critical rule at top of Autopilot Mode section — "Autopilot runs ALL phases to completion without stopping. No 'next phase?' No waiting. No asking."
# T14 Contract + T16 Template Recursion Patterns

## T14 — Sprint Contract Negotiation

### Commands

`harness-dev contract propose --scope "Build X" [--exclusions "Y"] [--criteria "a|b|c"]`
`harness-dev contract review --agreed [--notes "msg"]`
`harness-dev contract review --needs-revision [--notes "msg"]`
`harness-dev contract status [--json]`
`harness-dev contract escalate [--reason "msg"]`

### Status flow

null (file missing) → pending (proposed) → needs-revision → pending (re-proposed)
                                        → agreed → gate passes
                                        → escalated (5 rounds reached)

### Bug patterns

1. **Regex fails on bold markers.** `/rounds?:\s(\d+)\/(\d+)/` doesn't match `**Negotiation rounds:**` because `\s` doesn't match `*`. Fixed by pre-stripping `**` or using broader pattern.

2. **Auto-escalation didn't write to file.** `reviewContract()` incremented rounds, detected escalation, set `escalated: true` in return value — but never wrote the updated status or `## Escalation` section to the file. Fix: mutate `content` string before `writeFileSync()`.

3. **HTML comment in template caused false agreed status.** The placeholder `<!-- Agreed / Needs Revision -->` matched the "agreed" check. Fix: strip HTML comments with `raw.replace(/<!--.*?-->/g, '').trim()` before status matching.

4. **Status never set after propose.** Fresh proposal left `**Status:** <!-- Agreed / Needs Revision -->` which parses to empty string. `getContractStatus()` now falls back to `pending` when `status === null` and file exists.

## T16 — Template Engine Subdirectory Support

### Template discovery change

Before T16: `discoverTemplates()` used flat `readdirSync()` — only files directly in `templates/`.

After T16: Recursive directory walk picks up `templates/docs/agents/*.md`.

### Output path change

Before: `join(target, basename(tmplPath))` — `templates/docs/agents/planner.md` → `target/planner.md`

After: `relative = tmplPath.slice(TEMPLATES_DIR.length + 1)` then `join(target, relative)` — preserves full relative path.

### Subdirectory creation

`mkdirSync(outDir, { recursive: true })` when `outDir !== target` ensures subdirectories exist before writing.

### Files from template system (10)

AGENTS.md, harness-config.json, init.sh, progress.md, sprint-contract.md, evaluator-rubric.md, docs/agents/planner.md, docs/agents/generator.md, docs/agents/evaluator.md, docs/agents/simplifier.md

Plus 11 inline files from init.mjs = 21 total. Role guides are static (no `{{VAR}}`). Evaluator-rubric.md is also static (no `{{VAR}}`).

For the T16 evaluator-rubric.md audit, see `references/t16-evaluator-rubric-audit.md`.

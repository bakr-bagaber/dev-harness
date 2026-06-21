# Ralph Loop — Iterative Build Engine

## Origin

Geoffrey Huntley's Ralph pattern: `while :; do cat PROMPT.md | claude-code ; done`
Reference implementation: snarktank/ralph (20.3k★)

The core insight: **each iteration is a fresh agent with clean context.** No context
accumulation, no context anxiety, no premature wrapping-up because the context window
is full. The only memory between iterations is:
- Git history (commits from previous iterations)
- `progress.txt` (append-only learnings)
- `feature_list.json` (which stories are done)
- `AGENTS.md` (evolving conventions and gotchas)

## When to Use Ralph Loop vs. Standard Build

| Scenario | Use |
|----------|-----|
| Greenfield project, many small features | Ralph Loop |
| Brownfield, one large feature change | Standard build (single worker) |
| Bugfix across multiple files | Standard build (single worker) |
| Refactoring with many atomic commits | Ralph Loop |
| Any project where tasks fit in one context window | Ralph Loop |
| Task exceeds ~200 lines or ~5 files | Split first, then Ralph Loop |

## Configuration

```json
{
  "max_iterations": 10,
  "tool": "default",
  "single_feature_lock": true,
  "branch_prefix": "task/",
  "stop_on_failure": true,
  "archive_old_runs": true,
  "verification_level": "full"
}
```

## Loop Algorithm

```
while iteration < max_iterations:

    1. LOAD STATE
       - Read feature_list.json -> find highest-priority story with passes: false
       - Read progress.txt -> understand what happened before
       - Read AGENTS.md -> understand conventions and gotchas
       - Read git log --oneline -10 -> see recent context

    2. IF ALL STORIES PASSING
       -> Output "<promise>COMPLETE</promise>"
       -> Exit with 0

    3. START ITERATION
       - Create feature branch: git checkout -b task/{story_id}-{slug}
       - Load appropriate build skill (incremental-implementation etc.)

    4. IMPLEMENT ONE STORY
       - Right-sizing check: story must be completable in one context window
       - Anti-placeholder: FULL implementations, no stubs
       - Write tests for the change

    5. VERIFY
       - Run unit tests for changed code
       - Run type-check on changed files
       - Run lint on changed files
       - If verification_level == "full": run entire test suite

    6. IF VERIFICATION PASSES
       - git add -A && git commit -m "{story_id}: {title}"
       - Update feature_list.json -> story.passes = true
       - Append to progress.txt with learnings from this iteration
       - Update AGENTS.md with any new conventions/gotchas
       - Increment iteration counter

    7. IF VERIFICATION FAILS
       - Log the failure to progress.txt
       - Fix the issue, re-run verification
       - If failed 3 times consecutively: STOP, escalate to human

    8. REPEAT
```

## Story Selection Priority

Stories in feature_list.json are prioritized by:
1. Dependency order — stories that unblock others come first
2. Priority field — explicit priority from PRD/plan
3. Risk — high-risk stories first (fail fast)
4. Value — highest user-visible value first (happy path before edge cases)

## Key Rules

### One Story at a Time
Only ONE story may be `in_progress` at any time. This prevents context fragmentation.
The loop stops if it detects a second story in progress.

### Append-Only Learnings
After each iteration, write to progress.txt:
```
## Iteration 3 (2026-06-16)
Story: US-004 Dashboard charts
What I learned:
- Chart library X doesn't support Y, used Z instead
- The settings component is in src/settings/SettingsPanel.tsx
- Remember to update src/types/dashboard.ts when adding new chart types
Gotchas:
- Don't use flexbox on the chart container — the library needs explicit width/height
Next session should:
- Start with US-005 (filter controls) — depends on US-004's chart context
```

### Update AGENTS.md
If the discovery is a durable convention (not a session-specific detail), add it to
AGENTS.md under a "Discovered Conventions" section. This is auto-read by every
subsequent agent session.

### Anti-Placeholder
Every iteration MUST gate against placeholder code:
- No `# TODO: implement this` without actual implementation below
- No bare `pass` in function bodies
- No `raise NotImplementedError` in committed code
- No mock-everything test files where actual integration testing is feasible
- No stub implementations that would fail under real usage

## When the Ralph Loop Stops

| Condition | Output | Next Action |
|-----------|--------|-------------|
| All stories `passing` | `<promise>COMPLETE</promise>` | Run REVIEW phase |
| Max iterations reached | MISSING: {N} stories still incomplete | Escalate to human |
| 3 consecutive failures | BLOCKED on {story_id} | Escalate to human with failure log |
| Human interrupt | Interrupted at iteration {N} | Save state, commit, exit cleanly |

# VERIFY Phase

**Loop mode:** Feature-iterate
**Unit of work:** One feature re-checked by an independent agent
**Primary agent:** Evaluator

## Purpose

No agent evaluates its own work. The Evaluator independently re-runs each
feature's acceptance criteria from the sprint contract and scores it against
`evaluator-rubric.md`. Failures go back to BUILD with feedback.

## Entry

- BUILD gate passed
- All features marked `passes: true` by Generator

## Work

1. Read `sprint-contract.md` criteria and `evaluator-rubric.md`.
2. For each feature: re-run its verification command independently.
3. Score each rubric dimension (0–2): Correctness, Coverage, Code Quality,
   Security, Performance, Handoff Readiness.
4. On pass: keep `passes: true`, record score in `progress.md`.
5. On fail: mark `passes: false`, write feedback, return to BUILD.

## Exit Gate

Run `dev-harness validate` — checks:

- `config-exists`
- `git-repo`
- `git-clean`
- All features re-confirmed `passes: true` by Evaluator

## Handoff

On gate pass: `dev-harness phase simplify` (Evaluator → Simplifier).

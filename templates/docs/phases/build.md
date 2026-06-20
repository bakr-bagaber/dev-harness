# BUILD Phase

**Loop mode:** Feature-iterate
**Unit of work:** One incomplete feature from `feature_list.json`
**Primary agent:** Generator

## Purpose

Implement features one at a time. Each iteration: pick the next incomplete
feature → work → validate that task → pass = next feature / fail = retry with
fresh context. Only when all features pass does the phase gate run.

## Entry

- PLAN gate passed
- `sprint-contract.md` status is `Agreed`
- `feature_list.json` non-empty

## Work

1. Read `progress.md`, `AGENTS.md`, `sprint-contract.md`.
2. Pick next feature where `passes === false`.
3. Implement the feature's tasks.
4. Run `dev-harness validate --feature <name> --task <id>` per task.
5. On pass: mark feature `passes: true`, commit, append lesson to `progress.md`.
6. On fail (≤ `maxRetries`): retry with fresh context (git reset if `--git-ops`).
7. On fail (> `maxRetries`): escalate to human.

## Exit Gate

Run `dev-harness validate` — checks:

- `config-exists`
- `git-repo`
- `feature-branch` (not on main/master)
- `git-clean`
- All features in `feature_list.json` have `passes: true`

## Handoff

On gate pass: `dev-harness phase verify` (Generator → Evaluator).

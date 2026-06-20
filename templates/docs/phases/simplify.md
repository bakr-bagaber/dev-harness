# SIMPLIFY Phase

**Loop mode:** Feature-iterate
**Unit of work:** One feature simplified
**Primary agent:** Simplifier

## Purpose

Relentless clarity. Delete more than you add. Each feature gets a simplification
pass: remove dead code, collapse duplication, tighten names. Simplifications
must not break the feature's acceptance criteria.

## Entry

- VERIFY gate passed
- `simplify` enabled in `harness-config.json` (`phases.enabled` includes `simplify`)

## Work

1. Read `progress.md` and `AGENTS.md`.
2. For each feature: review the implementation, propose deletions/renames.
3. Apply simplifications.
4. Re-run `harness-dev validate --feature <name>` — criteria must still pass.
5. On pass: commit, append lesson.
6. On fail (≤ `maxRetries`): revert and retry.
7. On fail (> `maxRetries`): escalate.

## Exit Gate

Run `harness-dev validate` — checks:

- `config-exists`
- `git-repo`
- `git-clean`
- `no-empty-dirs` — no empty directories (cleanup dead structure)
- All features still pass their criteria

## Handoff

On gate pass: `harness-dev phase review` (Simplifier → multi-agent committee).

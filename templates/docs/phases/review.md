# REVIEW Phase

**Loop mode:** Deliverable-retry
**Deliverable:** Review report (`review-report.md`)
**Primary agents:** Multi-agent committee (Planner, Generator, Evaluator, Simplifier)

## Purpose

Whole-project review by the committee. Each persona reviews from its angle and
records findings. The Evaluator aggregates into `review-report.md` with an
overall verdict: Accept / Revise / Block.

## Entry

- SIMPLIFY gate passed (or SIMPLIFY disabled)

## Work

1. Each persona reviews the full diff since last review:
   - Planner: scope adherence vs `sprint-contract.md`
   - Generator: implementation correctness
   - Evaluator: rubric scores, gate evidence
   - Simplifier: residual complexity / dead code
2. Evaluator aggregates findings into `review-report.md`.
3. Verdict `Revise` → return to BUILD with specific feedback.
4. Verdict `Accept` → proceed to SHIP.

## Exit Gate

Run `harness-dev validate` — checks:

- `config-exists`
- `git-repo`
- `git-clean`
- `review-report.md` present with verdict `Accept`
- `readme-exists` — README.md present with meaningful content
- `architecture-doc` — ARCHITECTURE.md filled in (if file exists)
- `decisions-logged` — DECISIONS.md has at least one recorded decision

## Handoff

On gate pass: `harness-dev phase ship` (committee → release).

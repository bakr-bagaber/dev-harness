# PLAN Phase

**Loop mode:** Deliverable-retry
**Deliverable:** `feature_list.json` with decomposed tasks
**Primary agent:** Planner

## Purpose

Decompose the PRD into a feature list. Each feature has one or more tasks with
verifiable acceptance criteria. The Sprint Contract is negotiated here.

## Entry

- DEFINE gate passed
- `specs/prd.md` present

## Work

1. Read `specs/prd.md`.
2. Decompose into features → tasks in `feature_list.json`.
3. Planner proposes `sprint-contract.md` (scope, criteria, exclusions).
4. Evaluator reviews; iterate until `**Status:** Agreed`.
5. Use `dev-harness contract propose` / `contract review --decision <agreed|needs-revision>`.

## Exit Gate

Run `dev-harness validate` — checks:

- `config-exists`
- `git-repo`
- `feature_list.json` present and non-empty
- `contract-agreed` (sprint contract status is `Agreed`)

## Handoff

On gate pass: `dev-harness phase build` (Planner → Generator).

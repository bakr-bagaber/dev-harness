# PLAN Phase

## Overview
Decompose the PRD into a feature list with bounded tasks. Each feature becomes
a unit of work that BUILD can implement and VERIFY can validate independently.

## When to Use
- DEFINE phase complete (PRD exists)
- Need to break PRD into implementable features and tasks

## Process
1. Read `harness/progress.md`, `AGENTS.md`, and `specs/prd.md`
2. Decompose PRD into features — each feature is a deliverable unit
3. For each feature, define tasks — each task is a single, testable change
4. Write `harness/features/feature-list.json`:
   ```json
   {"version":"0.1","features":[
     {"id":"f1","name":"Feature name","passes":false,
      "tasks":[{"id":"t1","description":"Task desc","status":"pending"}]}
   ]}
   ```
5. Negotiate sprint contract: `dev-harness contract propose`
6. Review contract: `dev-harness contract review` (agree or revise)
7. Run `dev-harness validate` to check gates
8. If PASS → `dev-harness phase next` to advance to BUILD

## Rationalizations to Avoid
| Excuse | Rebuttal |
|--------|----------|
| "Tasks are obvious from the PRD" | Undecomposed tasks lead to incomplete implementations |
| "I'll plan during build" | Context switching kills momentum — plan first |

## Red Flags
- Features with more than 7 tasks — too coarse, decompose further
- Tasks with vague descriptions ("handle edge cases") — specify what
- No sprint contract — no agreement on scope

## Verification
- [ ] `feature-list.json` exists with features and tasks
- [ ] Sprint contract proposed and agreed
- [ ] `dev-harness validate` passes

## Handoff
On gate pass: `dev-harness phase next` (Planner → Generator for BUILD)

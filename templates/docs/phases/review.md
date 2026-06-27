# REVIEW Phase

## Overview
Final quality gate before shipping. The Evaluator reviews the complete codebase
against the evaluator rubric, checks documentation, and ensures the branch is
up-to-date with upstream.

## When to Use
- BUILD/VERIFY/SIMPLIFY phases complete
- Ready for final quality review before release

## Process
1. Read `harness/progress.md`, `AGENTS.md`, and `harness/evaluator-rubric.md`
2. Run `dev-harness status` to see current state
3. Review codebase against evaluator rubric (6 dimensions, 0-2 each):
   - Architecture, test coverage, code quality, documentation, performance, security
4. Check documentation: README.md, CHANGELOG.md, architecture docs
5. Ensure branch is up-to-date: `git push` if needed
6. Run `dev-harness validate` to check gates
7. If PASS → `dev-harness phase next` to advance to SHIP

## Rationalizations to Avoid
| Excuse | Rebuttal |
|--------|----------|
| "Build and verify already checked quality" | Review is holistic — catches cross-cutting issues |
| "Documentation can be added post-ship" | Docs shipped late are docs shipped never |
| "The rubric is too strict" | The rubric encodes minimum quality — meet it |

## Red Flags
- Rubric score below 8/12 — quality is marginal
- Missing README, CHANGELOG, or architecture docs
- Branch behind upstream — merge before shipping

## Verification
- [ ] Evaluator rubric score >= 8/12
- [ ] README.md, CHANGELOG.md exist and are current
- [ ] Branch up-to-date with upstream
- [ ] `dev-harness validate` passes

## Handoff
On gate pass: `dev-harness phase next` (Evaluator → Generator for SHIP)

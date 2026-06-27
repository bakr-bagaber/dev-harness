# DEFINE Phase

## Overview
Interview the user, capture intent, and write a bounded PRD. The output is a
short, unambiguous specification that the PLAN phase can decompose into a
feature list.

## When to Use
- Pipeline is at DEFINE phase (first phase after INIT)
- No `specs/prd.md` exists yet
- User needs to define what to build before planning how

## Process
1. Read `harness/progress.md` and `AGENTS.md` for context
2. Interview the user to surface objectives, constraints, and exclusions
3. **If stack is custom/unknown**, fill `stackMeta` in `harness/config.json`:
   - `testCmd`, `lintCmd`, `buildCmd`, `installCmd`, `coverageCmd`, `configFile`, `extensions`
4. **Define project folder structure** — agree on directory layout:
   - `src/` for source, `tests/` for tests, `docs/` for docs, `scripts/` for automation
   - No source files in project root
5. Write `specs/prd.md` — scope, success criteria, non-goals
6. Keep the PRD bounded: no vague verbs ("improve", "enhance")
7. Run `dev-harness validate` to check gates
8. If PASS → `dev-harness phase next` to advance to PLAN

## Rationalizations to Avoid
| Excuse | Rebuttal |
|--------|----------|
| "The spec is obvious, let's just build" | Without a PRD, scope creeps and features drift |
| "I'll define it as I go" | Ambiguity compounds — define boundaries upfront |

## Red Flags
- PRD longer than 2 pages — scope is too broad
- Vague success criteria ("works well", "fast enough")
- No non-goals section — everything is in scope

## Verification
- [ ] `specs/prd.md` exists with scope, success criteria, non-goals
- [ ] Folder structure agreed and documented
- [ ] `dev-harness validate` passes

## Handoff
On gate pass: `dev-harness phase next` (Planner → continues as Planner for PLAN)

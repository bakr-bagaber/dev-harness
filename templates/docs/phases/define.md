# DEFINE Phase

**Loop mode:** Deliverable-retry
**Deliverable:** Product Requirements Document (`specs/*.md`)
**Primary agent:** Planner

## Purpose

Interview the user, capture intent, and write a bounded PRD. The output is a
short, unambiguous specification that the PLAN phase can decompose into a
feature list.

## Entry

- `harness-config.json` exists (created by `dev-harness init`)
- `AGENTS.md` present in project root

## Work

1. Read `progress.md` and `AGENTS.md` for context.
2. Interview the user to surface objectives, constraints, and exclusions.
3. **If stack is custom/unknown**, fill `stackMeta` in `harness-config.json`:
   - `testCmd` — command to run tests (e.g. `mix test`)
   - `lintCmd` — command to lint (e.g. `mix credo`)
   - `buildCmd` — command to build (e.g. `mix compile`)
   - `installCmd` — command to install deps (e.g. `mix deps.get`)
   - `coverageCmd` — command for coverage (e.g. `mix test --cover`)
   - `configFile` — project config file (e.g. `mix.exs`)
   - `extensions` — source file extensions (e.g. `[".ex", ".exs"]`)
   - These override the built-in stack metadata and make gate validation work.
4. **Define project folder structure** — agree on directory layout with user:
   - `src/` for source code
   - `tests/` for test files
   - `docs/` for documentation
   - `scripts/` for automation scripts
   - No source files in project root (only harness + standard project files)
   - Document the agreed structure in `specs/prd.md`
5. Write `specs/prd.md` — scope, success criteria, non-goals.
6. Keep the PRD bounded: no vague verbs ("improve", "enhance").

## Exit Gate

Run `dev-harness validate` — checks:

- `config-exists`
- `git-repo`
- `specs/prd.md` present

## Handoff

On gate pass: `dev-harness phase plan` (Planner → continues as Planner for decomposition).

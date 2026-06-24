# SHIP Phase

**Loop mode:** Deliverable-retry
**Deliverable:** Release artifact (tag, changelog entry, PR)
**Primary agent:** Generator (release mechanics), Evaluator (final sign-off)

## Purpose

Produce the release. Cut a tag, update `CHANGELOG.md`, open or merge the PR.
The release must be reproducible from a clean checkout.

## Entry

- REVIEW gate passed with verdict `Accept`

## Work

1. Update `CHANGELOG.md` with version, date, summary.
2. Bump version in `package.json` / equivalent manifest.
3. Run full `dev-harness validate` — all gates must pass.
4. Tag the release: `git tag -a v<x.y.z> -m "Release x.y.z"`.
5. Open or merge the PR per project workflow.

## Exit Gate

Run `dev-harness validate` — checks:

- `config-exists`
- `git-repo`
- `git-clean`
- Release tag exists
- `CHANGELOG.md` updated
- `readme-exists` — README.md present with meaningful content
- `license-exists` — LICENSE file present
- `changelog-content` — CHANGELOG.md has actual version entries
- `contributing-exists` — CONTRIBUTING.md present (recommended)
- `no-empty-dirs` — no empty directories in shipped project

## Handoff

On gate pass: pipeline complete. `dev-harness status` reports
`Pipeline complete after "ship"`. Increment `pipelineIteration` and loop back
to DEFINE for the next sprint, or stop if the project is done.

# {{stackLabel}} — Harness

## Quick Start

```bash
harness-dev status        # Where are we?
harness-dev phase <name>  # Invoke a phase
harness-dev validate      # Check gate criteria
```

## Project

- **Stack:** {{stack}}
- **Mode:** copilot / autopilot
- **Phase:** not started

## Phase Pipeline

INIT → DEFINE → PLAN → BUILD → VERIFY → [SIMPLIFY] → REVIEW → SHIP

See `harness/docs/phases/` for phase-specific instructions.

## Agent Roles

| Role | File | Tone |
|------|------|------|
| Planner | `docs/agents/planner.md` | Analytical, precise. Define clear boundaries |
| Generator | `docs/agents/generator.md` | Focused, practical. Build what's specified |
| Evaluator | `docs/agents/evaluator.md` | Skeptical, thorough. Accept only compelling evidence |
| Simplifier | `docs/agents/simplifier.md` | Relentless about clarity. Delete more than you add |

## Key Files

All harness-managed files live under `harness/` (except `AGENTS.md` which stays in root for agent tool compatibility).

| File | Purpose |
|------|---------|
| `AGENTS.md` | This file — agent instructions (root) |
| `harness/config.json` | Config + state |
| `harness/features/feature-list.json` | Feature list with passes |
| `harness/progress.md` | Session state + lessons |
| `harness/sprint-contract.md` | Pre-build agreement |
| `harness/scripts/init.sh` | Install → verify → start |
| `harness/evaluator-rubric.md` | Quality scorecard (6 dimensions, 0-2) |
| `harness/docs/` | Architecture, constraints, decisions, agent guides, phase guides |

## Rules (non-negotiable)

1. No agent evaluates its own work — Evaluator always judges
2. Read `harness/progress.md` + this file before each operation
3. Commit frequently — each iteration is a checkpoint
4. If unsure → read the role guide in `harness/docs/agents/`
5. Never skip gates — run `harness-dev validate` after each phase
6. Fresh context per retry — pass `--git-ops` to `harness-dev phase <name>` to auto-reset the working tree on retry (off by default; agent-agnostic)
7. **No files in project root** unless they are harness-managed files (listed in Key Files above) or standard project files (README.md, LICENSE, CHANGELOG.md, CONTRIBUTING.md, .gitignore, and the stack config file like package.json/pyproject.toml/Cargo.toml). All source code, tests, scripts, and docs go in subdirectories.
8. **Structure from the start** — create folders for your work on day one and stick to them. Suggested layout: `src/` (source), `tests/` (tests), `docs/` (documentation), `scripts/` (automation). Do not dump files at root "temporarily" — there is no temporary.
9. **No orphaned files** — every file you create must have a clear purpose and be referenced by imports, configs, docs, or the build system. If you create a file, wire it in immediately. Delete files you stop using.

## Development Commands

| Task | Command |
|------|---------|
| Install deps | `{{installCmd}}` |
| Build | `{{buildCmd}}` |
| Test | `{{testCmd}}` |
| Lint | `{{lintCmd}}` |
| Type check | `{{typeCheckCmd}}` |

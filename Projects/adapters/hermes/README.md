# Hermes Adapter

Hermes is an agentic coding platform. This adapter provides the Hermes skill
manifest (`SKILL.md`) and thin wrapper scripts that delegate to the dev-harness
CLI. When you scaffold with `harness-dev init --agent-tool hermes`, the harness
generates the Hermes skill files alongside the standard `AGENTS.md`.

## Usage

```bash
# Scaffold with Hermes adapter
harness-dev init --stack node --agent-tool hermes --target my-project
cd my-project

# Hermes loads the skill via SKILL.md
```

## Files

- `SKILL.md` — Hermes skill manifest (YAML frontmatter + command docs)
- `scripts/init.mjs`, `scripts/phase.mjs`, `scripts/validate.mjs` — thin
  `spawnSync` wrappers that delegate to the CLI
- `spawn.mjs` — **Tier-1 spawn adapter** for orchestrator mode (`dev-harness run`).
  Spawns Hermes per task with `--fresh-session --exit-on-complete` for session
  isolation and API downtime resilience.
- `templates` — symlink to the main `templates/` directory (shared, not duplicated)
- `AGENTS.md` — canonical harness conventions (always generated)

## How It Works

### Manual Mode (Tier 2)
The wrapper scripts resolve the CLI path relative to their own location and
call `node cli/harness-dev.mjs <command>` with the forwarded arguments. No
logic is duplicated — the scripts are pure delegation. The `templates`
symlink ensures Hermes sees the same templates the CLI uses.

### Orchestrator Mode (Tier 1)
Use `dev-harness run --agent-tool hermes` to start the orchestrator. The
supervisor spawns Hermes per task via `spawn.mjs`, monitors for completion,
handles API downtime with exponential backoff, and auto-advances through
the pipeline with a live dashboard.

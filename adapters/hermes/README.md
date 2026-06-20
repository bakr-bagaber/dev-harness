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
- `templates` — symlink to the main `templates/` directory (shared, not duplicated)
- `AGENTS.md` — canonical harness conventions (always generated)

## How It Works

The wrapper scripts resolve the CLI path relative to their own location and
call `node cli/harness-dev.mjs <command>` with the forwarded arguments. No
logic is duplicated — the scripts are pure delegation. The `templates`
symlink ensures Hermes sees the same templates the CLI uses.

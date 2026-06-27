# Skill Adapter

This adapter provides a skill manifest (`SKILL.md`) and thin wrapper scripts that
delegate to the dev-harness CLI. When you scaffold with `dev-harness init --agent-tool skill`,
the harness generates the skill files alongside the standard `AGENTS.md`.

## Usage

```bash
dev-harness init --stack node --agent-tool skill --target my-project
cd my-project

# Your coding agent loads the skill via SKILL.md
```

## Files

- `SKILL.md` — Skill manifest (YAML frontmatter + command docs)
- `scripts/init.mjs`, `scripts/phase.mjs`, `scripts/validate.mjs` — thin
  `spawnSync` wrappers that delegate to the CLI
- `templates` — symlink to the main `templates/` directory (shared, not duplicated)
- `AGENTS.md` — canonical harness conventions (always generated)

## How It Works

### Backend-Only Architecture (v4.0.0+)
The harness is a backend CLI — no orchestrator, no TUI, no agent spawning.
Your coding agent is the frontend: it reads `SKILL.md` + `AGENTS.md`, then calls
`dev-harness` CLI commands (status, phase, validate, role, etc.) to drive
the pipeline. Each role (planner/generator/evaluator/simplifier) is a separate
agent session; the `dev-harness role` command manages transitions.

### Session Restart Enforcement (G25)
This harness works best with coding agents that support session end upon
completion. Agents that support `--exit-on-complete` + `--fresh-session` can
enforce full fresh-context boundaries via an external shell loop (the "Ralph
loop" pattern). See `docs/TOOL_INTEGRATION.md` for the bash script.

Interactive agents that cannot programmatically restart sessions get partial
enforcement — fresh context is human-controlled (advisory only). Role-based
gates (G21) still enforce role separation regardless.

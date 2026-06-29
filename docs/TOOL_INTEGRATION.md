# Tool Integration

## Architecture: Agent-as-Frontend

Dev Harness is a **backend CLI**. Your coding agent is the **frontend** — it reads
instruction files and calls CLI commands to follow the workflow.

```
User → starts coding agent → agent reads AGENTS.md → agent calls dev-harness CLI
```

1. **`dev-harness init`** scaffolds the project with `AGENTS.md` + phase skills
2. **Agent reads `AGENTS.md`** (or its tool-specific file) — sees the workflow:
   - `dev-harness status` → check current phase (clock-in)
   - Read `harness/docs/phases/<phase>.md` → phase skill
   - Do the work
   - `dev-harness validate` → check gates
   - `dev-harness phase next` → advance
3. **Agent calls CLI commands** to progress through the pipeline
4. **Dev Harness enforces** gates, phase order, role separation, and state via the CLI backend

No spawning, no orchestrator, no TUI — the agent tool's native UI is the interface.

## Agent Tool Selection

Use `--agent-tool` at init to generate tool-specific instruction files:

```bash
# AGENTS.md only (works with any agent that reads it)
dev-harness init --stack node

# Generate tool-specific instruction file (replica of AGENTS.md)
dev-harness init --stack node --agent-tool claude-code  # → CLAUDE.md
dev-harness init --stack node --agent-tool cursor       # → .cursorrules

# Generate SKILL.md manifest format (for agents that use the skill format)
dev-harness init --stack node --agent-tool skill

# Multiple tools (comma-separated)
dev-harness init --stack node --agent-tool claude-code,cursor

# All supported tools
dev-harness init --stack node --agent-tool all
```

> **All instruction files are generated from `AGENTS.md` content** — single source of truth. `CLAUDE.md` and `.cursorrules` are replicas with a tool-specific header. `skill` is a manifest format (SKILL.md + wrapper scripts), not a tool name.

## Adapter Architecture

Each tool has an adapter directory under `adapters/`:

```
adapters/
├── skill/               — SKILL.md + wrapper scripts + templates symlink
├── claude-code/         — README (CLAUDE.md generated from AGENTS.md)
├── cursor/              — README (.cursorrules generated from AGENTS.md)
├── codex/               — README (reads AGENTS.md natively)
├── opencode/            — README (reads AGENTS.md natively)
├── antigravity/         — README (reads AGENTS.md natively)
├── openclaw/            — README (reads AGENTS.md natively)
└── generic/             — README (default, AGENTS.md only)
```

Adapters are documentation + (for skill) wrapper scripts. The CLI core stays
tool-agnostic. `init --agent-tool <name>` generates the tool-specific instruction
file from AGENTS.md content.

## Workflow Enforcement

Dev Harness enforces the workflow through the CLI backend:

| Enforcement | Mechanism | How |
|-------------|-----------|-----|
| **Gate validation** | `dev-harness validate` | Runs deterministic checks per phase — must pass before advancing |
| **Phase order** | `dev-harness phase next` | Enforces define→plan→build→verify→review→ship — can't skip |
| **State tracking** | `harness/config.json` | Tracks current phase, feature, task, role, retry counters (task/feature/phase), gate history |
| **Role gates** | `dev-harness role` | BUILD/VERIFY validate requires evaluator; DEFINE task-level requires planner; contract propose requires planner; contract review requires evaluator |
| **Self-eval guard** | `producedByRole` tracking | Generator cannot evaluate its own work — if `producedByRole === currentRole`, validation is blocked |
| **Pass criteria (3 levels)** | Task (`acceptanceCriteria`), feature (`definitionOfDone`), phase (`Verification Criteria`) | All must be non-empty + non-placeholder before advancing |
| **Personas** | `agents.tone.*` | Injected into `role` command output per role |
| **Instructions** | `AGENTS.md` + phase skills | `CLAUDE.md` and `.cursorrules` are replicas of `AGENTS.md` generated at init |

The agent cannot advance without:
1. Passing gates (`validate` returns PASS)
2. Calling `phase next` (which checks gates first)

## Retry Configuration

The 3-level retry escalation chain (task → feature → phase → human) is
configurable via `config set`:

```bash
# Enable feature-level retry
dev-harness config set retry.features.enabled true

# Enable phase-level retry
dev-harness config set retry.phases.enabled true

# Set retry budgets
dev-harness config set retry.tasks.maxRetries 5
dev-harness config set retry.features.maxRetries 3
dev-harness config set retry.phases.maxRetries 2
```

See [CONFIGURATION.md](CONFIGURATION.md) for full reference.

## Multi-Agent Role Framework (G20-G23)

The harness implements a planner/generator/evaluator/simplifier committee via
**separate agent sessions per role** (not harness-spawned — backend-only).

### How it works

1. Each role = a separate agent session
2. `dev-harness role <name>` sets `currentRole`, fires the session boundary (writes handoff + clean-state check), and prints the role skill
3. Role-based gates enforce separation:
   - `validate` in BUILD/VERIFY requires `currentRole=evaluator` (G21)
   - `contract propose` requires `currentRole=planner` (G21)
   - `contract review` requires `currentRole=evaluator` (G21)
4. Self-evaluation guard (G23): generator cannot evaluate its own work (`producedByRole === currentRole` → blocked)

### Role transition = session boundary

Each `dev-harness role <name>` call is a session boundary (trigger #7). The harness:
- Writes `harness/session-handoff.md` (overwrite — clock-out snapshot)
- Runs the clean-state gate (advisory)
- Appends to `harness/progress.md` (history log)

The next session reads the handoff first (clock-in) to resume from the exact state.

## Session Restart Enforcement (G25)

Fresh-context boundaries depend on agent tool capabilities.

### Agents that support session-end-on-completion — full enforcement

Agents that support `--exit-on-complete` + `--fresh-session` can enforce a full
fresh-context boundary via an external shell loop (the "session-enforcement loop").

Dev Harness ships two ready-to-use session-enforcement scripts, scaffolded into
every project at `harness/scripts/` during `dev-harness init`:

- **`harness/scripts/run-hermes-session.sh`** — Session-enforcement wrapper for Hermes
- **`harness/scripts/run-openclaw-session.sh`** — Session-enforcement wrapper for OpenClaw

Each script:
1. Clocks in (`dev-harness status`) to get current phase, feature, task, role
2. Builds a task prompt from the current state
3. Runs the agent with `--fresh-session --exit-on-complete` (no context carryover)
4. Checks gates (`dev-harness validate`)
5. Advances if gates pass (`dev-harness phase next`)
6. Repeats until pipeline complete or max iterations reached

```bash
# Run with Hermes (from project root)
./harness/scripts/run-hermes-session.sh

# Run with OpenClaw
./harness/scripts/run-openclaw-session.sh

# Verbose mode
VERBOSE=1 ./harness/scripts/run-hermes-session.sh

# Custom max iterations
MAX_ITERATIONS=50 ./harness/scripts/run-openclaw-session.sh
```

Or write your own loop:

```bash
#!/bin/bash
cd /path/to/project

while ! dev-harness status --json | jq -e '.status == "complete"' >/dev/null 2>&1; do
  STATUS=$(dev-harness status --json)
  PHASE=$(echo "$STATUS" | jq -r '.currentPhase')
  FEATURE=$(echo "$STATUS" | jq -r '.currentFeature // "null"')
  TASK=$(echo "$STATUS" | jq -r '.currentTask // "null"')

  # Run agent with FRESH session
  your-agent --task "Phase: $PHASE, Feature: $FEATURE, Task: $TASK" \
    --fresh-session --exit-on-complete

  # Validate and advance
  dev-harness validate --json
  dev-harness phase next --json
done
```

This guarantees a fresh agent context at every task boundary — the strongest
form of context isolation available.

### Interactive agents — advisory only

Interactive agents that cannot programmatically restart sessions get partial
enforcement. Fresh context is **human-controlled**:

- The harness still enforces the *what* (role separation via G21 gates, clean
  handoffs, state tracking) regardless of session freshness
- The human must manually start a new session at each role transition
- `dev-harness role <name>` writes the handoff so the new session can clock-in

### What the harness enforces regardless of agent

| Enforcement | All agents | Session-end-capable agents |
|-------------|-----------|---------------------------|
| Role separation (G21 gates) | ✅ | ✅ |
| Self-eval guard (G23) | ✅ | ✅ |
| Clean handoff at boundaries | ✅ | ✅ |
| Clean-state gate (G17) | ✅ | ✅ |
| Fresh context per session | ❌ (human-controlled) | ✅ (via session-enforcement loop) |

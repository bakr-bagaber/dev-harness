# CLI Commands Reference

## Pipeline

| Command | Purpose |
|---------|---------|
| `harness-dev init [--stack <name>] [--gates] [--worktree]` | Scaffold harness in current dir |
| `harness-dev phase <name>` | Run a phase (define\|plan\|build\|verify\|simplify\|review\|ship) |
| `harness-dev validate [--feature X --task Y]` | Run gate checks (or per-task check) |
| `harness-dev set-mode <mode>` | Switch copilot/autopilot |

## State

| Command | Purpose |
|---------|---------|
| `harness-dev status [--target <dir>]` | Show current phase + mode + stack + gate state |
| `harness-dev config get [key]` | Get config value (omit key for all) |
| `harness-dev config set <key> <value>` | Set config value (e.g. `gates.enabled true`) |
| `harness-dev pause` | Pause autopilot execution |
| `harness-dev resume` | Resume autopilot execution |
| `harness-dev learn <message>` | Append a lesson to progress.md |

## Agent Workflow (Sprint Contract)

| Command | Purpose |
|---------|---------|
| `harness-dev contract propose` | Write/update sprint-contract.md (Planner) |
| `harness-dev contract review` | Evaluator reviews contract, sets status |
| `harness-dev contract status` | Show current contract negotiation state |
| `harness-dev contract escalate` | Human adjudication when agents can't agree |

## Git Workflow

| Command | Purpose |
|---------|---------|
| `harness-dev worktree create <name>` | Create isolated worktree for a feature |
| `harness-dev worktree list` | List active worktrees |
| `harness-dev worktree prune` | Remove orphaned worktrees |
| `harness-dev worktree remove <name>` | Clean up worktree (optionally merge branch) |
| `harness-dev rollback list` | Show available checkpoints |
| `harness-dev rollback to <checkpoint>` | Restore state to a checkpoint |
| `harness-dev rollback branch <checkpoint>` | Branch off a good iteration |
| `harness-dev checkpoint create <label>` | Force a manual checkpoint tag |

## Common Patterns

```bash
# See where you are
harness-dev status

# Run a phase (copilot mode — default)
harness-dev phase build

# Validate (per-task for feature-iterate phases)
harness-dev validate --feature user-auth --task 3

# Enable gates
harness-dev config set gates.enabled true

# Set max retries for a cheap model
harness-dev config set maxRetries 10

# Manual checkpoint
harness-dev checkpoint create "before-refactor"

# Rollback to a good iteration
harness-dev rollback branch iter/3

# Worktree isolation
harness-dev worktree create user-auth
cd ../feat-user-auth && harness-dev phase build
```

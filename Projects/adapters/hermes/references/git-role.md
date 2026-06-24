# Git as State Machine — The Harness Backbone

**Git is the harness's state machine, not its version control system.** Every phase, every gate, every iteration depends on git operations. Without git, the harness has no context freshness, no state visibility, no undo, no rollback.

## Core Principle

The harness achieves three things through git that no other mechanism can:

1. **Context freshness** — `git stash/reset/pull` before each iteration gives the agent a clean slate. This is the Ralph pattern.
2. **Gate integrity** — `git diff --quiet` before any gate check ensures evaluation is against committed code, not half-edited experiments.
3. **Recovery** — every phase transition is a commit. Every pipeline iteration is a tag. You can `git reset --hard` or `git revert` to any known-good state.

## Context Freshness: The Ralph Pattern

Every iteration of the inner loop must start with:

```bash
# Step 1: Stash any in-progress work
git stash --include-untracked

# Step 2: Reset working tree to last committed state
git checkout -- .

# Step 3: Get latest from upstream (only if tracking a remote)
git pull --rebase
```

After these three commands, the working tree is **exactly** what was last committed — no leftover artifacts, no half-edited files, no junk from previous iterations.

**Why this matters:** Without this reset, the next iteration's agent inherits:
- Failed test outputs (`*.pyc`, `__pycache__/`, `.pytest_cache/`)
- Half-edited files that never compiled
- Log files from the previous run
- Accumulated garbage in `node_modules/`, `target/`, etc.

The agent can't distinguish "this file is broken from the last iteration" from "this file is broken in the current attempt." The reset eliminates the ambiguity.

**Common pitfall:** Running `git stash` without `--include-untracked`. Untracked files (test outputs, logs, generated files) survive a plain `git stash` and pollute the next iteration. Always use the full flag.

## Gate Git Commands

Every gate check includes specific git commands. These are the EXACT commands that run:

| Phase | Command | What It Verifies |
|-------|---------|-----------------|
| INIT | `git rev-parse --git-dir` | We're in a git repository (returns 0 if yes) |
| DEFINE | `git symbolic-ref HEAD 2>/dev/null` | On a feature branch, not `main` (branch name is returned) |
| PLAN | `git diff --quiet` | Plan is committed (dirty tree = gate failure) |
| BUILD | `git diff --quiet` | Working tree is clean (work is committed) |
| VERIFY | `git diff --quiet` | Clean state before running tests |
| SIMPLIFY | `git diff --quiet` | Refactoring is committed (clean after changes) |
| REVIEW | `git merge-base --is-ancestor main HEAD` | Branch is up-to-date with main (no merge conflicts) |
| SHIP | `git status --porcelain` + `git describe --exact-match HEAD` | Clean AND tagged |

**Return value convention:** All these commands return exit code 0 for pass, non-zero for fail. The gate engine does NOT parse stdout/stderr for these checks — exit code is the authoritative signal.

## Phase Transition Commits

Every time the harness transitions from one phase to the next, it must commit:

```bash
git commit -am "harness: <phase> complete"
```

Where `<phase>` is the name of the phase that just completed (e.g., "build", "verify", "simplify").

This creates a checkpoint. Benefits:
- You can `git diff` to see exactly what changed in the phase
- You can `git reset --hard <sha>` to roll back to the start of any phase
- The git log tells the full harness story: `git log --oneline` shows every phase boundary

## Pipeline Iteration Tags

Every complete outer-loop pipeline iteration gets an annotated tag:

```bash
git tag -a iter/<N> -m "harness pipeline iteration <N>"
```

Where N increments from 1. These tags enable:

**Middle iteration recovery** (Anthropic pattern):
- User says "go back to iteration 3, that was better"
- `git checkout iter/3`
- `git branch feat/recovery-from-iter3`
- Continue from there

Without these tags, there is no mechanism to recover a preferred middle state. The iteration tag is the only link between the user's memory ("iteration 3 was good") and the actual code state.

## Worktree Isolation (OpenAI Pattern)

For parallel feature development, each feature branch gets its own worktree:

```bash
git worktree add ../feat-<name> feat/<name>
```

Each worktree has:
- Its own working directory (no cross-contamination)
- Its own `node_modules/`, `.venv/`, `target/`, etc.
- Its own git HEAD

**Lifecycle:**
- Create: `git worktree add ../feat-auth feat/auth` (when feature branch exists)
- List: `git worktree list`
- Remove: `git worktree remove ../feat-auth` (after branch merges)
- Prune orphans: `git worktree prune`

## Rollback Protocol

Every release creates an annotated tag. The rollback script (`scripts/rollback.sh`) does:

```bash
#!/bin/bash
# Rollback to previous release
REVERT_FROM="v$1"
REVERT_TO="v$(( $1 - 1 ))"
git revert $REVERT_TO..$REVERT_FROM --no-edit
git tag -a rollback/v$1 -m "rollback from $REVERT_FROM to $REVERT_TO"
```

The SHIP gate validates:
1. `git status --porcelain` returns nothing (clean working tree)
2. `git describe --exact-match HEAD 2>/dev/null` returns a tag (current commit is tagged)
3. Rollback script exists at `scripts/rollback.sh`
4. Rollback script runs with dry-run: `bash scripts/rollback.sh --dry-run`

## Git State in Config

The harness-config.json tracks git state so the CLI and agents can query it without running git commands:

```json
{
  "git": {
    "branch": "feat/token-refresh",
    "clean": true,
    "hasUpstream": true,
    "lastCommitMessage": "harness: build complete"
  }
}
```

Updated on every phase transition. The state machine sets these from `git rev-parse --abbrev-ref HEAD` and `git diff --quiet && git diff --cached --quiet`.

## Common Pitfalls

1. **Missing `--include-untracked`**: Plain `git stash` doesn't stash untracked files. Test outputs, logs, and generated artifacts survive and pollute the next iteration. Always use `git stash --include-untracked`.

2. **Not checking `git diff --cached`**: `git diff --quiet` only checks the working tree vs index. If files are staged but not committed (e.g., after `git add`), they pass the check. Use `git diff --quiet && git diff --cached --quiet` to catch both.

3. **Amending instead of committing**: `git commit --amend` changes history. Phase transition commits should be regular commits, not amends, so the full harness history remains intact.

4. **No tag on incomplete pipeline**: If the pipeline doesn't complete all phases, don't tag. Tags should only mark complete outer-loop iterations. WIP state is captured in feature branch commits.

5. **GitHub Actions not wired**: The harness gate commands (`git rev-parse`, `git diff --quiet`, etc.) work locally but don't automatically translate to GitHub CI checks. If using GitHub, add a `ci.yml` that runs the gate commands on PR.

## Source Alignment

| Pattern | Source | Implemented |
|---------|--------|-------------|
| Context freshness via git stash/reset | Ralph | T8 inner loop |
| Gate checks with exact git commands | walkinglabs, Anthropic | T7 gates |
| Phase transition commits | Anthropic (implied) | T9 outer loop |
| Pipeline iteration tags | Anthropic (middle iterations) | T9 outer loop |
| Worktree isolation per feature | OpenAI | Documented only, no CLI task |
| Rollback via annotated tags | addyosmani | SHIP gate |
| Git state in config | Dev-harness design | T5 state machine |

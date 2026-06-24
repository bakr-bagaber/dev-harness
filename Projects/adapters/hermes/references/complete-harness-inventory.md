# Complete Harness File Inventory

Everything an agentic harness should consider. Catalogued with source attribution
and coverage status in current architecture plan.

## The 18 Files

### Instructions Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 1 | `AGENTS.md` (or `CLAUDE.md`) | Root agent instructions — ~100 line map to docs/ | walkinglabs, OpenAI, Anthropic, Ralph | ✅ covered |
| 2 | `docs/<topic>-patterns.md` | Generic topic-doc system — per-domain instructions (e.g. `api-patterns.md`, `db-patterns.md`, `ui-patterns.md`) | OpenAI (progressive disclosure via docs/references/) | ❌ NOT covered as generic pattern |

### Knowledge Architecture Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 3 | `ARCHITECTURE.md` | System architecture overview | OpenAI | ✅ covered |
| 4 | `CONSTRAINTS.md` | Known constraints, trade-offs, non-goals | Anthropic, OpenAI | ❌ NOT covered |
| 5 | `DECISIONS.md` | Decision record / ADR log — what was decided, why, alternatives | Ralph (progress.txt captures decisions) | ❌ NOT covered as standalone file |

### Scope Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 6 | `feature-list.json` | All features enumerated, `status: not_started\|in_progress\|passing` | Anthropic, walkinglabs, Ralph | ✅ covered |
| 7 | `feature-list.schema.json` | JSON schema validating feature-list.json structure | walkinglabs | ❌ NOT covered |

### State Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 8 | `PROGRESS.md` (or `progress.md` / `claude-progress.md`) | Session-to-session handoff — current status, blockers, next actions | Anthropic, walkinglabs | ✅ covered |

### Lifecycle Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 9 | `init.sh` | Install, verify, start — one-command bootstrap | Anthropic, walkinglabs | ✅ covered |
| 10 | `session-handoff.md` | Compact handoff note at end of long session | walkinglabs | ✅ covered |
| 11 | `clean-state-checklist.md` | End-of-session hygiene — commit, push, verify | walkinglabs | ✅ covered |

### Evaluation Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 12 | `evaluator-rubric.md` | Output quality scorecard — 6 dimensions scored 0-2 | walkinglabs | ✅ covered |
| 13 | `sprint-contract.md` | Pre-build verification agreement — Generator proposes, Evaluator agrees | Anthropic | ✅ covered |

### Project Config Layer

| # | File | Purpose | Source | Plan? |
|---|------|---------|--------|-------|
| 14 | `pyproject.toml` | Python project metadata, deps, tool config | OpenAI (boring tech — stable, composable APIs) | ❌ NOT covered |
| 15 | `package.json` | Node.js project metadata, deps, scripts | OpenAI (boring tech) | ❌ NOT covered |
| 16 | `.nvmrc` | Node.js version pin | OpenAI (boring tech — deterministic env) | ❌ NOT covered |
| 17 | `.python-version` | Python version pin | OpenAI (boring tech — deterministic env) | ❌ NOT covered |

### Multi-Agent Architecture

| # | Component | Purpose | Source | Plan? |
|---|-----------|---------|--------|-------|
| 18 | Planner + Generator + Evaluator | 3-agent pipeline: Planner specs, Generator builds, Evaluator QA-checks | Anthropic | ✅ covered |

## Summary

| Status | Count | Items |
|--------|-------|-------|
| ✅ Covered | 10 | AGENTS.md, ARCHITECTURE.md, feature-list.json, PROGRESS.md, init.sh, session-handoff.md, clean-state-checklist.md, evaluator-rubric.md, sprint-contract.md, Planner/Generator/Evaluator |
| ❌ Not covered | 8 | docs/<topic>-patterns.md (generic), CONSTRAINTS.md, DECISIONS.md, feature-list.schema.json, pyproject.toml, package.json, .nvmrc, .python-version |

## Notes

- **Project config files** (pyproject.toml, package.json, .nvmrc, .python-version) aren't harness-specific — they're standard dev tooling. But a complete harness must either define them or declare conventions for version pinning. OpenAI's "boring tech" principle: stable, widely-known APIs with high training set representation.
- **CONSTRAINTS.md** and **DECISIONS.md** are lightweight docs that save enormous rework. CONSTRAINTS.md prevents the agent from re-opening settled design questions. DECISIONS.md prevents repeating the same deliberation every session.
- **feature-list.schema.json** enables mechanical validation before gates. Without a schema, malformed feature-list.json can break the entire loop.
- **docs/<topic>-patterns.md** is OpenAI's progressive disclosure pattern — instead of dumping every convention into AGENTS.md, create per-topic doc files that the agent reads on demand.

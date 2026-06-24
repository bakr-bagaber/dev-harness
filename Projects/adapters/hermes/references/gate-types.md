# Two Gate Types — Contract vs Phase

## Problem

The term "gate" was overloaded. In Anthropic's system, a gate is an agent-to-agent negotiation (Evaluator judges Generator output). In our CLI, a gate is a set of deterministic shell commands (lint, test, coverage). These are different mechanisms for different purposes.

## The Two Gate Types

### 1. Contract Gate (Anthropic-style)

**What it is:** Agent-to-agent negotiation. Planner proposes what to build and how success will be verified. Evaluator reviews and rejects/approves. If rejected, Planner revises. Iterate until agreement.

**When it runs:** Before BUILD phase (Sprint Contract negotiation).

**What it evaluates:**
- Scope clarity (no "improve", "enhance", "optimize" — be specific)
- Verification criteria testability (must be runnable commands, not "looks good")
- Exclusion reasonableness ("We will NOT build X" must be justified)

**Mechanism:**
```
Planner proposes → Evaluator reviews → reject with reason → Planner revises → loop (max 5 rounds)
                                      → approve → "Agreed" → BUILD gate unblocks
```

**CLI commands:** `harness-dev contract propose`, `harness-dev contract review`, `harness-dev contract status`, `harness-dev contract escalate`

**Limitation:** Requires two LLM calls (Planner + Evaluator). Subjective — Evaluator's judgment varies by model.

### 2. Phase Gate (Deterministic, our innovation)

**What it is:** Shell commands with binary pass/fail from tool exit codes. Runs at every phase boundary.

**When it runs:** After each phase completes (after all features/tasks pass).

**What it evaluates:**
- INIT: `git rev-parse --git-dir`
- DEFINE: `git symbolic-ref HEAD` (feature branch, not main)
- BUILD: linter, imports, tests
- VERIFY: test coverage (≥80%), browser evidence
- SIMPLIFY: dead code check, nesting depth
- REVIEW: `git merge-base --is-ancestor main HEAD` (up-to-date)
- SHIP: `git describe --exact-match`, clean status

**Mechanism:**
```
harness-dev validate → (if gates.enabled) run check list → all pass → advance phase
                                                        → any fail → print failures → retry
```

**CLI command:** `harness-dev validate` (or `harness-dev validate --feature X --task Y` for task-level).

**Limitation:** Only catches what tools can detect. Cannot judge design quality, edge case handling, or architectural fit.

## When Each Applies

| Situation | Gate to use |
|-----------|-------------|
| "Is this design sound?" | Contract gate (Anthropic-style agent negotiation) |
| "Does the code compile?" | Phase gate (deterministic CLI checks) |
| "Are we building the right thing?" | Contract gate |
| "Is it built correctly?" | Phase gate |
| "Can I merge this PR?" | Both — contract gate for design, phase gate for CI |

## Implementation Notes

- Contract gate runs agent-to-agent negotiation in the user's conversation (not CLI-internal)
- Phase gate runs as CLI subprocesses (tool calls from agent)
- Contract gate is hard — two agents negotiating is expensive. Only run it before BUILD, not at every phase.
- Phase gate is cheap — shell commands. Run at every phase boundary.
- Contract gate failure → human adjudication (max 5 rounds then escalate)
- Phase gate failure → inner loop retry (task level, up to maxRetries times)
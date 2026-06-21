# Dev Harness Architecture

## Layered Design

```
┌─────────────────────────────────────────────────────────────────┐
│                     AGENTIC LOOP                                  │
│  (Hermes conversation loop — observe → think → act → repeat)     │
├─────────────────────────────────────────────────────────────────┤
│                     PLAYBOOK                                      │
│  agent-skills-workflow — routes task type to phase skill          │
├─────────────────────────────────────────────────────────────────┤
│                     ORCHESTRATOR                                   │
│  dev-harness — state machine, subagent pool, tool integration     │
├─────────────────────────────────────────────────────────────────┤
│                     TOOL INTEGRATIONS                              │
│  OpenProject | GitHub | Zulip | Ops/Obsidian                      │
├─────────────────────────────────────────────────────────────────┤
│                     DETERMINISTIC GATES                            │
│  gates.py — file exists, lint, test pass, no circular deps        │
└─────────────────────────────────────────────────────────────────┘
```

## State Machine

```
PHASE_ORDER = ["define", "plan", "build", "verify", "review", "ship"]

Each phase has:
  status: pending → active → done | blocked
  gate:   None → pass | fail
  workers: []  (list of subagent task IDs)
  artifacts: []  (files produced)
  started_at, completed_at: ISO timestamps
```

> **Note:** The original walkinglabs addyosmani/agent-skills v1 used "spec" and "test"
> as both phase names and slash commands. In the canonical pipeline, phase names are
> DEFINE and VERIFY; the slash commands remain `/spec` and `/test`. Update any code
> referencing `PHASE_ORDER = ["spec", "plan", "build", "test", "review", "ship"]` to
> use the correct phase names.

## OpenProject Integration

### Phase ↔ Status Mapping

| Harness Phase | OP Status ID | OP Status Name |
|---------------|-------------|----------------|
| define (start) | 3 | In specification |
| define (done) | 4 | Spec approved |
| plan (start) | 2 | In progress |
| build (start) | 5 | In implementation |
| verify (start) | 6 | In review |
| review (start) | 6 | In review |
| review (done) | 7 | Peer reviewed |

## Full Architecture Plan

For a comprehensive, 700-line architecture and implementation plan that
synthesizes 15+ published sources, see:

**`~/ops/Projects/dev-harness/docs/analysis/harness-architecture-plan.md`**

That plan covers: walkinglabs 5-subsystem, Ralph loop, Generator/Evaluator
split, Sprint Contract, progressive disclosure knowledge architecture,
IMPACT framework mapping, multi-agent committee, evaluation rubric, and
a 6-phase implementation plan from Phase 0 (init) through Phase 5 (ship).

It is a research synthesis — it explicitly excludes pre-existing Hermes
infrastructure. This file (references/architecture.md) documents the
existing dev-harness orchestrator implementation. The two documents are
complementary: the plan is the "what and why", this file is the "what was built."

## Worker Architecture

```
User Request
     │
     ▼
┌──────────┐
│ Context  │   Index: instructions, artifact prefix, OpenProject work
│ Assembly │   package info, progress from last session, hints
└────┬─────┘
     │
     ▼
┌──────────┐
│ Decide   │   Phase selection → load sub-skills → gate confirmation
│ Strategy │   Generate plan → delegate to worker agents
└────┬─────┘
     │
     ▼
┌──────────┐       ┌──────────┐       ┌──────────┐
│ Worker 1 │       │ Worker 2 │       │ Worker N │
│ Task     │       │ Task     │       │ Task     │
│ (gate)   │       │ (gate)   │       │ (gate)   │
└────┬─────┘       └────┬─────┘       └────┬─────┘
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────────────────────────────────────────┐
│            Gate Verification                  │
│  lint pass, test pass, feature_list updated  │
└─────────────────────────────────────────────┘
```

# T10 Phase Instruction Format

Each `harness-dev phase <name>` call produces detailed agent instructions.
The format depends on the phase type.

## Feature-iterate phases (BUILD, VERIFY, SIMPLIFY)

```
═══ BUILD PHASE ═══

This is a feature-iterate phase. You pick one incomplete
feature at a time. If validation fails (up to 3
attempts), retry that task with fresh context.

Current feature: "Feature 1" (feature-001)
Current task: "First task" (task-001)

Planner: pick next feature from feature_list.json where passes=false
         Select one uncompleted task from that feature's task list

Generator: implement ONE task only. When done, call validate.

Evaluator: verify against that task's acceptance criteria.
           Run the verification commands yourself.

Iteration pattern:
  Pick task → implement → validate --feature feature-001 --task task-001
  → Pass: mark task complete, pick next task
  → Fail (≤3x): git auto-commit, retry with fresh context
  → Fail (>3x): escalate to human
```

## Deliverable-retry phases

### DEFINE

```
═══ DEFINE PHASE ═══

This is a deliverable-retry phase. You produce one deliverable.
If validation fails (up to 3 attempts), retry with fresh context.

Planner: interview the user, write PRD in specs/*.md,
         define acceptance criteria per feature

Generator: produce spec documents (specs/*.md,
           sprint-contract.md) following the PRD

Evaluator: verify against these criteria:
  - All 5 spec sections present (overview, requirements,
    acceptance criteria, edge cases, open questions)
  - No TODO/FIXME placeholders in specs
  - Sprint Contract agreed between Planner and Evaluator

When done, run: harness-dev validate
```

### PLAN

```
═══ PLAN PHASE ═══

This is a deliverable-retry phase. You produce one deliverable.
If validation fails (up to 3 attempts), retry with fresh context.

Planner: decompose features into tasks in feature_list.json
         Define task dependencies and effort estimates

Generator: populate feature_list.json with all features
           and tasks for this sprint

Evaluator: verify against these criteria:
  - feature_list.json is valid JSON
  - All features have at least one task
  - DAG of tasks is acyclic

When done, run: harness-dev validate
```

### REVIEW

```
═══ REVIEW PHASE ═══

This is a deliverable-retry phase. You produce one deliverable.
If validation fails (up to 3 attempts), retry with fresh context.

Planner: review all phase gates have passed
         Identify any outstanding blockers

Generator: update evaluator-rubric.md with results
           Ensure CHANGELOG.md is updated

Evaluator: verify against these criteria:
  - Branch up-to-date with main
  - All gates pass (lint, tests, coverage)
  - Sprint contract acceptance criteria met

When done, run: harness-dev validate
```

### SHIP

```
═══ SHIP PHASE ═══

This is a deliverable-retry phase. You produce one deliverable.
If validation fails (up to 3 attempts), retry with fresh context.

Planner: verify pipeline is complete
         Prepare release notes

Generator: tag commit, update changelog,
           verify git clean

Evaluator: verify against these criteria:
  - Git status is clean
  - HEAD is tagged
  - CHANGELOG.md updated

When done, run: harness-dev validate
```

## Implementation

Output builders live in `cli/lib/ralph-inner.mjs`:

- `buildFeatureIterateOutput()` — produces feature-iterate format
- `buildDeliverableRetryOutput()` — produces deliverable-retry format with a `switch (phase)` block for phase-specific instructions

The phase command in `cli/commands/phase.mjs` calls `runPhase()` which calls the appropriate output builder and prints the result to stdout. The `--json` flag returns structured JSON instead.

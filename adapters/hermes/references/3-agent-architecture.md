# 3-Agent Architecture Reference (Planner, Generator, Evaluator)

## Core Rule

**No agent evaluates its own work.** Generator self-checks before handoff, but final authority is always the Evaluator. Self-evaluation is inherently lenient (Anthropic finding: "Tuning a standalone evaluator to be skeptical is far more tractable than making a generator critical of its own work").

## Agent Roles Across All Phases

The Generator adopts a **specialized persona** per phase. This preserves the 3-agent architecture while giving each phase a distinct identity.

| Phase | Planner | Generator → Persona | Evaluator |
|-------|---------|---------------------|-----------|
| DEFINE | Interviews user, writes PRD, defines acceptance criteria | **Documenter** — writes spec documents (specs/*.md, sprint-contract.md) | Checks: no ambiguity, all sections present, no TODOs |
| PLAN | Designs task DAG, sets task sizes (one context window each) | **Planner** — writes plan.json, estimates task effort | Validates: DAG acyclic, tasks right-sized |
| BUILD | Picks next story from feature_list.json | **Builder** — implements ONE story, runs tests, commits | Verifies: acceptance criteria pass, lint clean, no regressions |
| VERIFY | Defines test strategy, coverage targets, browser test plan | **Tester** — runs full suite, captures browser screenshots | Checks: coverage ≥80%, browser verified, no regressions |
| SIMPLIFY | Identifies code smells, excessive nesting, DRY violations, premature optimization | **Simplifier** — refactors code for clarity, removes dead code, extracts repeated logic, simplifies conditionals | Verifies: no dead code, no deep nesting (>4 levels), no DRY violations, no premature optimization |
| REVIEW | Sets review criteria from sprint-contract.md | **Reviewer** — produces review report, lists all findings | Final check: all criteria from sprint contract met |
| SHIP | Defines release checklist, rollback plan | **Release Engineer** — runs release process, updates changelog, tags | Verifies: git clean, rollback script exists |

### The Simplifier Persona

During the SIMPLIFY phase, the Generator adopts the **Simplifier** persona — refactoring specialist:

| Dimension | Builder (BUILD) | Simplifier (SIMPLIFY) |
|-----------|-----------------|-----------------------|
| **Mantra** | "Make it work" | "Make it clean" |
| **Focus** | Implement feature correctly | Refactor for clarity, remove duplication |
| **Output** | New code, new tests | Cleaned-up code, no behavior change |
| **Success** | Feature works, tests pass | Code is simpler, nesting reduced, DRY |
| **Anti-regex** | "It works, ship it" | "It works, but is it clear?" |

**Simplifier rules of thumb:**
- Extract repeated logic into shared functions — but only if the extraction is genuinely simpler
- Flatten nested conditionals — max 4 levels of nesting
- Remove dead code and commented-out blocks — git history preserved originals
- Rename unclear variables — but keep names consistent with project conventions
- Break long functions — threshold ~40 lines
- **Never change behavior** — tests must still pass after simplification

## Why Three, Not Four or More

Previous designs used a multi-agent committee (code-reviewer, test-engineer, security-auditor, web-perf-auditor) in PARALLEL during REVIEW only. This was:

1. **Overengineered** — most projects don't need 4 parallel reviewers for every phase
2. **Wrong phase** — review concerns should be embedded in EVERY phase, not just one
3. **No clear authority** — committee produced a synthesis, but who decides when there's disagreement?

The 3-agent architecture solves all three:
- Each agent has a clear, non-overlapping role
- Authority is always the Evaluator (single decision point)
- The cycle applies at every phase, not just review

## The Generator/Evaluator Iteration

```
Planner writes criteria
       │
       ▼
Generator produces output  ◄──────────────┐
       │                                   │
       ▼                                   │
Evaluator checks output ──fail──→ Generator revises
       │
  pass │
       ▼
  Advance to next phase
```

Each inner loop iteration is FRESH CONTEXT. The Generator does not remember previous failed attempts. This prevents compounding errors and hallucinated fixes.

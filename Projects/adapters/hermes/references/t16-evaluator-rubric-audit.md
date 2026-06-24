# T16 — Evaluator Rubric Template (2026-06-20)

## Spec

PROJECT_PLAN.md lines 1036-1065: Quality scorecard template with 6 dimensions scored 0-2.

## File

`templates/evaluator-rubric.md` (28 lines, 841 bytes)

## Audit Findings & Fixes

| # | Finding | Fix Applied | File |
|---|---------|-------------|------|
| 1 | T15 test D.6 expected 9 templates, now 10 | Bumped count 9→10 | `test-t15.mjs:202` |
| 2 | `evaluator-rubric.md` missing from conflict detection list | Added to `templateNames` array | `cli/commands/init.mjs:497` |
| 3 | AGENTS.md Key Files table didn't list rubric | Added row: "Quality scorecard (6 dimensions, 0-2)" | `templates/AGENTS.md:41` |
| 4 | Evaluator role guide didn't mention rubric | Added bullet: "Use `evaluator-rubric.md` to score quality across 6 dimensions" | `templates/docs/agents/evaluator.md:13` |
| 5 | No T16 test file | Created `test-t16.mjs` (74 assertions, 8 groups) | `test-t16.mjs` |
| 6 | REVIEW gate didn't check rubric completeness | Added `checkRubricExists()` function to gated engine | `cli/lib/gates.mjs:181-188,225` |

## Verification

```
$ node test-t15.mjs    # 205/205 pass (no regression)
$ node test-t16.mjs    # 74/74 pass (new tests)
```

8 test groups in test-t16.mjs:
- A. Template file existence (2)
- B. Spec compliance (16) — 6 dimensions, 0-2 scale, 3 thresholds
- C. Template variables: static file (1) — no `{{VAR}}`
- D. Template engine discovery (1)
- E. Init command integration (12) — created in target, correct content
- F. Cross-references (5) — evaluator.md, AGENTS.md, gates.mjs, ralph-inner.mjs, init.mjs
- G. Edge cases (12) — conflict detection, force re-init, all 9 stacks, JSON contract
- H. REVIEW gate rubric check (5) — pass with file, fail without, detail mentions "missing"

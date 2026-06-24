# Sprint Contract — Verify-Before-Build

## Origin

Anthropic's harness design for long-running apps (March 2026). In their 3-agent architecture
(Planner, Generator, Evaluator), the Generator and Evaluator negotiate a "Sprint Contract"
BEFORE any code is written. This prevents the Evaluator from being lenient on work it
watched being created — once the bar is set beforehand, the Generator must meet it.

## The Problem It Solves

Self-leniency: AI agents asked to evaluate their own work "tend to respond by confidently
praising the work — even when, to a human observer, the quality is obviously mediocre."
(Anthropic, 2026)

Once a contract is locked BEFORE coding begins, this bias is neutralized. The verification
criteria are independent of the implementation.

## Contract Structure

```json
{
  "contract_id": "SC-001",
  "feature_ids": ["US-001", "US-002"],
  "generator": "agent-session-abc123",
  "evaluator": "agent-session-def456",
  "proposed_at": "2026-06-16T10:00:00Z",
  "agreed_at": "2026-06-16T10:15:00Z",
  "verification_criteria": [
    {"id": "VC-001", "description": "pytest tests/api/v2/ passes", "type": "test_command"},
    {"id": "VC-002", "description": "mypy --strict produces no new errors", "type": "type_check"},
    {"id": "VC-003", "description": "POST /api/v2/users returns 201 with correct schema", "type": "api_test"},
    {"id": "VC-004", "description": "POST /api/v2/users with invalid body returns 422", "type": "api_test"},
    {"id": "VC-005", "description": "Playwright verifies new user flow in browser", "type": "browser_test"},
    {"id": "VC-006", "description": "Rollback: reverting the commit restores previous behavior", "type": "rollback_test"}
  ],
  "scope_boundaries": [
    "Do NOT modify auth middleware",
    "Do NOT modify database migration files outside users table",
    "Do NOT modify existing API contracts (backward compatibility)"
  ],
  "status": "active"  // "active" | "fulfilled" | "breached"
}
```

## Contract Negotiation Protocol

### Step 1: Generator Proposes

The agent that will implement the feature writes a proposal covering:

**Scope:**
- Which features/stories from feature_list.json will be implemented
- Which files will be created or modified
- Which files are explicitly OUT of scope (to prevent scope creep)

**Verification Criteria:**
For each criterion, specify:
- What command or test demonstrates success
- What the expected output is
- How to reproduce independently

**Example criteria by type:**
```
test_command:    "pytest tests/api/v2/ -x -q" exits 0
type_check:      "mypy src/ --strict" exits 0
lint_check:      "ruff check src/" exits 0
api_test:        "curl -X POST ... | jq '.id != null'" passes
browser_test:    "Playwright: click button -> see success toast"
rollback_test:   "git revert HEAD~1 && rerun tests" succeeds
observability:   "VictoriaMetrics: p99 latency < 200ms"
```

### Step 2: Evaluator Reviews

A separate evaluator agent (different session, clean context) reviews the proposal:

**What the evaluator checks:**
1. **Completeness:** Are there acceptance criteria from the spec that aren't covered?
2. **Specificity:** Are criteria measurable and verifiable by command?
   ("Looks right" → reject. "pytest passes" → accept.)
3. **Boundaries:** Are scope boundaries well-defined and respected?
4. **Regression risk:** Does this change risk breaking anything outside scope?
5. **Rollback:** Is there a rollback criterion? (Every change should have one.)
6. **Realism:** Can the criteria be met within the stated scope?

**Evaluator response:**
```
APPROVED — contract accepted as proposed
AMEND — accept with the following changes:
  [list of changes to criteria, scope, or boundaries]
REJECT — proposal is fundamentally incomplete or wrong:
  [detailed reasons]
```

### Step 3: Iterate Until Agreement

Generator and Evaluator exchange revisions. Each gets clean context per exchange.
After each revision, the evaluator re-reviews. Continue until APPROVED.

### Step 4: Lock the Contract

Once agreed, the contract is:
1. Written to `harness/state.json` under `sprint_contract`
2. Locked — no unilateral changes
3. Changes require a contract amendment (same process: propose → review → agree)

## When the Contract Is Enforced

At the REVIEW gate, every verification criterion is checked:
- All VC's must pass (automated checks)
- If any VC fails → contract is breached
- Breach triggers: generator must either fix the issue OR propose a contract amendment
  (cannot silently lower the bar)

## Sprint Contract Anti-Patterns

| Anti-Pattern | Why It Fails | Fix |
|-------------|--------------|-----|
| "Will verify manually" | Not verifiable by command | Convert to an automated check |
| No rollback criterion | Cannot revert if change breaks prod | Always add "git revert && tests pass" |
| Criteria too easy ("code compiles") | Doesn't verify correctness | Each AC from spec must have a VC |
| Generator writes easy criteria, evaluator accepts | Collusion | Evaluator must be skeptical (anthropic: "tuning a skeptical evaluator is tractable") |
| Contract changes mid-implementation | Scope creep, self-leniency | Formal amendment process only |
| No negative criteria ("won't break X") | Regression undetected | "Backward compatible: existing tests still pass" |

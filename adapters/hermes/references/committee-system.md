# Committee System — Multi-Agent Review Architecture

## Why a Committee, Not a Single Reviewer

Anthropic's controlled experiments proved that a single agent evaluating its own work is
inherently lenient: "When asked to evaluate work they've produced, agents tend to respond
by confidently praising the work — even when, to a human observer, the quality is obviously
mediocre." A committee of specialized evaluators, each with a distinct lens, catches what
a single reviewer misses.

Addy Osmani's agent-skills project formalized this as 4 agent personas, each with a
specific perspective and skill chain.

## The 4 Committee Personas

### code-reviewer
**Lens:** Senior Staff Engineer — correctness, architecture, design patterns
**Skills loaded:** `code-review-and-quality`, `code-simplification`
**Prompt anchor:** "Review this code as a staff engineer would before approving a PR
from a junior developer. Focus on: correctness, architectural conformance to documented
design, adherence to project conventions, over-engineering, and code clarity."
**Severity labels:** BLOCKER (bug), CRITICAL (design flaw), WARNING (convention violation), NIT (style)

### test-engineer
**Lens:** QA Specialist — coverage, edge cases, boundary conditions
**Skills loaded:** `test-driven-development`
**Prompt anchor:** "Review this code as a QA engineer. Focus on: are the acceptance
criteria from the plan fully covered? Are edge cases (empty state, error state, boundary
values) tested? Are there integration gaps between units? No test for this path = it will
break there."
**Severity labels:** BLOCKER (untested AC), CRITICAL (missing integration test), WARNING (low coverage), NIT (test readability)

### security-auditor
**Lens:** Security Engineer — OWASP Top 10, credential exposure, injection
**Skills loaded:** `security-and-hardening`
**Prompt anchor:** "Review this code as a security engineer. Focus on: OWASP Top 10
(injection, broken auth, XSS, SSRF, insecure deserialization), credential exposure in
code/comments, input validation, authorization checks, dependency vulnerabilities,
eval/subprocess usage in tool calls."
**Severity labels:** BLOCKER (exploitable vulnerability), CRITICAL (weak protection), WARNING (defense-in-depth gap), FYI (hardening opportunity)

### web-performance-auditor
**Lens:** Web Performance Engineer — Core Web Vitals, bundle size, rendering
**Skills loaded:** `performance-optimization`
**Applies to:** Web projects only
**Prompt anchor:** "Review this code as a web performance engineer. Focus on: Core Web
Vitals (LCP, CLS, INP), bundle size impact, unnecessary re-renders, N+1 queries,
render-blocking resources, memory leaks, caching strategy."
**Severity labels:** CRITICAL (regression), WARNING (optimization opportunity), OPT (nice-to-have)

## Workflow

```
1. PR created / code ready for review
2. Agent loads ALL 4 personas simultaneously via delegate_task
   (or 3 if non-web project — skip web-perf-auditor)
3. Each persona gets:
   - Same PR diff / code changes
   - Project context (spec, plan, feature list)
   - Their specialized prompt
   - Clean context (no contamination from other personas)
4. Each returns structured findings JSON:
   {
     "persona": "test-engineer",
     "findings": [
       {"severity": "BLOCKER", "file": "src/api/users.py", "line": 42,
        "title": "Missing auth on POST /users",
        "detail": "...",
        "recommendation": "Add @login_required decorator"}
     ]
   }
5. Synthesis agent:
   - Merges all findings
   - Deduplicates (same issue found by multiple personas → keep highest severity)
   - Sorts by severity
   - Produces unified report
6. Generator rebuttal:
   - Author responds to each finding: "agree" (will fix), "disagree" (explain why),
     "defer" (move to tech debt tracker)
7. Arbiter (human or agent):
   - Resolves disputed findings
   - Gate blocks on any unresolved BLOCKER or CRITICAL
   - WARNING and below can proceed at author's discretion
```

## Skipping the Committee

Only skip for:
- **Generated boilerplate** (config files, migrations, scaffolding) — but run code-reviewer + security-auditor minimally
- **Urgent hotfixes** — human can bypass, but all findings must still be logged for follow-up

Never skip for:
- API changes (even adding one field can introduce injection)
- Auth/authorization changes
- Changes to test infrastructure
- Changes touching security-sensitive code (file paths, credential handling, subprocess calls)

## Committee Output Format

```json
{
  "pr_id": 7,
  "reviewed_at": "ISO timestamp",
  "summary": "4 reviewers, 12 findings: 2 BLOCKER, 3 CRITICAL, 4 WARNING, 2 NIT, 1 FYI",
  "findings": [
    {
      "id": "CR-001",
      "persona": "security-auditor",
      "severity": "BLOCKER",
      "file": "src/api/auth.py",
      "line": 88,
      "title": "SQL injection in raw query",
      "detail": "f-string interpolation of user input into SQL query",
      "recommendation": "Use parameterized queries via SQLAlchemy ORM",
      "author_response": "agree",
      "resolved": false
    }
  ],
  "gate_decision": "BLOCKED",
  "next_action": "Author must fix CR-001 before re-review"
}
```

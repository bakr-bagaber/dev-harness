# Issues — dev-harness

## 2026-06-28 06:06 — Missing issues.md file re-created

- **Agent:** Infra Manager Agent
- **Type:** issue
- **Context:** ops-compliance-check daily scan detected that `history/issues.md` was missing from the dev-harness project. The initial compliance audit (2026-06-16) recorded the file as present, but it was not found on disk during the 2026-06-28 scan — likely lost during the v4.0.0 architecture reversal branch operations or a subsequent git operation.

**Root cause:** The file was likely created at project initialization but lost during one of the major branch merges (v3.0.0 TUI-first → v4.0.0 agent-as-frontend reversal) when entire directory structures were being rewritten. The changelog entry for 2026-06-16 mentions "Created history/ subfolder with changelog, decisions, issues, audit" but only changelog, decisions, and audit survived.

**Fix:** Re-created `history/issues.md` with this entry documenting the loss and recovery.

- **Impact:** No functional impact on the dev-harness tool itself — this is an ops/ structure compliance file. The dev-harness project now has all 4 required history files (changelog.md, decisions.md, issues.md, audit.md).
- **Verification:** `ls ~/ops/Projects/dev-harness/history/` shows all 4 files present.

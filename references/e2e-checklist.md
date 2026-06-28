# E2E Full Workflow — Auto-Generated Checklist

_Generated: 2026-06-28T07:56:45.931Z by `test/e2e-full-workflow.mjs`_

**Summary:** 437 pass, 0 fail, 437 total

| Suite | Cases | Passed | Failed | Status |
|-------|-------|--------|--------|--------|
| B-init | 62 | 62 | 0 | ✅ |
| C-copilot | 58 | 58 | 0 | ✅ |
| D-autopilot | 10 | 10 | 0 | ✅ |
| E-commands | 57 | 57 | 0 | ✅ |
| F-loops-retries | 12 | 12 | 0 | ✅ |
| G-gaps-coverage | 168 | 168 | 0 | ✅ |
| H-newly-fixed-gaps | 70 | 70 | 0 | ✅ |

## Per-Case Detail

### B-init

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | B1 init status=ok |
| 2 | ✅ | B1 has message |
| 3 | ✅ | B1 AGENTS.md exists |
| 4 | ✅ | B1 harness/config.json exists |
| 5 | ✅ | B1 feature-list.json exists |
| 6 | ✅ | B1 progress.md exists |
| 7 | ✅ | B1 sprint-contract.md exists |
| 8 | ✅ | B1 init.sh exists |
| 9 | ✅ | B1 evaluator-rubric.md exists |
| 10 | ✅ | B1 phase define.md exists |
| 11 | ✅ | B1 phase plan.md exists |
| 12 | ✅ | B1 phase build.md exists |
| 13 | ✅ | B1 phase verify.md exists |
| 14 | ✅ | B1 phase simplify.md exists |
| 15 | ✅ | B1 phase review.md exists |
| 16 | ✅ | B1 phase ship.md exists |
| 17 | ✅ | B1 agent planner.md exists |
| 18 | ✅ | B1 agent generator.md exists |
| 19 | ✅ | B1 agent evaluator.md exists |
| 20 | ✅ | B1 agent simplifier.md exists |
| 21 | ✅ | B1 init.sh is executable |
| 22 | ✅ | B1 git initial commit |
| 23 | ✅ | B1 default mode copilot |
| 24 | ✅ | B1 currentPhase null |
| 25 | ✅ | B1 gates enabled default (G12: enforcement by default) |
| 26 | ✅ | B1 maxRetries 10 (DEFAULT_MAX_RETRIES) |
| 27 | ✅ | B1 simplify excluded default |
| 28 | ✅ | B1 stack node in config |
| 29 | ✅ | B1 stack node in init JSON top-level |
| 30 | ✅ | B2 python init ok |
| 31 | ✅ | B2 stack python (top-level) |
| 32 | ✅ | B3 go init ok |
| 33 | ✅ | B3 stack go (top-level) |
| 34 | ✅ | B4 generic init ok |
| 35 | ✅ | B4 stack generic (top-level) |
| 36 | ✅ | B5 existing-clean init ok |
| 37 | ✅ | B5 scaffolded into existing repo |
| 38 | ✅ | B5 preserved existing commit |
| 39 | ✅ | B6 dirty repo init succeeds (dirty git not rejected) |
| 40 | ✅ | B6 scaffolded into dirty repo |
| 41 | ✅ | B7 re-init without --force exits 1 (harness files exist) |
| 42 | ✅ | B7 re-init rejected without --force |
| 43 | ✅ | B7 --force re-init ok |
| 44 | ✅ | B8 --no-git init ok |
| 45 | ✅ | B8 no .git dir |
| 46 | ✅ | B8 still scaffolds harness |
| 47 | ✅ | B9 agent-tool claude-code ok |
| 48 | ✅ | B9 CLAUDE.md generated |
| 49 | ✅ | B9 agentTool stored in config.json |
| 50 | ✅ | B10 comma agent-tools ok |
| 51 | ✅ | B10 CLAUDE.md generated |
| 52 | ✅ | B10 .cursorrules generated |
| 53 | ✅ | B11 agent-tool all ok |
| 54 | ✅ | B11 all → CLAUDE.md |
| 55 | ✅ | B12 invalid agent-tool exits 2 (usage) |
| 56 | ✅ | B13 --mode autopilot init ok |
| 57 | ✅ | B13 mode autopilot stored in config.json |
| 58 | ✅ | B14 invalid mode exits 2 |
| 59 | ✅ | B15 human init ok |
| 60 | ✅ | B15 human output non-empty |
| 61 | ✅ | B15 human output not JSON |
| 62 | ✅ | B16 re-init without --force rejected (harness files exist) |

### C-copilot

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | C gates enabled |
| 2 | ✅ | C anti-placeholder disabled (calc CLI uses console.log) |
| 3 | ✅ | C stackMeta.lintCmd override persisted |
| 4 | ✅ | C stackMeta.testCmd override persisted |
| 5 | ✅ | C status before define ok |
| 6 | ✅ | C currentPhase null at start |
| 7 | ✅ | C phase define ok |
| 8 | ✅ | C define.md skill accessible |
| 9 | ✅ | C AI wrote specs/prd.md |
| 10 | ✅ | C contract propose ok |
| 11 | ✅ | C contract review needs-revision ok |
| 12 | ✅ | C contract review agreed ok |
| 13 | ✅ | C define validate pass |
| 14 | ✅ | C define gate overall pass |
| 15 | ✅ | C learn lesson ok |
| 16 | ✅ | C phase next to plan ok |
| 17 | ✅ | C advanced to plan (currentPhase) |
| 18 | ✅ | C plan.md skill accessible |
| 19 | ✅ | C AI wrote feature-list.json |
| 20 | ✅ | C plan validate pass |
| 21 | ✅ | C checkpoint pre-build ok |
| 22 | ✅ | C manual/pre-build tag created |
| 23 | ✅ | C retry.tasks.enabled true |
| 24 | ✅ | C phase next to build ok |
| 25 | ✅ | C build.md skill accessible |
| 26 | ✅ | C build validate task-001 ok |
| 27 | ✅ | C build validate task-002 ok |
| 28 | ✅ | C build validate task-003 ok |
| 29 | ✅ | C build validate task-004 ok |
| 30 | ✅ | C build validate task-005 ok |
| 31 | ✅ | C build validate task-006 ok |
| 32 | ✅ | C pause ok |
| 33 | ✅ | C paused=true persisted |
| 34 | ✅ | C resume ok |
| 35 | ✅ | C build full validate ok |
| 36 | ✅ | C phase next to verify ok |
| 37 | ✅ | C verify.md skill accessible |
| 38 | ✅ | C verify validate ok |
| 39 | ✅ | C rollback list ok |
| 40 | ✅ | C rollback list has ≥1 checkpoint |
| 41 | ✅ | C simplify added to phases.enabled |
| 42 | ✅ | C phase next to simplify ok |
| 43 | ✅ | C phase simplify ok |
| 44 | ✅ | C simplify.md skill accessible |
| 45 | ✅ | C simplify validate fails with empty dir |
| 46 | ✅ | C no-empty-dirs failure reported |
| 47 | ✅ | C simplify validate pass after cleanup |
| 48 | ✅ | C phase next to review ok |
| 49 | ✅ | C review.md skill accessible |
| 50 | ✅ | C review validate ok |
| 51 | ✅ | C contract escalate ok |
| 52 | ✅ | C phase next to ship ok |
| 53 | ✅ | C ship.md skill accessible |
| 54 | ✅ | C ship validate ok |
| 55 | ✅ | C phase next at ship end ok |
| 56 | ✅ | C currentPhase=ship at end |
| 57 | ✅ | C worktree create release-prep ok |
| 58 | ✅ | C final checkpoint v1.0 ok |

### D-autopilot

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | D set-mode autopilot rejected before define (exit 1) |
| 2 | ✅ | D set-mode copilot ok |
| 3 | ✅ | D gates enabled |
| 4 | ✅ | D set-mode autopilot ok after define |
| 5 | ✅ | D phase next plan→build (autopilot) ok |
| 6 | ✅ | D pause mid-autopilot ok |
| 7 | ✅ | D autopilot blocked when paused |
| 8 | ✅ | D resume ok |
| 9 | ✅ | D reached ship phase |
| 10 | ✅ | D ship phase next complete |

### E-commands

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | E status uninitialized ok (graceful) |
| 2 | ✅ | E status uninitialized message |
| 3 | ✅ | E status fresh ok |
| 4 | ✅ | E status fresh currentPhase null |
| 5 | ✅ | E status mid-pipeline currentPhase define |
| 6 | ✅ | E status paused=true |
| 7 | ✅ | E status json has command |
| 8 | ✅ | E validate gates disabled ok |
| 9 | ✅ | E validate gates disabled message |
| 10 | ✅ | E validate enabled returns result |
| 11 | ✅ | E validate --phase override |
| 12 | ✅ | E validate --feature parsed |
| 13 | ✅ | E validate no-phase exits 1 |
| 14 | ✅ | E set-mode copilot ok |
| 15 | ✅ | E set-mode autopilot before define rejected |
| 16 | ✅ | E set-mode invalid exits 2 |
| 17 | ✅ | E config list ok |
| 18 | ✅ | E config list has params |
| 19 | ✅ | E config get mode ok |
| 20 | ✅ | E config get missing returns null |
| 21 | ✅ | E config set maxRetries ok |
| 22 | ✅ | E config set persisted |
| 23 | ✅ | E config set nested ok |
| 24 | ✅ | E config nested persisted |
| 25 | ✅ | E config retry.features.enabled ok |
| 26 | ✅ | E config retry.phases.enabled ok |
| 27 | ✅ | E pause ok |
| 28 | ✅ | E double-pause ok (idempotent) |
| 29 | ✅ | E resume ok |
| 30 | ✅ | E double-resume ok (idempotent) |
| 31 | ✅ | E learn ok |
| 32 | ✅ | E learn empty exits 2 |
| 33 | ✅ | E learn appended to progress.md |
| 34 | ✅ | E contract propose missing scope exits 2 |
| 35 | ✅ | E contract propose ok |
| 36 | ✅ | E contract review no decision exits 2 |
| 37 | ✅ | E contract status ok |
| 38 | ✅ | E contract escalate ok |
| 39 | ✅ | E worktree create ok |
| 40 | ✅ | E worktree create existing branch rejected |
| 41 | ✅ | E worktree list ok |
| 42 | ✅ | E worktree prune ok |
| 43 | ✅ | E worktree no-git rejected |
| 44 | ✅ | E rollback list ok (empty) |
| 45 | ✅ | E rollback setup checkpoint |
| 46 | ✅ | E rollback list has checkpoint |
| 47 | ✅ | E rollback to ok |
| 48 | ✅ | E rollback invalid tag rejected |
| 49 | ✅ | E checkpoint create clean ok |
| 50 | ✅ | E checkpoint duplicate label rejected |
| 51 | ✅ | E checkpoint dirty tree rejected |
| 52 | ✅ | E checkpoint --force on dirty ok |
| 53 | ✅ | E help global ok |
| 54 | ✅ | E help global output |
| 55 | ✅ | E help per-command ok |
| 56 | ✅ | E help invalid command falls back |
| 57 | ✅ | E help --json ok |

### F-loops-retries

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | F1 failing task validate fails |
| 2 | ✅ | F1 taskRetryCount incremented after 1st fail |
| 3 | ✅ | F1 taskRetryCount incremented after 2nd fail |
| 4 | ✅ | F1 fixed task validate ok |
| 5 | ✅ | F2 retryCount 0 after new phase |
| 6 | ✅ | F2 retryCount incremented on same-phase re-run |
| 7 | ✅ | F2 retryCount reset on new phase |
| 8 | ✅ | F3 contract auto-escalated after max rounds |
| 9 | ✅ | F3 contract status escalated |
| 10 | ✅ | F4 copilot phase next ok |
| 11 | ✅ | F4 copilot advanced |
| 12 | ✅ | F5 autopilot reached complete |

### G-gaps-coverage

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | G1 init status=ok |
| 2 | ✅ | G1 gates.enabled=true default (G12) |
| 3 | ✅ | G1 gates.antiPlaceholder.enabled=true default (G24b) |
| 4 | ✅ | G1 gates.cleanState.enabled=false opt-in (G17) |
| 5 | ✅ | G1 currentRole=null default (G19) |
| 6 | ✅ | G1 cleanup.schedule default (G24) |
| 7 | ✅ | G1 maxRetries=10 legacy fallback |
| 8 | ✅ | G1 retry.tasks.maxRetries=null (falls back to 10) |
| 9 | ✅ | G1 retry.features.enabled=false copilot (G10) |
| 10 | ✅ | G1 retry.phases.enabled=false copilot (G10) |
| 11 | ✅ | G1 --no-gates init status=ok |
| 12 | ✅ | G1 --no-gates sets gates.enabled=false (G12) |
| 13 | ✅ | G1 --mode autopilot init status=ok |
| 14 | ✅ | G1 --mode autopilot stored |
| 15 | ✅ | G1 autopilot retry.features.enabled=true (G10) |
| 16 | ✅ | G1 autopilot retry.phases.enabled=true (G10) |
| 17 | ✅ | G1 autopilot retry.tasks.maxRetries=3 (G10) |
| 18 | ✅ | G1 autopilot currentRole=null (roles not auto-set) |
| 19 | ✅ | G2 config set stackMeta.lintCmd exits 0 (G1 auto-create null parent) |
| 20 | ✅ | G2 stackMeta.lintCmd persisted |
| 21 | ✅ | G2 config set stackMeta.nested.deep exits 0 (G1 deep null parent) |
| 22 | ✅ | G2 stackMeta.nested.deep persisted |
| 23 | ✅ | G2 config set phases.enabled --json-value exits 0 (G2) |
| 24 | ✅ | G2 phases.enabled persisted as array |
| 25 | ✅ | G2 config set gates.cleanState.stalePatterns --json-value exits 0 |
| 26 | ✅ | G2 cleanState.stalePatterns persisted |
| 27 | ✅ | G2 config set --json-value @file exits 0 |
| 28 | ✅ | G2 --json-value @file persisted |
| 29 | ✅ | G2 config set --json-value invalid exits 2 |
| 30 | ✅ | G2 invalid JSON error message |
| 31 | ✅ | G3 role planner status=ok |
| 32 | ✅ | G3 role planner sets currentRole |
| 33 | ✅ | G3 role planner previousRole=null |
| 34 | ✅ | G3 handoff has Current Role: planner |
| 35 | ✅ | G3 progress has role handoff line |
| 36 | ✅ | G3 contract propose without --criteria exits 2 (G5) |
| 37 | ✅ | G3 contract propose with --criteria status=ok (G5) |
| 38 | ✅ | G3 contract review as planner exits 1 (G21 requires evaluator) |
| 39 | ✅ | G3 role evaluator previousRole=planner |
| 40 | ✅ | G3 contract review as evaluator status=ok (G21) |
| 41 | ✅ | G3 define validate passes (contract-criteria G8) |
| 42 | ✅ | G3 phase next define→plan ok |
| 43 | ✅ | G3 plan.md skill exists |
| 44 | ✅ | G3 plan validate ok |
| 45 | ✅ | G3 phase next plan→build ok |
| 46 | ✅ | G3 role generator sets currentRole |
| 47 | ✅ | G3 validate build as generator exits 1 (G21 requires evaluator) |
| 48 | ✅ | G3 validate build role message (G21) |
| 49 | ✅ | G3 task validate passes task-criteria (G7) |
| 50 | ✅ | G3 self-eval guard: evaluator validates own work exits 1 (G23) |
| 51 | ✅ | G3 self-eval guard message (G23) |
| 52 | ✅ | G3 validate build as evaluator passes |
| 53 | ✅ | G3 phase next build→verify ok |
| 54 | ✅ | G3 verify validate ok |
| 55 | ✅ | G3 phase next verify→simplify ok |
| 56 | ✅ | G3 role simplifier sets currentRole |
| 57 | ✅ | G3 simplify validate fails with empty dir |
| 58 | ✅ | G3 simplify failure is no-empty-dirs |
| 59 | ✅ | G3 phase next simplify→review ok |
| 60 | ✅ | G3 review validate passes rubric-content (G9) |
| 61 | ✅ | G3 phase next review→ship ok |
| 62 | ✅ | G3 ship validate ok |
| 63 | ✅ | G3 phase next ship→complete status=complete |
| 64 | ✅ | G3 final handoff has Current Phase |
| 65 | ✅ | G3 final handoff has Current Role: evaluator |
| 66 | ✅ | G3 progress.md has ≥7 role handoff lines |
| 67 | ✅ | G4 role no arg exits 2 |
| 68 | ✅ | G4 role invalid exits 2 |
| 69 | ✅ | G4 role invalid message |
| 70 | ✅ | G4 role planner currentRole |
| 71 | ✅ | G4 role planner previousRole=null |
| 72 | ✅ | G4 role planner handoffWritten=true |
| 73 | ✅ | G4 role generator previousRole=planner |
| 74 | ✅ | G4 role evaluator roleSkillPath non-null |
| 75 | ✅ | G4 currentRole persists in config |
| 76 | ✅ | G4 decision no text exits 2 |
| 77 | ✅ | G4 decision record status=ok |
| 78 | ✅ | G4 decision appended to lessons-decisions.md |
| 79 | ✅ | G4 decision has dated header |
| 80 | ✅ | G4 decision --links-lesson status=ok |
| 81 | ✅ | G4 decision links lesson |
| 82 | ✅ | G4 decision auto-links last lesson (G18) |
| 83 | ✅ | G4 status decisionsTail is array |
| 84 | ✅ | G4 status decisionsTail non-empty |
| 85 | ✅ | G4 cleanup status=ok |
| 86 | ✅ | G4 cleanup staleArtifacts is array |
| 87 | ✅ | G4 cleanup staleArtifacts non-empty |
| 88 | ✅ | G4 cleanup staleArtifact has file |
| 89 | ✅ | G4 cleanup staleArtifact has pattern |
| 90 | ✅ | G4 cleanup emptyDirs is array |
| 91 | ✅ | G4 cleanup emptyDirs non-empty |
| 92 | ✅ | G4 cleanup qualityDocFreshness present |
| 93 | ✅ | G4 cleanup driftFiles always [] |
| 94 | ✅ | G4 cleanup schedule default |
| 95 | ✅ | G4 cleanup --auto-fix autoFixed>0 |
| 96 | ✅ | G4 cleanup --auto-fix removed empty dir |
| 97 | ✅ | G4 cleanup clean project staleArtifacts empty |
| 98 | ✅ | G4 audit status=ok |
| 99 | ✅ | G4 audit activeGates is array |
| 100 | ✅ | G4 audit activeGates includes gates.enabled |
| 101 | ✅ | G4 audit activeGates includes gates.antiPlaceholder (default true) |
| 102 | ✅ | G4 audit activeRetry is array |
| 103 | ✅ | G4 audit activeRetry includes tasks |
| 104 | ✅ | G4 audit enabledPhases is array |
| 105 | ✅ | G4 audit enabledPhases=6 (no simplify) |
| 106 | ✅ | G4 audit suggestions is array |
| 107 | ✅ | G4 audit mode=copilot |
| 108 | ✅ | G4 audit currentRole=null |
| 109 | ✅ | G4 audit autopilot mode |
| 110 | ✅ | G4 audit gates-disabled suggestion |
| 111 | ✅ | G5 anti-placeholder: console.log fails validate |
| 112 | ✅ | G5 anti-placeholder failure name |
| 113 | ✅ | G5 anti-placeholder passes after fix |
| 114 | ✅ | G5 anti-placeholder: debugger fails |
| 115 | ✅ | G5 anti-placeholder: custom TODO pattern fails |
| 116 | ✅ | G5 contract-criteria: empty section fails |
| 117 | ✅ | G5 contract-criteria: placeholder-only fails |
| 118 | ✅ | G5 contract-criteria: real criterion passes |
| 119 | ✅ | G5 task-criteria: empty fails |
| 120 | ✅ | G5 task-criteria: placeholder-only fails |
| 121 | ✅ | G5 task-criteria: real criterion passes |
| 122 | ✅ | G5 rubric-content: stub fails |
| 123 | ✅ | G5 rubric-content: filled passes |
| 124 | ✅ | G5 clean-state: stale artifact fails |
| 125 | ✅ | G5 clean-state failure name |
| 126 | ✅ | G5 clean-state detail mentions stale artifacts |
| 127 | ✅ | G5 clean-state: failure exits 1 |
| 128 | ✅ | G5 clean-state: clean source passes |
| 129 | ✅ | G5 clean-state: pass exits 0 |
| 130 | ✅ | G6 handoff has Current Phase: define |
| 131 | ✅ | G6 handoff overwritten with new phase |
| 132 | ✅ | G6 progress.md appended (not truncated) |
| 133 | ✅ | G6 progress has phase transition line |
| 134 | ✅ | G6 role overwrites handoff with role |
| 135 | ✅ | G6 pause writes handoff |
| 136 | ✅ | G6 resume resets taskRetryCount (G11) |
| 137 | ✅ | G6 resume resets featureRetryCount (G11) |
| 138 | ✅ | G6 resume resets phaseRetryCount (G11) |
| 139 | ✅ | G6 resume resets retryCount (G11) |
| 140 | ✅ | G6 status has sessionState field |
| 141 | ✅ | G6 status has progressTail field |
| 142 | ✅ | G6 status has decisionsTail field |
| 143 | ✅ | G6 status has handoffTimestamp field |
| 144 | ✅ | G6 status has currentRole field |
| 145 | ✅ | G6 status has sessionState field (stub) |
| 146 | ✅ | G6 status handoffTimestamp=null for stub (no live write) |
| 147 | ✅ | G6 decision appends (first preserved) |
| 148 | ✅ | G6 decision appends (second added) |
| 149 | ✅ | G6 decisions file grew (append-only) |
| 150 | ✅ | G6 handoff has Current Phase field |
| 151 | ✅ | G6 handoff has Current Role field |
| 152 | ✅ | G6 handoff has Current Feature field |
| 153 | ✅ | G6 handoff has Gate Status field |
| 154 | ✅ | G6 handoff has Next Action field |
| 155 | ✅ | G6 handoff has Retry Count field |
| 156 | ✅ | G6 handoff has Last Commit field |
| 157 | ✅ | G7 autopilot retry.features.enabled=true (G10) |
| 158 | ✅ | G7 autopilot retry.phases.enabled=true (G10) |
| 159 | ✅ | G7 autopilot retry.tasks.maxRetries=3 (G10) |
| 160 | ✅ | G7 copilot retry.features.enabled=false (G10) |
| 161 | ✅ | G7 copilot retry.tasks.maxRetries=null (→10) (G10) |
| 162 | ✅ | G7 audit autopilot no high-max suggestion (3 is lowered) |
| 163 | ✅ | G7 audit copilot high-max suggestion fires |
| 164 | ✅ | G7 resume resets taskRetryCount (G11) |
| 165 | ✅ | G7 resume resets featureRetryCount (G11) |
| 166 | ✅ | G7 resume resets phaseRetryCount (G11) |
| 167 | ✅ | G7 resume resets retryCount (G11) |
| 168 | ✅ | G7 validate works without role set (G21 pass-through) |

### H-newly-fixed-gaps

| # | Result | Case |
|---|--------|------|
| 1 | ✅ | H1 feature-criteria fires when definitionOfDone empty |
| 2 | ✅ | H1 feature-criteria detail mentions definitionOfDone |
| 3 | ✅ | H1 feature-criteria blocks placeholder-only definitionOfDone |
| 4 | ✅ | H1 feature-criteria passes with real definitionOfDone |
| 5 | ✅ | H1 feature marked passes=true when definitionOfDone filled |
| 6 | ✅ | H2 currentFeature is set in config |
| 7 | ✅ | H2 currentTask is set in config |
| 8 | ✅ | H2 currentFeature = feature-001 |
| 9 | ✅ | H2 currentTask = task-001 |
| 10 | ✅ | H2 status has sessionState |
| 11 | ✅ | H2 status has currentRole field |
| 12 | ✅ | H3 generator validate in BUILD blocked by role gate |
| 13 | ✅ | H3 generator blocked message mentions evaluator |
| 14 | ✅ | H3 self-eval guard: evaluator with producedByRole=evaluator blocked |
| 15 | ✅ | H3 self-eval guard message |
| 16 | ✅ | H3 self-eval message says "generator cannot evaluate" |
| 17 | ✅ | H3 evaluator validates generator work (different roles) — no self-eval block |
| 18 | ✅ | H3 null role → self-eval guard does not fire |
| 19 | ✅ | H4 role planner has persona field |
| 20 | ✅ | H4 planner persona |
| 21 | ✅ | H4 generator persona |
| 22 | ✅ | H4 evaluator persona |
| 23 | ✅ | H4 simplifier persona |
| 24 | ✅ | H4 custom persona via config overrides default |
| 25 | ✅ | H4 human output non-empty |
| 26 | ✅ | H5 DEFINE task-level validate as evaluator exits 1 (requires planner) |
| 27 | ✅ | H5 message says requires planner |
| 28 | ✅ | H5 DEFINE task-level validate as generator exits 1 (requires planner) |
| 29 | ✅ | H5 DEFINE task-level validate as planner allowed |
| 30 | ✅ | H5 null role → no role gate enforcement |
| 31 | ✅ | H6 claude-code generates CLAUDE.md |
| 32 | ✅ | H6 cursor generates .cursorrules |
| 33 | ✅ | H6 skill sets agentTool=skill in config |
| 34 | ✅ | H6 all generates CLAUDE.md |
| 35 | ✅ | H6 all generates .cursorrules |
| 36 | ✅ | H6 tool-registry has skill label = "Skill Manifest" |
| 37 | ✅ | H6 tool-registry notes say "not a tool name" |
| 38 | ✅ | H6 claude-code file = CLAUDE.md |
| 39 | ✅ | H6 cursor file = .cursorrules |
| 40 | ✅ | H7 task-criteria: empty acceptanceCriteria fails |
| 41 | ✅ | H7 task-criteria: placeholder-only fails |
| 42 | ✅ | H7 task-criteria: real criteria passes |
| 43 | ✅ | H7 feature-criteria: empty definitionOfDone blocks |
| 44 | ✅ | H7 feature-criteria: real definitionOfDone passes |
| 45 | ✅ | H7 contract-criteria: empty section fails |
| 46 | ✅ | H7 contract-criteria: real criteria passes |
| 47 | ✅ | H8 copilot mode in phase next JSON |
| 48 | ✅ | H8 copilot phase next returns status=instruction |
| 49 | ✅ | H8 copilot retry.features.enabled=false |
| 50 | ✅ | H8 copilot retry.phases.enabled=false |
| 51 | ✅ | H8 autopilot mode stored in config |
| 52 | ✅ | H8 autopilot retry.features.enabled=true |
| 53 | ✅ | H8 autopilot retry.phases.enabled=true |
| 54 | ✅ | H8 autopilot retry.tasks.maxRetries=3 |
| 55 | ✅ | H9 null role: validate works (pass-through) |
| 56 | ✅ | H9 null role: contract propose works |
| 57 | ✅ | H9 null role: contract review works |
| 58 | ✅ | H9 missing feature-list: validate fails gracefully |
| 59 | ✅ | H10 planner in DEFINE task: not blocked by role gate |
| 60 | ✅ | H10 planner in build: blocked (requires evaluator) |
| 61 | ✅ | H10 planner in verify: blocked (requires evaluator) |
| 62 | ✅ | H10 generator in DEFINE task: blocked (requires planner) |
| 63 | ✅ | H10 generator in build: blocked (requires evaluator) |
| 64 | ✅ | H10 generator in verify: blocked (requires evaluator) |
| 65 | ✅ | H10 evaluator in DEFINE task: blocked (requires planner) |
| 66 | ✅ | H10 evaluator in build: not blocked by role gate |
| 67 | ✅ | H10 evaluator in verify: not blocked by role gate |
| 68 | ✅ | H10 simplifier in DEFINE task: blocked (requires planner) |
| 69 | ✅ | H10 simplifier in build: blocked (requires evaluator) |
| 70 | ✅ | H10 simplifier in verify: blocked (requires evaluator) |


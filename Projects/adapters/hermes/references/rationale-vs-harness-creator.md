# Rationale: Custom CLI vs walkinglabs/harness-creator

## What harness-creator Does

walkinglabs/harness-creator scaffolds **5 files** with project-intelligent auto-detection:
- AGENTS.md or CLAUDE.md
- feature_list.json
- progress.md
- session-handoff.md
- init.sh

It validates via a weighted scoring system (0-100, threshold 70) across 5 subsystems:
instructions(20%), state(30%), verification(20%), scope(15%), lifecycle(15%).

## What Our Architecture Adds

| Aspect | harness-creator | Our Architecture |
|--------|---------------|------------------|
| Files | 5 | 16 |
| Workflow | None defined | 6-phase DEFINE→PLAN→BUILD→VERIFY→REVIEW→SHIP |
| Gates | Score-based (partial credit) | Deterministic pass/fail per phase |
| Agent architecture | None | Planner/Generator/Evaluator across all phases |
| Iteration | None | Dual Ralph loop (inner per-phase, outer pipeline-wide) |
| Sprint Contract | None | Pre-build verification agreement |
| Evaluation | Weighted scoring | Evaluator-rubric with 0-2 per dimension |
| Modes | None | Copilot (human-initiated) / Autopilot (autonomous) |
| CLI | `node create-harness.mjs` | `harness-dev init / phase / status / validate / set-mode` |
| Config | None | harness-config.json with mode, phase state, preferences |
| Learnings | None persisted | Lessons Learned section in progress.md |

## Decision

Use walkinglabs/harness-creator as a **temporary scaffold** during Phase 0 development, then replace entirely with `harness-dev init` once the meta-harness is built. The harness-creator validation scoring algorithm (weighted 0-100) is a useful reference for designing our own gate system, but our deterministic pass/fail gates with escalation are more appropriate for production use.

## Source Conversation

Session: June 16, 2026 — Full architecture design discussion. Decision made after comparing against 15 existing harness repos including harness-creator, deepagents, Trellis, Hive, ECC, agentmemory, agentflow, and others.

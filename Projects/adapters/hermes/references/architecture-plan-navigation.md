# Architecture Plan Navigation

The full architecture plan: `~/ops/Projects/dev-harness/docs/analysis/harness-architecture-plan.md`

## Key Sections (905 lines, 53 sections)

| Section | Lines | What It Covers |
|---------|-------|----------------|
| §1 Core Premise | 16-36 | Model vs Harness, unified insight across all sources |
| §2 7-Layer Stack | 38-85 | Progression from HUMAN OVERSIGHT (top) to MODEL (bottom) |
| §3 6-Phase Pipeline | 88-113 | DEFINE→PLAN→BUILD→VERIFY→REVIEW→SHIP with slash commands, skills, artifacts, gates |
| §4 Walking Labs 5 Files | 130-176 | Minimal harness + extended file table (16 files) |
| §5 Ralph Loop | 159-247 | Monolithic while-loop, fresh context, progress.txt, AGENTS.md update |
| §6 Anthropic 3-Agent | 251-284 | Planner/Generator/Evaluator across ALL phases, sprint contract, experiment results |
| §7 OpenAI Knowledge | 287-370 | Progressive disclosure, agent legibility, architectural enforcement |
| §8 Backpressure | 372-397 | Slow compilation, static analysis, tests as backpressure |
| §9 Skill Architecture | 398-441 | Process-first, anti-rationalization tables | 
| §10 Complete Harness | 447-655 | Unified loop (dual Ralph), progress.md dual structure, copilot/autopilot modes, CLI commands, 16-file manifest, 8 deterministic gates, sprint contract, anti-rationalization, evaluation rubric |
| §11 Evaluation | 673-697 | 6-dimension rubric, scoring thresholds |
| §12 Implementation Plan | 699-870 | Phase 0 (meta-harness) through Phase 6 (browser verification) |
| §13 Key Principles | 872-903 | 12 principles from all sources |
| §14 Anti-Patterns | 905-930 | 15 anti-patterns with sources |
| Sources | 930-950 | All referenced papers, repos, and blogs |

## Quick Reference: Common Tasks

**Understanding the full architecture:** Start with §10 (Complete Harness) then §3 (Pipeline) then §6 (3-Agent).

**Building the CLI:** Start with §12 Phase 0 (Meta-Harness) then Phase 2 (Dual Ralph Loop).

**Understanding why not committee:** §6 (3-Agent is simpler and more effective than 4-agent committee). Also references/comparison-with-existing-repos.md.

**Adding a new file to the manifest:** See §10 Core Files table. Add to the table and update Phase 1 scaffold list.

**Setting up a new project:** Run `harness-dev init --stack <type>` (see §10 CLI table). The scaffold creates all 16 files.

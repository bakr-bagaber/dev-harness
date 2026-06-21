# Dev Harness Project Files

This skill is implemented at `~/ops/Projects/dev-harness/`. The project files contain full implementation detail, task breakdown, and architecture reference.

## Key Documents

| File | Purpose |
|------|---------|
| `PROJECT_PLAN.md` | 20 tasks with dependency graph, build order, verification criteria per task |
| `docs/analysis/harness-architecture-plan.md` | Full architecture — 7-phase pipeline, 3-agent architecture, dual Ralph loop, copilot/autopilot, git integration, 17 stacks |
| `README.md` | Quick overview and pointers |

## CLI Source

| Path | Purpose |
|------|---------|
| `cli/harness-dev.mjs` | Entry point |
| `cli/lib/` | Core libraries (args, errors, help, detect-stack, schemas) |
| `cli/commands/` | One file per CLI command |

## Task Status (as of June 2026)

- **T1 (CLI skeleton):** Complete — 12 files, 566 lines, all 12 verification tests passing
- **T2 (Stack detection):** Complete — 9 stacks, priority-ordered, all 14 verification tests passing
- **T3–T20:** Not yet implemented

## Architecture Quick Reference

- **7 phases:** DEFINE → PLAN → BUILD → VERIFY → SIMPLIFY → REVIEW → SHIP
- **3 agents:** Planner designs, Generator builds, Evaluator verifies
- **Dual loops:** Inner (per-phase, iterate until gate passes) + Outer (pipeline-wide, iterate until features complete)
- **2 modes:** Copilot (human triggers) + Autopilot (fully autonomous after DEFINE)
- **9 stacks:** Python, Node, Go, Rust, C, C++, VHDL, Verilog, Generic

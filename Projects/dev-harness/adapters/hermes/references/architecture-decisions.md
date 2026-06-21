# Architecture Decisions — Dev Harness

Decisions from the June 2026 design session that shaped the current architecture.

## Inner Loop: Two Modes (not single-shot)

**Context:** Initial design described DEFINE/PLAN/REVIEW/SHIP as "single-shot" phases. The user corrected: every phase iterates.

**Decision:** All phases run the inner loop. The loop type depends on phase:
- **Feature-iterate** (BUILD, VERIFY, SIMPLIFY): iterate across features/tasks
- **Deliverable-retry** (INIT, DEFINE, PLAN, REVIEW, SHIP): retry same deliverable

**Source:** User correction — "I dont agree on this: Single-shot mode (DEFINE, PLAN, REVIEW, SHIP, INIT)..."

## Two Gate Types

**Context:** User said "gates concept is not clear to me."

**Decision:**
- **Contract Gate** (Anthropic-style): agent-to-agent negotiation before BUILD. Always active. Subjective quality check.
- **Phase Gate** (our innovation): deterministic CLI commands at each phase boundary. Disabled by default. Objective correctness check.

**Source:** Anthropic harness design (subjective evaluator) + walkinglabs deterministic checks (objective).

## Opt-In Architecture

**Context:** User explicitly demanded all optional features default to false.

**Decision:** Gates, git operations (resetOnRetry, autoCommit, autoTag), and SIMPLIFY phase all disabled by default. Users opt in via config when they need each feature.

**Rationale:** Cost-conscious: no idle compute, no noise, no permanent artifacts unless explicitly requested. Extension of user's wider infra philosophy.

## Configurable maxRetries

**Context:** User said "smart model may require three iterations before escalation, dump model may require 10."

**Decision:** `maxRetries` is a config knob in harness-config.json (default 3). Set per-model: `harness-dev config set maxRetries 10` for cheap models.

## AGENTS.md as TOC

**Context:** OpenAI recommends AGENTS.md be ~100 lines as a table of contents.

**Decision:** AGENTS.md is TOC-style — project info, phase pipeline, agent roles table, key files, rules. Deep detail lives in `docs/agents/<role>.md`. Each role guide is < 50 lines.

## Single-Phase-Only Outer Loop

**Context:** User asked if inner/outer loops could merge. We kept them separate.

**Decision:** The outer loop ONLY advances phases. It does NOT iterate features. The inner loop handles all task/feature/deliverable iteration. This maps cleanly to the two user workflows:
- Copilot: outer loop = one phase then exit
- Autopilot: outer loop = auto-advance through pipeline

## CLI Help As Primary Interface

**Decision:** The help menu IS the primary UI. Organized into groups: Pipeline, State, Agent workflow, Git workflow, Mode. Every command supports both `--json` (agent) and formatted text (human).

# Harness Architecture Plan

This reference points to the comprehensive harness architecture and implementation
plan produced from a 15-source research session. The plan lives at:

**`~/ops/Projects/dev-harness/docs/analysis/harness-architecture-plan.md`**

## What It Contains

The plan synthesizes walkinglabs, addyosmani/agent-skills, Ralph (Huntley),
OpenAI Harness Engineering, Anthropic Effective Harnesses / Harness Design,
morphllm IMPACT Framework, and 9+ additional sources into a unified architecture.

Key content:
- §1-2: Core premise (model vs. harness), unified insights across all sources
- §3: 6-phase pipeline with ASCII diagram, slash commands, sub-steps, gates
- §4: Walking Labs 5-subsystem — 5 minimal files + 10 extended harness files
- §5: Ralph Loop — iterative while-loop with fresh contexts, progress.txt
- §6: Anthropic Generator/Evaluator split + Sprint Contract + feature lists
- §7: OpenAI Knowledge Architecture — progressive disclosure, docs/ layout
- §8: Morphllm IMPACT Framework mapping
- §9: Additional sources (Inngest, AutoJunjie, Agent Stack 2026)
- §10: Putting It All Together — layered stack, unified loop, gate table
- §11: Evaluation & Quality Rubric (walkinglabs evaluator-rubric)
- §12: 6-Phase Implementation Plan (Phase 0 → Phase 5)

Status: Research / Architecture Design phase. Awaiting implementation.

## Source Discipline (Lesson from Session)

This plan was built exclusively from the external research sources provided
by the user. It explicitly **excludes** any pre-existing internal infrastructure
(Hermes skills, PM methodology, OpenProject integration, existing dev-harness).
This discipline means the plan is a clean synthesis of published work — but it
also means it may need adaptation before integrating with the existing dev-harness
orchestrator code in this skill.

See `references/session-lessons.md` for the full lesson log.

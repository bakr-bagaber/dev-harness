# Dev Harness — Specification

## Purpose

Design a robust software development harness based on agentic loops that makes AI coding agents reliable at scale. The harness is the complete environment the agent operates inside — instructions, state, scope, verification, and lifecycle.

## Source Constraints

The plan must be grounded exclusively in:

1. walkinglabs/learn-harness-engineering (course + harness-creator skill)
2. walkinglabs/awesome-harness-engineering (curated resource list)
3. ghuntley.com/ralph (Ralph pattern article)
4. snarktank/ralph (Ralph implementation)
5. addyosmani/agent-skills (24 skills + 6-phase pipeline)
6. OpenAI "Harness Engineering" (Feb 2026)
7. Anthropic "Effective Harnesses" (Nov 2025) + "Harness Design" (Mar 2026)
8. morphllm "IMPACT Framework" (Mar 2026)
9. Additional reputable sources (Inngest, AutoJunjie, harness-engineering.ai, Agent Stack 2026)

**Excludes:** Any pre-existing internal infrastructure (Hermes skills, PM methodology, OpenProject integration, existing dev-harness).

## Deliverables

- Architecture document covering all 7 harness layers
- 6-phase pipeline definition with phase skills, artifacts, and gates
- Ralph loop integration for iterative BUILD
- Sprint contract mechanism for pre-build verification agreement
- Multi-agent committee system for review phase
- Implementation plan with 6 phases
- Key principles, anti-patterns, and metrics

## Success Criteria

- Every pattern attributed to its source
- No internal infrastructure mixed in
- Implementation plan structured for independent execution
- Architecture covers all 7 layers: execution env, verification, state, scope, multi-agent eval, knowledge, human oversight

---
tags: [project, harness-engineering, dev-harness, agentic-loop, architecture]
aliases: [harness, dev-harness]
date: 2026-06-16
modified: 2026-06-23
---

# dev-harness

**Template:** A — Software Engineering (SWE)
**Status:** Shipped — v2.2.0 (published to npm as `dev-harness-cli`)
**Owner:** Bakr

## Overview

Design and implementation plan for a robust software development harness based on agentic loops. Synthesizes patterns from 15+ sources across the harness engineering discipline:

- walkinglabs/learn-harness-engineering — 5-subsystem model, templates, validation
- ghuntley.com/ralph + snarktank/ralph — iterative while-loop, fresh context, progress.txt
- addyosmani/agent-skills — 6-phase pipeline, 24 skills, anti-rationalization tables, committee
- OpenAI Harness Engineering — progressive disclosure, agent legibility, worktree isolation, CDP
- Anthropic Effective Harnesses + Harness Design — initializer agent, generator/evaluator split, sprint contracts, feature lists
- morphllm IMPACT Framework — Intent, Memory, Planning, Authority, Control Flow, Tools
- Additional reputable sources (Inngest, harness-engineering.ai, AutoJunjie, Agent Stack 2026)

## Objective

Produce a comprehensive architecture and phased implementation plan for a harness that makes AI coding agents reliable at scale. The plan must be grounded entirely in published research — not pre-existing internal infrastructure.

## Key Principles

- Harness over model: environment governs reliability more than model choice
- Progressive disclosure: AGENTS.md as map (~100 lines), docs/ as detail
- Generator/evaluator split: no agent evaluates its own work
- One task per iteration: fresh context per Ralph loop cycle
- Learnings persisted: progress.txt + AGENTS.md updated every iteration
- Anti-placeholder enforcement: full implementations required
- Sprint contract: verification criteria agreed before coding
- Multi-agent committee: specialized personas review in parallel

## Related Docs

- [[docs/analysis/harness-architecture-plan|Architecture & Implementation Plan]]
- [README](README.md) — full feature list, CLI reference, architecture diagrams
- [history/changelog](history/changelog.md) — release history (v2.0.0 → v2.1.0 → v2.2.0)
- [history/decisions](history/decisions.md) — ADRs (dependency adoption, result-object boundary)
- [[../../Infra/.hermes/skills/software-development/agent-skills-workflow|Agent Skills Workflow]]

## References

- walkinglabs/learn-harness-engineering: https://github.com/walkinglabs/learn-harness-engineering
- addyosmani/agent-skills: https://github.com/addyosmani/agent-skills
- snarktank/ralph: https://github.com/snarktank/ralph
- ghuntley.com/ralph: https://ghuntley.com/ralph/
- OpenAI Harness Engineering: https://openai.com/index/harness-engineering/
- Anthropic Effective Harnesses: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Anthropic Harness Design: https://www.anthropic.com/engineering/harness-design-long-running-apps

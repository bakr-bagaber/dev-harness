# Comparison: Dev-Harness vs Existing Harness Repos

Researched June 2026. 15 repos across 5 categories.

## Taxonomy of Existing Repos

### 1. File-Structure Harnesses
- **hoangnb24/repository-harness** — 8 files (CONSTRAINTS.md, ARCHITECTURE.md, DECISIONS.md, feature_list.json). Closest to our file manifest. NO workflow, NO gates, NO skills. Just the files.
- **revfactory/harness** (7k★) — Generates domain-specific agent teams from natural language goals.

### 2. Agent-Building SDKs
- **langchain-ai/deepagents** (24.7k★) — Python library with sub-agents, filesystem, context management, persistent memory. Zero file-level harness definitions. Orthogonal to our approach.
- **strands-agents/harness-sdk** (6.2k★) — Python/TypeScript SDK with guardrails, hooks, observability. No workflow or file definitions.
- **berabuddies/agentflow** (1.3k★) — Graph DSL for orchestrating agents in parallel/sequential DAGs.

### 3. Memory-Only
- **rohitg00/agentmemory** (23.1k★) — 95.2% retrieval accuracy, 53 MCP tools, SQLite + custom engine. Covers ONE subsystem (state). No workflow, gates, or files.

### 4. Multi-Agent Orchestration
- **aden-hive/hive** (10.5k★) — Auto-generates agent graph from natural language. Session isolation, crash recovery, cost enforcement. Production runtime. No file definitions or phased workflow.
- **mindfold-ai/Trellis** (10.5k★) — 4-phase workflow (Plan→Implement→Verify→Finish), `trellis mem` for session recall, multi-agent channels. No gates, no skills, no committee.

### 5. Plugin Marketplaces
- **wshobson/agents** (36.7k★) — 192 agents, 84 plugins, 156 skills. Multi-harness plugin marketplace. Not a harness itself.
- **affaan-m/ECC** (217k★) — Complete "harness OS" with 271 skills, 67 agents, hooks/triggers, instinct system. Features ours should borrow (hooks, instinct learning).

### 6. Other
- **zhayujie/CowAgent** (45.4k★) — Full assistant with planning, memory, self-evolution. Not a harness per se.
- **alibaba/open-code-review** (3.3k★) — Code review tool only. Narrow scope.
- **ai-boost/awesome-harness-engineering** — Curated list, not an implementation.

## What Our Plan Has That No Other Repo Has

| Feature | Our Plan | Best Alternative | Gap in Alternative |
|---------|----------|------------------|-------------------|
| 6-phase pipeline with gates | ✅ Full | Trellis has 4 phases, no gates | No quality boundaries between phases |
| Dual Ralph loop | ✅ Inner+outer | None implement this | Single-loop at best |
| 3-agent architecture all phases | ✅ Full | Anthropic describes but no repo implements | Everyone lets same agent judge own work |
| Sprint Contract | ✅ Full | None have this | No pre-build verification agreement |
| 16 canonical files | ✅ Mapped | repository-harness ~8 files | Missing contract, evaluation, config layers |
| Evaluation rubric | ✅ 0-2 per dimension | None define structured evaluation | Most check "does it compile" only |
| Copilot/Autopilot modes | ✅ Both | None have this | No human-in-loop toggle |
| Progressive disclosure | ✅ ~100 line map + docs/ | revfactory generates monolithic configs | Context scarcity from large files |

## What Other Repos Have That We Should Borrow

| Pattern | Source | Why |
|---------|--------|-----|
| Crash recovery + session isolation | Hive | Our state persistence must survive agent crashes mid-write |
| Hooks as neural signals | ECC | Triggers between phases that auto-fire without agent prompting |
| Byte-prefix fast-reject for recall | Trellis | Performance engineering for session state retrieval |
| SQLite-backed memory 95%+ retrieval | agentmemory | Specify memory backend instead of leaving abstract |
| Guardrails + steering handlers | harness-sdk | Gates should include auto-correction, not just pass/fail |
| Goal-to-config generation | revfactory | Phase 0 init should auto-generate harness from project goal |
| Graph DSL for parallel fanout | agentflow | PLAN phase should generate explicit DAG, not flat task list |
| Weighted scoring algorithm | walkinglabs | Useful for evaluate phase — partial credit before binary gates |

## Verdict

Our architecture is the most comprehensive file+workflow+gates+modes design of any repo surveyed. No existing repo defines all of: canonical files, phased pipeline, gates, 3-agent architecture, sprint contract, dual iteration loops, evaluation rubric, and copilot/autopilot modes. The gap is implementation — every other repo has working CLIs, libraries, and runtimes while ours is currently a specification.

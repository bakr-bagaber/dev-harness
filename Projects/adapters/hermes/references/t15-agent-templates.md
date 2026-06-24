# T15 — 3-Agent Templates

## Design

AGENTS.md is a Table of Contents — no inline procedure. Each agent role gets its own file in `docs/agents/`. This follows OpenAI's progressive disclosure principle: the agent reads AGENTS.md to understand the project structure, then deep-dives into role-specific instructions.

## Files

```
templates/
├── AGENTS.md                    (TOC, ~58 lines, under 120)
└── docs/agents/
    ├── planner.md               (Tone: Analytical and precise)
    ├── generator.md             (Tone: Focused and practical)
    ├── evaluator.md             (Tone: Skeptical and thorough)
    └── simplifier.md            (Tone: Relentless about clarity)
```

## Template Engine Changes (T15)

1. **`discoverTemplates()`** — changed from flat `readdirSync` at top level to recursive directory walk. Now picks up files in `templates/docs/agents/` and any future subdirectories.

2. **Output path preservation** — `generateTemplates()` now computes relative path from `templates/` dir to each template file, preserving subdirectory structure. So `templates/docs/agents/planner.md` outputs to `target/docs/agents/planner.md`.

3. **Subdirectory auto-creation** — `mkdirSync(outDir, { recursive: true })` is called before writing each template to ensure intermediate directories exist.

## Variables

| Variable | Source | Example (Python) |
|----------|--------|-----------------|
| `{{stack}}` | stack name | `python` |
| `{{stackLabel}}` | `stacks.json[stack].label` | `Python` |
| `{{testCmd}}` | `stacks.json[stack].testCmd` | `python3 -m pytest` |
| `{{lintCmd}}` | `stacks.json[stack].lintCmd` | `python3 -m ruff check` |
| `{{typeCheckCmd}}` | `stacks.json[stack].typeCheckCmd` | `python3 -m mypy` |
| `{{buildCmd}}` | `stacks.json[stack].buildCmd` | `python3 -m build` |
| `{{installCmd}}` | `stacks.json[stack].installCmd` | `python3 -m pip install -e .` |
| `{{harnessVersion}}` | `package.json` version | `0.2.0` |

Role guide templates (`docs/agents/*.md`) are static — no variable substitution needed.

## Verification Methodology (established during audit)

### A. Template File Existence
Verify all 5 template files exist in `templates/` and exactly 4 agent doc files exist in `templates/docs/agents/`.

### B. AGENTS.md Content Audit
Verify each required section:
- **Quick Start** — 3 commands (status, phase, validate)
- **Project** — stack, mode, phase metadata
- **Phase Pipeline** — INIT→DEFINE→PLAN→BUILD→VERIFY→[SIMPLIFY]→REVIEW→SHIP
- **Agent Roles** — table with all 4 roles, file paths, tone statements
- **Key Files** — harness-config.json, feature_list.json, progress.md, sprint-contract.md, init.sh
- **Rules (non-negotiable)** — 5 rules with no-self-evaluation as rule 1
- **Development Commands** — table with 5 {{VAR}} placeholders

Line count target: under 120 lines (current: 58).

### C. Role Guide Content Audit
Each role guide must have:
- **Tone statement** as first sentence after heading
- **Process bullets** (dash-prefixed action items)
- **Phase-specific directives** for applicable phases
- **Cross-references** to other harness files (sprint-contract.md, feature_list.json, etc.)

Content requirements per role:
| Role | Must reference |
|------|---------------|
| planner.md | sprint-contract.md, acceptance criteria, feature_list.json |
| generator.md | build-what's-specified, Simplifier persona, harness-dev validate |
| evaluator.md | requires proof, handles ambiguity, max retries escalation |
| simplifier.md | dead code removal, 4-level nesting limit, preserve test behavior |

### D. Template Engine Integration
- `discoverTemplates()` must walk subdirectories recursively
- Must return exactly 9 files (5 root + 4 under docs/agents/)
- Must preserve subdirectory structure in output paths
- Must auto-create intermediate directories

### E. Multi-Stack Variable Substitution
Template variables must be verified against ALL 9 stacks (python, node, go, rust, c, cpp, vhdl, verilog, generic). Critical checks:
- **stackLabel** resolves to correct display name per stack
- **stack name** is the internal identifier
- **Commands** (testCmd, lintCmd, installCmd, etc.) resolve to stack-appropriate values
- **Empty commands** render as empty string (not "undefined" or "null")
- **No dangling `{{VAR}}`** markers remain in rendered output

### F. Init Command Integration
`harness-dev init` must produce all 5 T15 files as part of the 21-file scaffold. Verify:
- Created files list includes exact paths for AGENTS.md and all 4 role guides
- AGENTS.md has stack-specific variable substitution (not raw `{{VAR}}`)
- Role guides are verbatim copies (no substitution needed)
- Line count under 120

### G. Edge Cases
- `--target` without value: must not crash with TypeError (exit 3). Falls back to cwd. Verified via `typeof rawTarget === 'string'` guard.
- Unknown `--stack`: graceful usage error (exit 2), lists valid stacks.
- Duplicate init (no `--force`): detects conflicts, returns exit 1 with specific file paths.
- `--force` overwrite: succeeds despite existing files.
- JSON output contract: all init calls must produce `{command, status, message, stack, target, filesCreated}`.

## Test File

`test-t15.mjs` — 205 assertions across 8 groups:
- A: Template file existence (6)
- B: AGENTS.md spec compliance (27)
- C: Role guide spec compliance (15)
- D: Template engine discovery (6)
- E: Variable substitution across all 9 stacks (54)
- F: Init command integration (22)
- G: Edge cases (22)
- H: Status after init (4)

Run with: `node test-t15.mjs [--verbose] [--init-only]`

## Related Files

- `cli/lib/templates.mjs` — template engine with `discoverTemplates()`, `generateTemplates()`, `substitute()`
- `cli/lib/vars.mjs` — `getStackVars()`, `listStacks()`
- `cli/commands/init.mjs` — init command that calls `generateTemplates()`

/**
 * scaffold — Stack-specific scaffolding assets.
 *
 * Extracted from init.mjs: config file stubs, version file stubs,
 * gitignore patterns, and extra-file generators. Pure data + helpers,
 * no I/O. init.mjs imports these to assemble the scaffold.
 *
 * Usage:
 *   import { getExtraFiles, getConfigFileContent, getGitignoreContent } from "../lib/scaffold.mjs";
 */

// ── Stack-specific extra assets ──────────────────────────────────────────────

// Agent-tool file generation is now handled by cli/lib/tool-registry.mjs.
// Tool-specific files (CLAUDE.md, .cursorrules, etc.) are generated from
// the already-rendered AGENTS.md content + an optional header — no separate
// templates needed. See tool-registry.mjs for the full tool map.
//
// Re-exported for backward compatibility (init.mjs imports from scaffold.mjs):
export { KNOWN_TOOLS as KNOWN_AGENT_TOOLS, getToolFile as getAdapterFile } from './tool-registry.mjs';

/** Config file stub content per stack (minimal starter). */
export const STACK_CONFIG_STUBS = {
  python: `[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "my-project"
version = "0.1.0"
description = ""
requires-python = ">=3.11"
`,
  node: `{
  "name": "my-project",
  "version": "0.1.0",
  "description": "",
  "type": "module",
  "scripts": {
    "build": "echo build",
    "test": "echo test"
  },
  "license": "MIT"
}
`,
  go: `module my-project

go 1.22
`,
  rust: `[package]
name = "my-project"
version = "0.1.0"
edition = "2021"
`,
  c: `cmake_minimum_required(VERSION 3.16)
project(my-project C)
add_executable(my-project main.c)
`,
  cpp: `cmake_minimum_required(VERSION 3.16)
project(my-project CXX)
add_executable(my-project main.cpp)
`,
  java: `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.mycompany</groupId>
  <artifactId>my-project</artifactId>
  <version>0.1.0</version>
  <properties>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
  </properties>
</project>
`,
  kotlin: `plugins {
    kotlin("jvm") version "2.0.0"
    application
}
application {
    mainClass = "MainKt"
}
repositories { mavenCentral() }
dependencies { implementation(kotlin("stdlib")) }
`,
  dotnet: null,
  matlab: null,
  vhdl: `-- VHDL project stub`,
  verilog: `// Verilog project stub`,
  generic: `# Generic project — no config file template`,
};

/** Version file content per stack. */
export const STACK_VERSION_STUBS = {
  python: '3.11\n',
  node: '18\n',
  go: '1.22\n',
  rust: 'stable\n',
  java: '21\n',
  kotlin: '21\n',
  dotnet: '8.0\n',
  matlab: '',
  c: '',
  cpp: '',
  vhdl: '',
  verilog: '',
  generic: '',
};

/** .gitignore patterns per stack. */
export const GITIGNORE_PATTERNS = {
  python: `# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/
*.egg
.pytest_cache/
.mypy_cache/
.ruff_cache/
.tox/
`,
  node: `# Node
node_modules/
dist/
build/
.next/
*.log
.env
.env.local
`,
  go: `# Go
*.exe
*.test
*.out
vendor/
`,
  rust: `# Rust
target/
Cargo.lock
**/*.rs.bk
`,
  java: `# Java
*.class
*.jar
*.war
target/
build/
.gradle/
*/build/
!gradle/wrapper/gradle-wrapper.jar
`,
  kotlin: `# Kotlin
*.class
*.jar
build/
.gradle/
*/build/
!gradle/wrapper/gradle-wrapper.jar
`,
  dotnet: `# .NET
bin/
obj/
*.user
*.suo
*.cache
*.log
*.nupkg
`,
  matlab: `# MATLAB
*.asv
*.m~
*.mat
slprj/
simulink/
`,
  c: `# C
build/
*.o
*.obj
*.exe
`,
  cpp: `# C++
build/
*.o
*.obj
*.exe
`,
  vhdl: `# VHDL
*.o
*.cf
work/
`,
  verilog: `# Verilog
*.o
*.vcd
*.lxt
work/
`,
  generic: `# Generic
*.log
*.bak
*.swp
.DS_Store
`,
};

// ── Extra scaffolding files (not covered by templates) ───────────────────────

/**
 * Inline content for files beyond the template-based ones.
 * Key is relative output path (under harness/), value is file content.
 * All harness-managed files go under harness/ with subfolder grouping.
 */
export function getExtraFiles(stack) {
  return {
    'harness/features/feature-list.json': JSON.stringify({
      version: '0.1',
      features: [
        {
          id: 'feature-001',
          name: 'Feature 1',
          description: 'Replace with actual feature description',
          passes: false,
          tasks: [
            { id: 'task-001', description: 'First task', status: 'pending' },
          ],
        },
      ],
    }, null, 2) + '\n',

    'harness/features/feature-list.schema.json': JSON.stringify({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Feature List',
      type: 'object',
      required: ['version', 'features'],
      properties: {
        version: { type: 'string' },
        features: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'name', 'passes', 'tasks'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              passes: { type: 'boolean' },
              definitionOfDone: { type: 'array', items: { type: 'string' }, default: [] },
              producedByRole: { type: ['string', 'null'], enum: [null, 'planner', 'generator', 'evaluator', 'simplifier'], default: null },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'description', 'status'],
                  properties: {
                    id: { type: 'string' },
                    description: { type: 'string' },
                    status: { type: 'string', enum: ['pending', 'in_progress', 'complete', 'blocked'] },
                    acceptanceCriteria: { type: 'array', items: { type: 'string' }, default: [] },
                    producedByRole: { type: ['string', 'null'], enum: [null, 'planner', 'generator', 'evaluator', 'simplifier'], default: null },
                  },
                },
              },
            },
          },
        },
      },
    }, null, 2) + '\n',

    'harness/session-handoff.md': `# Session Handoff

## Context

<!-- What are we building? What phase are we in? -->

## Current State

- **Phase:**
- **Mode:** copilot
- **Current Feature:**
- **Outcome of last session:**

## Next Actions

1. ...
2. ...
3. ...

## Open Questions

- ...

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| ... | ... |
`,

    'harness/clean-state-checklist.md': `# Clean State Checklist

Run this before starting any phase to ensure deterministic state.

## Git

- [ ] Working tree clean (\`git status --porcelain\` empty)
- [ ] On correct branch (not detached HEAD)
- [ ] No pending rebase/merge/cherry-pick

## Harness

- [ ] \`harness/config.json\` exists and valid
- [ ] Current phase matches what we're about to run
- [ ] \`harness/progress.md\` has latest Session State
- [ ] \`harness/features/feature-list.json\` up-to-date

## Environment

- [ ] Dependencies installed
- [ ] Required services running
- [ ] No stale background processes
`,

    'harness/docs/ARCHITECTURE.md': `# Architecture

## Module Structure

\`\`\`
src/
  ...
\`\`\`
`,

    'harness/docs/CONSTRAINTS.md': `# Constraints

## Technical

- **Language:** ${stack}
- **Platform:** <!-- target platform -->
- **Dependencies:** <!-- key dependency constraints -->

## Process

- Commits must be atomic (one concern per commit)
- All code reviewed before merging
- Tests must pass before shipping

## Design

- Favor simplicity over generality
- Explicit over implicit
- Fail fast, fail loud
`,

    'harness/docs/DECISIONS.md': `# Decisions

<!-- Record architectural and design decisions here. Use the format below. -->

## YYYY-MM-DD: Title

**Status:** proposed | accepted | deprecated | superseded

**Context:** Why was this decision needed?

**Decision:** What was chosen?

**Consequences:** What trade-offs were accepted?

---

| Date | Decision | Status |
|------|----------|--------|
| | | |
`,

    'harness/docs/api-patterns.md': `# API Patterns

## Conventions

<!-- Document API conventions: URL structure, auth, error format, pagination -->

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/... | ... |
| POST | /api/v1/... | ... |

## Error Format

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
\`\`\`
`,
  };
}

/**
 * Return the stack config file stub content, or null if unknown.
 */
export function getConfigFileContent(stack) {
  return STACK_CONFIG_STUBS[stack] || null;
}

/**
 * Return the stack version file content, or null.
 */
export function getVersionFileContent(stack) {
  return STACK_VERSION_STUBS[stack] || null;
}

/**
 * Return .gitignore content for the given stack.
 */
export function getGitignoreContent(stack) {
  return `# Harness runtime state (regenerated by dev-harness)
harness/config.json
harness/features/feature-list.json
harness/progress.md
harness/session-handoff.md
harness/lessons-decisions.md

${GITIGNORE_PATTERNS[stack] || GITIGNORE_PATTERNS.generic}
# OS
.DS_Store
Thumbs.db
`;
}

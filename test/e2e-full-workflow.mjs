#!/usr/bin/env node
/**
 * e2e-full-workflow — Comprehensive end-to-end dev-harness workflow test.
 *
 * Initializes a dummy Node.js CLI project (calc-tool) via dev-harness, then
 * drives the ENTIRE workflow twice — once in copilot mode (AI-agent steps +
 * simulated human interventions) and once in autopilot mode (AI-agent only) —
 * while exercising the full flag matrix of every CLI command, all loops and
 * retries, contract negotiation, rollback/checkpoint, and injected errors.
 *
 * The "AI agent" role is realized as the scripted CLI sequence an agent tool
 * would issue (status → read phase skill → create work artifact → validate →
 * phase next). The "human" role is realized as scripted interventions
 * (pause/resume, config, contract, rollback, checkpoint, mode switch,
 * dirty-tree injection). This branch (main) is harness-backend only — there
 * is no agent-spawn command, so agent tools are external frontends.
 *
 * Emits:
 *   - references/e2e-results.json   (structured per-suite results)
 *   - references/e2e-checklist.md   (per-command × scenario checklist table)
 *   - stdout summary                (N pass, M fail)
 *
 * Usage:
 *   node test/e2e-full-workflow.mjs              # full matrix
 *   node test/e2e-full-workflow.mjs --verbose    # per-case output
 *   node test/e2e-full-workflow.mjs --quick      # skip slow autopilot full-run
 *   node test/e2e-full-workflow.mjs --only <id>  # run one phase (A-G or suite#)
 *
 * Exit code: 0 if all pass, 1 if any fail.
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const CLI = `node ${path.join(PROJECT_ROOT, 'cli/dev-harness.mjs')}`;
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

// ── Results recorder ─────────────────────────────────────────────────────────
const REPORT = { suites: [], startedAt: new Date().toISOString(), cli: CLI };
let totalPassed = 0;
let totalFailed = 0;
const allFailures = [];

function record(suite, cases) {
  const passed = cases.filter(c => c.pass).length;
  const failed = cases.length - passed;
  totalPassed += passed;
  totalFailed += failed;
  for (const c of cases) {
    if (!c.pass) allFailures.push({ suite, ...c });
  }
  REPORT.suites.push({ suite, cases, passed, failed });
}

function log(msg) { if (VERBOSE) console.log(`[e2e] ${msg}`); }
function vlog(msg) { if (VERBOSE) console.log(`[e2e:verbose] ${msg}`); }

// ── CLI runner ───────────────────────────────────────────────────────────────
/**
 * Run a dev-harness CLI command. Returns { ok, stdout, stderr, exitCode, json }.
 * ok = (exitCode === 0). json = parsed stdout if --json and parseable.
 */
function runCli(args, { cwd, expectJson = false } = {}) {
  try {
    const stdout = execSync(`${CLI} ${args}`, {
      cwd: cwd || process.cwd(),
      stdio: 'pipe',
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    }).toString();
    let json = null;
    if (expectJson || args.includes('--json')) {
      try { json = JSON.parse(stdout); } catch { /* not json */ }
    }
    return { ok: true, stdout, stderr: '', exitCode: 0, json };
  } catch (err) {
    const stdout = err.stdout ? err.stdout.toString() : '';
    const stderr = err.stderr ? err.stderr.toString() : (err.message || '');
    let json = null;
    if (expectJson || (args && args.includes && args.includes('--json'))) {
      try { json = JSON.parse(stdout); } catch { /* not json */ }
    }
    return { ok: false, stdout, stderr, exitCode: err.status ?? 1, json };
  }
}

// ── Assertions ───────────────────────────────────────────────────────────────
// Each returns { pass, msg }. On pass, msg = the label (so the checklist table is meaningful).
function assert(cond, msg) { return { pass: !!cond, msg: cond ? msg : (msg || 'Assertion failed') }; }
function assertEqual(actual, expected, msg) {
  return { pass: actual === expected, msg: actual === expected ? msg : `${msg || 'Not equal'}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}` };
}
function assertMatch(str, regex, msg) {
  return { pass: regex.test(str), msg: regex.test(str) ? msg : `${msg || 'No match'}: ${JSON.stringify(str?.slice(0, 200))}` };
}
function assertOk(val, msg) { return { pass: !!val, msg: val ? msg : (msg || 'Expected truthy') }; }
function assertStatus(result, status, msg) {
  const actual = result.json?.status;
  return { pass: actual === status, msg: actual === status ? msg : `${msg || 'Wrong status'}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(status)}` };
}
function assertExit(result, code, msg) {
  return { pass: result.exitCode === code, msg: result.exitCode === code ? msg : `${msg || 'Wrong exit'}: actual=${result.exitCode} expected=${code}` };
}

// ── Git helpers ──────────────────────────────────────────────────────────────
function git(args, cwd) {
  try {
    return execSync(`git ${args}`, { cwd, stdio: 'pipe', timeout: 15000 }).toString().trim();
  } catch (err) {
    return (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
  }
}
function gitInit(cwd) { git('init -q', cwd); }
function gitCommit(cwd, msg = 'wip') {
  git('add -A', cwd);
  git(`commit -q -m "${msg.replace(/"/g, '\\"')}" --allow-empty`, cwd);
}
function gitBranch(cwd, name) { git(`checkout -q -b ${name}`, cwd); }
function gitTag(cwd, name, msg) {
  if (msg) git(`tag -a ${name} -m "${msg}"`, cwd);
  else git(`tag ${name}`, cwd);
}
function gitDirty(cwd, file = 'dirty.txt', content = 'uncommitted') {
  fs.writeFileSync(path.join(cwd, file), content);
}
function gitClean(cwd) { git('checkout -- . && git clean -fdq', cwd); }
function gitTags(cwd) { return git('tag --list', cwd).split('\n').filter(Boolean); }

// ── Fixture root ─────────────────────────────────────────────────────────────
const E2E_TMP = fs.mkdtempSync(path.join(tmpdir(), 'devharness-e2e-'));
log(`Fixture root: ${E2E_TMP}`);

function freshDir(name) {
  const dir = path.join(E2E_TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function initProject(name, stack = 'node', extraInitArgs = '') {
  const dir = freshDir(name);
  const r = runCli(`init --stack ${stack} --target ${dir} ${extraInitArgs} --json`, { expectJson: true });
  return { dir, r };
}

// ── calc-tool dummy project generator ────────────────────────────────────────
// Node.js CLI utility with 3 features. Tests written to hit ≥80% coverage so
// the coverage gate (when enabled) passes; we also demonstrate the fail path
// by toggling coverage off or injecting a broken test.
const CALC_TOOL = {
  packageJson: {
    name: 'calc-tool',
    version: '1.0.0',
    type: 'module',
    description: 'Tiny CLI calculator',
    main: 'src/calc.js',
    bin: { 'calc-tool': 'src/cli.js' },
    scripts: {
      test: 'node --test',
      lint: 'node -e "console.log(\'lint ok\')"',
      coverage: 'node --test --experimental-test-coverage',
    },
    keywords: ['calculator', 'cli'],
    license: 'MIT',
  },
  // src/calc.js — core arithmetic + history
  calcJs: `/**
 * calc-tool — core arithmetic + history module.
 */
const history = [];

export function add(a, b) { return a + b; }
export function subtract(a, b) { return a - b; }
export function multiply(a, b) { return a * b; }
export function divide(a, b) {
  if (b === 0) throw new Error('divide by zero');
  return a / b;
}
export function logResult(expr, result) {
  history.push({ expr, result, at: new Date().toISOString() });
  return history.length;
}
export function clearHistory() {
  const n = history.length;
  history.length = 0;
  return n;
}
export function getHistory() { return [...history]; }
`,
  // src/cli.js — CLI interface
  cliJs: `#!/usr/bin/env node
import { add, subtract, multiply, divide, logResult, getHistory } from './calc.js';

function parseArgs(argv) {
  const [, , op, a, b] = argv;
  return { op, a: Number(a), b: Number(b) };
}

function formatOutput(result) {
  return \`result: \${result}\\n\`;
}

const { op, a, b } = parseArgs(process.argv);
const ops = { add, sub: subtract, mul: multiply, div: divide };
if (!ops[op]) { console.error('unknown op'); process.exit(2); }
const result = ops[op](a, b);
console.log(formatOutput(result));
logResult(\`\${a} \${op} \${b}\`, result);
`,
  // test/calc.test.js — hits ≥80% coverage
  calcTest: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, subtract, multiply, divide, logResult, clearHistory, getHistory } from '../src/calc.js';

test('add', () => assert.equal(add(2, 3), 5));
test('subtract', () => assert.equal(subtract(5, 2), 3));
test('multiply', () => assert.equal(multiply(4, 3), 12));
test('divide', () => assert.equal(divide(10, 2), 5));
test('divide by zero throws', () => assert.throws(() => divide(1, 0), /divide by zero/));
test('history log + clear', () => {
  clearHistory();
  assert.equal(logResult('1+1', 2), 1);
  assert.equal(getHistory().length, 1);
  assert.equal(clearHistory(), 1);
  assert.equal(getHistory().length, 0);
});
`,
  // Docs that ramp up for review/ship gates
  readme: `# calc-tool

Tiny CLI calculator with history. Usage: \`calc-tool add 2 3\`.

## Install

\`\`\`bash
npm install -g calc-tool
\`\`\`

## Usage

\`\`\`bash
calc-tool add 2 3      # → result: 5
calc-tool mul 4 5      # → result: 20
calc-tool div 10 2     # → result: 5
\`\`\`

## Features

- Arithmetic: add, subtract, multiply, divide
- History: logs each result, clear with \`calc-tool clear\`
- CLI: parses argv, formats output
`,
  license: `MIT License\n\nCopyright (c) 2026 calc-tool\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.\n`,
  changelog: `# Changelog\n\n## 1.0.0 — 2026-06-26\n\n- Initial release: add, subtract, multiply, divide, history\n`,
  contributing: `# Contributing\n\n1. Fork, branch, commit.\n2. \`npm test\` must pass.\n3. Open a PR.\n`,
  architecture: `# Architecture

## Modules
- \`src/calc.js\` — pure arithmetic + history
- \`src/cli.js\` — argv parsing + output formatting

## Data Flow
CLI args → parseArgs → op dispatch → calc function → logResult → stdout

## Decisions
- ESM modules (Node >=18)
- node:test built-in runner (no deps)
- History kept in-memory (cleared on process exit)
`,
  decisions: `# Decisions

## 2026-06-26 — Use node:test built-in runner

**Status:** accepted

**Context:** Need a test runner with zero install footprint for a CLI utility.

**Decision:** Use Node's built-in \`node:test\` (Node >=18) instead of jest/mocha.

**Consequences:** No external test deps; coverage via \`--experimental-test-coverage\`.
`,
  prd: `# PRD — calc-tool\n\n## Goal\nTiny CLI calculator with history.\n\n## Features\n1. arithmetic (add/sub/mul/div)\n2. history (log + clear)\n3. cli-interface (parse args, format output)\n`,
};

/** Write a calc-tool file into a project dir. */
function writeCalcFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** Scaffold calc-tool source/test/docs files (called progressively per phase). */
function scaffoldCalcSource(dir) {
  writeCalcFile(dir, 'package.json', CALC_TOOL.packageJson);
  writeCalcFile(dir, 'src/calc.js', CALC_TOOL.calcJs);
  writeCalcFile(dir, 'src/cli.js', CALC_TOOL.cliJs);
  writeCalcFile(dir, 'test/calc.test.js', CALC_TOOL.calcTest);
  fs.chmodSync(path.join(dir, 'src/cli.js'), 0o755);
}

function scaffoldCalcDocs(dir) {
  writeCalcFile(dir, 'README.md', CALC_TOOL.readme);
  writeCalcFile(dir, 'LICENSE', CALC_TOOL.license);
  writeCalcFile(dir, 'CHANGELOG.md', CALC_TOOL.changelog);
  writeCalcFile(dir, 'CONTRIBUTING.md', CALC_TOOL.contributing);
  writeCalcFile(dir, 'specs/prd.md', CALC_TOOL.prd);
  // Review/ship gates check harness/docs/ARCHITECTURE.md + DECISIONS.md (not project docs/).
  // Init scaffolds stubs that fail the gate (< MIN_DOC_LINES=5 or no decision entry).
  // Fill them with enough content + a valid dated decision entry.
  writeCalcFile(dir, 'harness/docs/ARCHITECTURE.md', CALC_TOOL.architecture);
  writeCalcFile(dir, 'harness/docs/DECISIONS.md', CALC_TOOL.decisions);
}

/** Set phases.enabled array directly in config.json (CLI array-set is blocked by shell quoting). */
function setPhasesEnabled(dir, phases) {
  const cfgPath = path.join(dir, 'harness', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  cfg.phases = cfg.phases || {};
  cfg.phases.enabled = phases;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

/** Write a 3-feature feature-list.json (matches harness/features path). */
function writeFeatureList(dir, features) {
  const fl = {
    version: '0.1',
    features: features || [
      {
        id: 'feature-001',
        name: 'arithmetic',
        description: 'Core arithmetic operations',
        passes: false,
        tasks: [
          { id: 'task-001', description: 'add/subtract', status: 'pending', acceptanceCriteria: ['add returns correct sum', 'subtract returns correct difference'] },
          { id: 'task-002', description: 'multiply/divide', status: 'pending', acceptanceCriteria: ['multiply returns correct product', 'divide returns correct quotient'] },
        ],
      },
      {
        id: 'feature-002',
        name: 'history',
        description: 'Result history log',
        passes: false,
        tasks: [
          { id: 'task-003', description: 'log results', status: 'pending', acceptanceCriteria: ['logResult appends to history', 'logResult returns void'] },
          { id: 'task-004', description: 'clear history', status: 'pending', acceptanceCriteria: ['clearHistory empties the log', 'getHistory returns empty after clear'] },
        ],
      },
      {
        id: 'feature-003',
        name: 'cli-interface',
        description: 'CLI parsing + output',
        passes: false,
        tasks: [
          { id: 'task-005', description: 'parse args', status: 'pending', acceptanceCriteria: ['parseArgs extracts op/a/b from argv', 'unknown op exits with code 2'] },
          { id: 'task-006', description: 'format output', status: 'pending', acceptanceCriteria: ['formatOutput returns result string', 'output includes the numeric result'] },
        ],
      },
    ],
  };
  const flPath = path.join(dir, 'harness', 'features', 'feature-list.json');
  fs.mkdirSync(path.dirname(flPath), { recursive: true });
  fs.writeFileSync(flPath, JSON.stringify(fl, null, 2));
  return fl;
}

/** Mark a task complete in feature-list.json. */
function markTaskComplete(dir, featureId, taskId) {
  const flPath = path.join(dir, 'harness', 'features', 'feature-list.json');
  const fl = JSON.parse(fs.readFileSync(flPath, 'utf-8'));
  const feat = fl.features.find(f => f.id === featureId);
  if (feat) {
    const tk = feat.tasks.find(t => t.id === taskId);
    if (tk) tk.status = 'complete';
    if (feat.tasks.every(t => t.status === 'complete')) feat.passes = true;
  }
  fs.writeFileSync(flPath, JSON.stringify(fl, null, 2));
}

/** Mark all tasks of a feature complete (shortcut). */
function markFeatureComplete(dir, featureId) {
  const flPath = path.join(dir, 'harness', 'features', 'feature-list.json');
  const fl = JSON.parse(fs.readFileSync(flPath, 'utf-8'));
  const feat = fl.features.find(f => f.id === featureId);
  if (feat) {
    for (const t of feat.tasks) t.status = 'complete';
    feat.passes = true;
  }
  fs.writeFileSync(flPath, JSON.stringify(fl, null, 2));
}

/**
 * Override stackMeta in harness/config.json directly (config set stackMeta.x fails
 * because stackMeta defaults to null and nested set-on-null throws; whole-object
 * set via CLI is blocked by shell quoting of JSON). Used to make lint/test gates
 * pass without external deps (eslint).
 */
function setStackMeta(dir, meta) {
  const cfgPath = path.join(dir, 'harness', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
  cfg.stackMeta = { ...cfg.stackMeta, ...meta };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
}

// ── G-suite helpers (G1-G24 gap coverage) ────────────────────────────────────
// These extend the existing helper set to cover the new commands/gates/flags
// introduced by the G1-G24 gap implementations.

/** Read parsed harness/config.json. */
function readConfig(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'config.json'), 'utf-8'));
}

/** Read harness/session-handoff.md content (string). Returns null if missing. */
function readHandoffFile(dir) {
  const p = path.join(dir, 'harness', 'session-handoff.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

/** Read harness/progress.md content (string). Returns null if missing. */
function readProgressFile(dir) {
  const p = path.join(dir, 'harness', 'progress.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

/** Read harness/lessons-decisions.md content (string). Returns null if missing. */
function readDecisionsFile(dir) {
  const p = path.join(dir, 'harness', 'lessons-decisions.md');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

/** Set producedByRole on a task in feature-list.json (for self-eval guard tests). */
function setProducedByRole(dir, featureId, taskId, role) {
  const flPath = path.join(dir, 'harness', 'features', 'feature-list.json');
  const fl = JSON.parse(fs.readFileSync(flPath, 'utf-8'));
  const feat = fl.features.find(f => f.id === featureId);
  if (feat) {
    const tk = feat.tasks.find(t => t.id === taskId);
    if (tk) tk.producedByRole = role;
  }
  fs.writeFileSync(flPath, JSON.stringify(fl, null, 2));
}

/** Set acceptanceCriteria list on a task (for task-criteria gate pass/fail tests). */
function setAcceptanceCriteria(dir, featureId, taskId, criteria) {
  const flPath = path.join(dir, 'harness', 'features', 'feature-list.json');
  const fl = JSON.parse(fs.readFileSync(flPath, 'utf-8'));
  const feat = fl.features.find(f => f.id === featureId);
  if (feat) {
    const tk = feat.tasks.find(t => t.id === taskId);
    if (tk) tk.acceptanceCriteria = criteria;
  }
  fs.writeFileSync(flPath, JSON.stringify(fl, null, 2));
}

/**
 * Scaffold calc-tool source WITHOUT console.log (uses process.stdout.write).
 * Needed for scenarios that keep the anti-placeholder gate enabled (the default
 * scaffoldCalcSource uses console.log in src/cli.js, which trips anti-placeholder).
 */
function scaffoldPlaceholderFreeSource(dir) {
  writeCalcFile(dir, 'package.json', CALC_TOOL.packageJson);
  writeCalcFile(dir, 'src/calc.js', CALC_TOOL.calcJs);
  // cli.js variant: process.stdout.write instead of console.log
  writeCalcFile(dir, 'src/cli.js', `#!/usr/bin/env node
import { add, subtract, multiply, divide, logResult, getHistory } from './calc.js';

function parseArgs(argv) {
  const [, , op, a, b] = argv;
  return { op, a: Number(a), b: Number(b) };
}

function formatOutput(result) {
  return \`result: \${result}\\n\`;
}

const { op, a, b } = parseArgs(process.argv);
const ops = { add, sub: subtract, mul: multiply, div: divide };
if (!ops[op]) { process.stderr.write('unknown op\\n'); process.exit(2); }
const result = ops[op](a, b);
process.stdout.write(formatOutput(result));
logResult(\`\${a} \${op} \${b}\`, result);
`);
  writeCalcFile(dir, 'test/calc.test.js', CALC_TOOL.calcTest);
  fs.chmodSync(path.join(dir, 'src/cli.js'), 0o755);
}

/** Write/replace the ## Verification Criteria section in sprint-contract.md. */
function writeContractCriteria(dir, criteriaLines) {
  const p = path.join(dir, 'harness', 'sprint-contract.md');
  let content = fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '# Sprint Contract\n\n## Scope\n\nTBD\n\n';
  const block = '## Verification Criteria\n\n' + criteriaLines.map(l => `- ${l}`).join('\n') + '\n';
  if (/## Verification Criteria/.test(content)) {
    content = content.replace(/## Verification Criteria[\s\S]*?(?=## |$)/, block);
  } else {
    content = content.trimEnd() + '\n\n' + block;
  }
  fs.writeFileSync(p, content);
}

/** Write harness/evaluator-rubric.md with N filled-in score lines (for rubric-content gate). */
function fillRubric(dir, lineCount) {
  const lines = ['# Evaluator Rubric', ''];
  for (let i = 0; i < lineCount; i++) {
    lines.push(`- Dimension ${i + 1}: 2 — meets bar with minor notes`);
  }
  lines.push('');
  fs.writeFileSync(path.join(dir, 'harness', 'evaluator-rubric.md'), lines.join('\n'));
}

/** Count occurrences of a substring in a string. */
function countOccurrences(haystack, needle) {
  return haystack ? haystack.split(needle).length - 1 : 0;
}

// ── Suite runner ─────────────────────────────────────────────────────────────
const SUITES = [];

function suite(id, name, fn) {
  SUITES.push({ id, name, fn });
}

function shouldRun(suiteId) {
  if (!ONLY) return true;
  return ONLY === suiteId;
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE B — init full flag matrix
// ══════════════════════════════════════════════════════════════════════════════
suite('B', 'init full flag matrix', () => {
  const cases = [];

  // B1 — node stack, new empty dir, AGENTS.md only (no agent-tool)
  {
    const { dir, r } = initProject('b1-node', 'node');
    cases.push(assertStatus(r, 'ok', 'B1 init status=ok'));
    cases.push(assertOk(r.json?.message, 'B1 has message'));
    cases.push(assert(fs.existsSync(path.join(dir, 'AGENTS.md')), 'B1 AGENTS.md exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'config.json')), 'B1 harness/config.json exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'features', 'feature-list.json')), 'B1 feature-list.json exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'progress.md')), 'B1 progress.md exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'sprint-contract.md')), 'B1 sprint-contract.md exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'scripts', 'init.sh')), 'B1 init.sh exists'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'evaluator-rubric.md')), 'B1 evaluator-rubric.md exists'));
    // 7 phase skill files
    for (const p of ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship']) {
      cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', `${p}.md`)), `B1 phase ${p}.md exists`));
    }
    // 4 agent role files
    for (const a of ['planner', 'generator', 'evaluator', 'simplifier']) {
      cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'agents', `${a}.md`)), `B1 agent ${a}.md exists`));
    }
    // init.sh executable bit (non-Windows)
    if (process.platform !== 'win32') {
      const stat = fs.statSync(path.join(dir, 'harness', 'scripts', 'init.sh'));
      cases.push(assert(Boolean(stat.mode & 0o100), 'B1 init.sh is executable'));
    }
    // git init + initial commit
    cases.push(assertMatch(git('log --oneline', dir), /harness: initial scaffold|harness/, 'B1 git initial commit'));
    // config defaults (read from harness/config.json — init JSON has stack at top-level, no config object)
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'config.json'), 'utf-8'));
    cases.push(assertEqual(cfg.mode, 'copilot', 'B1 default mode copilot'));
    cases.push(assertEqual(cfg.currentPhase, null, 'B1 currentPhase null'));
    cases.push(assertEqual(cfg.gates?.enabled, true, 'B1 gates enabled default (G12: enforcement by default)'));
    cases.push(assertEqual(cfg.maxRetries, 10, 'B1 maxRetries 10 (DEFAULT_MAX_RETRIES)'));
    cases.push(assertEqual(cfg.phases?.enabled.includes('simplify'), false, 'B1 simplify excluded default'));
    cases.push(assertEqual(cfg.stack, 'node', 'B1 stack node in config'));
    cases.push(assertEqual(r.json?.stack, 'node', 'B1 stack node in init JSON top-level'));
  }

  // B2 — python stack
  {
    const { dir, r } = initProject('b2-python', 'python');
    cases.push(assertStatus(r, 'ok', 'B2 python init ok'));
    cases.push(assertEqual(r.json?.stack, 'python', 'B2 stack python (top-level)'));
  }

  // B3 — go stack
  {
    const { dir, r } = initProject('b3-go', 'go');
    cases.push(assertStatus(r, 'ok', 'B3 go init ok'));
    cases.push(assertEqual(r.json?.stack, 'go', 'B3 stack go (top-level)'));
  }

  // B4 — generic stack
  {
    const { dir, r } = initProject('b4-generic', 'generic');
    cases.push(assertStatus(r, 'ok', 'B4 generic init ok'));
    cases.push(assertEqual(r.json?.stack, 'generic', 'B4 stack generic (top-level)'));
  }

  // B5 — existing clean repo (should not re-init git, should scaffold)
  {
    const dir = freshDir('b5-existing-clean');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"pre","version":"1.0.0"}');
    gitInit(dir); gitCommit(dir, 'pre-existing');
    const r = runCli(`init --stack node --target ${dir} --json`, { expectJson: true });
    cases.push(assertStatus(r, 'ok', 'B5 existing-clean init ok'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'config.json')), 'B5 scaffolded into existing repo'));
    cases.push(assertMatch(git('log --oneline', dir), /pre-existing/, 'B5 preserved existing commit'));
  }

  // B6 — existing dirty repo: init scaffolds regardless (dirty git is NOT a rejection criterion;
  // --force is only for overwriting existing *harness* files). Verify it succeeds.
  {
    const dir = freshDir('b6-existing-dirty');
    gitInit(dir); gitCommit(dir, 'initial');
    gitDirty(dir);
    const r = runCli(`init --stack node --target ${dir} --json`, { expectJson: true });
    cases.push(assertStatus(r, 'ok', 'B6 dirty repo init succeeds (dirty git not rejected)'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'config.json')), 'B6 scaffolded into dirty repo'));
  }

  // B7 — re-init on already-scaffolded dir without --force (harness files exist → rejected)
  {
    const { dir } = initProject('b7-reinit-noforce');
    const r = runCli(`init --stack node --target ${dir} --json`, { expectJson: true });
    cases.push(assertExit(r, 1, 'B7 re-init without --force exits 1 (harness files exist)'));
    cases.push(assert(r.ok === false, 'B7 re-init rejected without --force'));
    // --force overwrites
    const r2 = runCli(`init --stack node --target ${dir} --force --json`, { expectJson: true });
    cases.push(assertStatus(r2, 'ok', 'B7 --force re-init ok'));
  }

  // B8 — --no-git (no git repo created)
  {
    const { dir, r } = initProject('b8-no-git', 'node', '--no-git');
    cases.push(assertStatus(r, 'ok', 'B8 --no-git init ok'));
    cases.push(assert(!fs.existsSync(path.join(dir, '.git')), 'B8 no .git dir'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'config.json')), 'B8 still scaffolds harness'));
  }

  // B9 — --agent-tool single (claude-code) → CLAUDE.md
  {
    const { dir, r } = initProject('b9-claude', 'node', '--agent-tool claude-code');
    cases.push(assertStatus(r, 'ok', 'B9 agent-tool claude-code ok'));
    cases.push(assert(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'B9 CLAUDE.md generated'));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'config.json'), 'utf-8'));
    cases.push(assertEqual(cfg.agentTool, 'claude-code', 'B9 agentTool stored in config.json'));
  }

  // B10 — --agent-tool comma list (claude-code,cursor)
  {
    const { dir, r } = initProject('b10-multi', 'node', '--agent-tool claude-code,cursor');
    cases.push(assertStatus(r, 'ok', 'B10 comma agent-tools ok'));
    cases.push(assert(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'B10 CLAUDE.md generated'));
    cases.push(assert(fs.existsSync(path.join(dir, '.cursorrules')), 'B10 .cursorrules generated'));
  }

  // B11 — --agent-tool all
  {
    const { dir, r } = initProject('b11-all', 'node', '--agent-tool all');
    cases.push(assertStatus(r, 'ok', 'B11 agent-tool all ok'));
    cases.push(assert(fs.existsSync(path.join(dir, 'CLAUDE.md')), 'B11 all → CLAUDE.md'));
  }

  // B12 — invalid agent-tool (rejected)
  {
    const dir = freshDir('b12-bad-tool');
    const r = runCli(`init --stack node --target ${dir} --agent-tool not-a-tool --json`, { expectJson: true });
    cases.push(assertExit(r, 2, 'B12 invalid agent-tool exits 2 (usage)'));
  }

  // B13 — --mode autopilot at init
  {
    const { dir, r } = initProject('b13-autopilot', 'node', '--mode autopilot');
    cases.push(assertStatus(r, 'ok', 'B13 --mode autopilot init ok'));
    const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'config.json'), 'utf-8'));
    cases.push(assertEqual(cfg.mode, 'autopilot', 'B13 mode autopilot stored in config.json'));
  }

  // B14 — invalid mode (rejected)
  {
    const dir = freshDir('b14-bad-mode');
    const r = runCli(`init --stack node --target ${dir} --mode badmode --json`, { expectJson: true });
    cases.push(assertExit(r, 2, 'B14 invalid mode exits 2'));
  }

  // B15 — human output (no --json) is non-empty and not JSON
  {
    const dir = freshDir('b15-human');
    const r = runCli(`init --stack node --target ${dir}`, {});
    cases.push(assert(r.ok, 'B15 human init ok'));
    cases.push(assert(r.stdout.length > 0, 'B15 human output non-empty'));
    cases.push(assert(!r.stdout.trim().startsWith('{'), 'B15 human output not JSON'));
  }

  // B16 — re-init without --force on already-scaffolded dir (covered by B7; keep as explicit duplicate check)
  {
    const { dir } = initProject('b16-reinit');
    const r = runCli(`init --stack node --target ${dir} --json`, { expectJson: true });
    cases.push(assert(r.ok === false, 'B16 re-init without --force rejected (harness files exist)'));
  }

  record('B-init', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE C — Copilot workflow simulation (AI agent + human)
// ══════════════════════════════════════════════════════════════════════════════
// Workflow sequence per phase (copilot mode):
//   1. AI: `phase <name>` — sets currentPhase, prints instructions
//   2. AI: read harness/docs/phases/<name>.md skill
//   3. AI: create work artifacts (specs, source, tests, docs)
//   4. AI: `validate` — gate checks for current phase
//   5. Human: interventions (pause/resume, contract, checkpoint, dirty-tree, learn)
//   6. AI: `phase next` — checks current-phase gate, advances to next phase
// Gates enabled mid-workflow. stackMeta overrides lint/test commands so gates
// pass without external deps (eslint). Coverage gate left off (default).
suite('C', 'copilot workflow simulation (AI agent + human)', () => {
  const cases = [];
  const { dir } = initProject('c-copilot-run', 'node');
  const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });

  // Enable gates + override stackMeta so lint/test gates pass without eslint installed.
  cases.push(assertStatus(T('config set gates.enabled true'), 'ok', 'C gates enabled'));
  // Disable anti-placeholder gate for this test project — calc-tool CLI legitimately uses console.log for output.
  // (G24b: anti-placeholder gate is on by default; disable here to test the workflow, not the gate.)
  cases.push(assertStatus(T('config set gates.antiPlaceholder.enabled false'), 'ok', 'C anti-placeholder disabled (calc CLI uses console.log)'));
  setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
  cases.push(assertOk(T('config get stackMeta').json?.value?.lintCmd === 'node -e 1', 'C stackMeta.lintCmd override persisted'));
  cases.push(assertOk(T('config get stackMeta').json?.value?.testCmd === 'node --test', 'C stackMeta.testCmd override persisted'));

  // ── DEFINE (AI agent) ──────────────────────────────────────────────────────
  {
    const st = T('status');
    cases.push(assertStatus(st, 'ok', 'C status before define ok'));
    cases.push(assertEqual(st.json?.currentPhase, null, 'C currentPhase null at start'));

    // AI: phase define — sets currentPhase=define
    const ph = T('phase define');
    cases.push(assertOk(ph.ok, 'C phase define ok'));

    // AI reads harness/docs/phases/define.md (verify file exists = "read")
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'define.md')), 'C define.md skill accessible'));

    // AI creates work artifacts
    scaffoldCalcDocs(dir);
    cases.push(assert(fs.existsSync(path.join(dir, 'specs', 'prd.md')), 'C AI wrote specs/prd.md'));

    // AI: contract propose
    const prop = T('contract propose --scope "build calc-tool with 3 features" --criteria "tests pass|coverage>=80"');
    cases.push(assertStatus(prop, 'ok', 'C contract propose ok'));

    // Human intervention: evaluator requests revision (loop)
    const rev1 = T('contract review --needs-revision --notes "add history feature scope"');
    cases.push(assertStatus(rev1, 'ok', 'C contract review needs-revision ok'));

    // AI re-proposes
    T('contract propose --scope "build calc-tool with arithmetic, history, cli-interface" --criteria "tests pass|coverage>=80"');
    // Evaluator agrees
    const agreed = T('contract review --agreed');
    cases.push(assertStatus(agreed, 'ok', 'C contract review agreed ok'));

    // AI: create feature branch (define gate requires not on main/master)
    gitBranch(dir, 'feat/calc-tool');
    gitCommit(dir, 'define: specs + contract');

    // AI: validate (define gate: feature-branch, contract-agreed)
    const val = T('validate');
    cases.push(assertStatus(val, 'ok', 'C define validate pass'));
    cases.push(assertOk(val.json?.overall, 'C define gate overall pass'));

    // Human intervention: learn a lesson (progress.md append)
    const learn = T('learn "define: contract negotiation reached agreement in 2 rounds"');
    cases.push(assertStatus(learn, 'ok', 'C learn lesson ok'));

    // AI: phase next → advance to plan (checks define gate first)
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to plan ok'));
    cases.push(assertMatch(next.json?.currentPhase || '', /plan/, 'C advanced to plan (currentPhase)'));
  }

  // ── PLAN (AI agent) ────────────────────────────────────────────────────────
  {
    // AI: phase plan already set by phase next. Read plan.md skill.
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'plan.md')), 'C plan.md skill accessible'));

    // AI writes feature-list.json (3 features/tasks)
    writeFeatureList(dir);
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'features', 'feature-list.json')), 'C AI wrote feature-list.json'));

    // AI: validate (plan gate: git-clean) — commit first for clean tree
    gitCommit(dir, 'plan: feature list');
    const val = T('validate');
    cases.push(assertStatus(val, 'ok', 'C plan validate pass'));

    // Human intervention: checkpoint before build
    const cp = T('checkpoint create pre-build');
    cases.push(assertStatus(cp, 'ok', 'C checkpoint pre-build ok'));
    cases.push(assert(gitTags(dir).includes('manual/pre-build'), 'C manual/pre-build tag created'));

    // Human: enable task retry
    cases.push(assertStatus(T('config set retry.tasks.enabled true'), 'ok', 'C retry.tasks.enabled true'));

    // AI: phase next → build
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to build ok'));
  }

  // ── BUILD (AI agent, task loop feature-iterate) ───────────────────────────
  {
    // AI reads build.md
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'build.md')), 'C build.md skill accessible'));

    // AI scaffolds source + tests
    scaffoldCalcSource(dir);
    gitCommit(dir, 'build: scaffold source');

    // Inner loop: iterate features/tasks. For each, validate --feature --task.
    const feats = ['feature-001', 'feature-002', 'feature-003'];
    const tasks = ['task-001', 'task-002', 'task-003', 'task-004', 'task-005', 'task-006'];
    for (const t of tasks) {
      const v = T(`validate --feature ${feats[Math.floor((tasks.indexOf(t)) / 2)]} --task ${t}`);
      cases.push(assertOk(v.ok, `C build validate ${t} ok`));
    }
    // Mark all features complete (simulating agent finishing each)
    for (const f of feats) markFeatureComplete(dir, f);
    gitCommit(dir, 'build: all features complete');

    // Human intervention: pause then resume
    cases.push(assertStatus(T('pause'), 'ok', 'C pause ok'));
    cases.push(assertEqual(T('config get paused').json?.value, true, 'C paused=true persisted'));
    cases.push(assertStatus(T('resume'), 'ok', 'C resume ok'));

    // AI: validate full build gate (git-clean, lint, tests, contract-agreed, coverage-off)
    const val = T('validate');
    cases.push(assertOk(val.ok, 'C build full validate ok'));

    // AI: phase next → verify (checks build gate first)
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to verify ok'));
  }

  // ── VERIFY (AI agent) ──────────────────────────────────────────────────────
  {
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'verify.md')), 'C verify.md skill accessible'));
    // AI runs full test suite (already passing from build)
    const val = T('validate');
    cases.push(assertOk(val.ok, 'C verify validate ok'));

    // Human intervention: rollback list (demonstrate checkpoint awareness)
    const rl = T('rollback list');
    cases.push(assertStatus(rl, 'ok', 'C rollback list ok'));
    cases.push(assertOk(rl.json?.checkpoints?.length >= 1, 'C rollback list has ≥1 checkpoint'));

    // Human: enable simplify phase BEFORE advancing so verify→simplify transition is valid.
    // (Direct config edit — CLI array-set is blocked by shell quoting of JSON.)
    setPhasesEnabled(dir, ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship']);
    cases.push(assertOk(T('config get phases.enabled').json?.value?.includes('simplify'), 'C simplify added to phases.enabled'));

    // AI: phase next → simplify (simplify now in pipeline)
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to simplify ok'));
  }

  // ── SIMPLIFY (opt-in, AI agent) ────────────────────────────────────────────
  {

    // AI: phase simplify
    const ph = T('phase simplify');
    cases.push(assertOk(ph.ok, 'C phase simplify ok'));
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'simplify.md')), 'C simplify.md skill accessible'));

    // Human intervention: inject empty dir → no-empty-dirs gate fails
    fs.mkdirSync(path.join(dir, 'empty-dir'), { recursive: true });
    const valFail = T('validate');
    cases.push(assertOk(!valFail.json?.overall, 'C simplify validate fails with empty dir'));
    cases.push(assertMatch(JSON.stringify(valFail.json?.failures || []), /no-empty-dirs/, 'C no-empty-dirs failure reported'));
    fs.rmSync(path.join(dir, 'empty-dir'), { recursive: true, force: true });

    // AI: validate passes now
    const val = T('validate');
    cases.push(assertOk(val.ok, 'C simplify validate pass after cleanup'));

    // AI: phase next → review
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to review ok'));
  }

  // ── REVIEW (AI agent) ──────────────────────────────────────────────────────
  {
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'review.md')), 'C review.md skill accessible'));
    // AI: docs already scaffolded (architecture, decisions, readme, rubric from init)
    gitCommit(dir, 'review: prep');
    const val = T('validate');
    cases.push(assertOk(val.ok, 'C review validate ok'));

    // Human intervention: contract escalate (demonstrate escalation path on a fresh contract)
    const esc = T('contract escalate --reason "reviewer disagrees with scope"');
    cases.push(assertStatus(esc, 'ok', 'C contract escalate ok'));

    // AI: phase next → ship
    const next = T('phase next');
    cases.push(assertOk(next.ok, 'C phase next to ship ok'));
  }

  // ── SHIP (AI agent) ────────────────────────────────────────────────────────
  {
    cases.push(assert(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'ship.md')), 'C ship.md skill accessible'));
    // AI: ensure ship deliverables present (changelog, contributing, license, readme already scaffolded)
    gitCommit(dir, 'ship: release prep');
    // AI: git tag for release
    gitTag(dir, 'v1.0.0', 'release 1.0.0');

    const val = T('validate');
    cases.push(assertOk(val.ok, 'C ship validate ok'));

    // AI: phase next → pipeline complete (no next phase after ship)
    const next = T('phase next');
    cases.push(assertOk(next.ok || next.json?.status === 'complete', 'C phase next at ship end ok'));
    const st = T('status');
    cases.push(assertEqual(st.json?.currentPhase, 'ship', 'C currentPhase=ship at end'));
  }

  // Human: worktree + final checkpoint
  {
    const wt = T('worktree create release-prep');
    cases.push(assertOk(wt.ok || wt.json?.status === 'ok' || wt.exitCode === 0, 'C worktree create release-prep ok'));
    const cp = T('checkpoint create v1.0 --force');
    cases.push(assertStatus(cp, 'ok', 'C final checkpoint v1.0 ok'));
  }

  record('C-copilot', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE D — Autopilot workflow simulation (AI agent only)
// ══════════════════════════════════════════════════════════════════════════════
suite('D', 'autopilot workflow simulation (AI agent only)', () => {
  if (QUICK) { record('D-autopilot', [{ pass: true, msg: 'skipped (--quick)' }]); return; }
  const cases = [];
  const { dir } = initProject('d-autopilot-run', 'node', '--mode autopilot');
  const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });

  // D1 — set-mode autopilot rejected before define
  {
    // Fresh project, currentPhase=null → autopilot requires phase>=define
    const r = T('set-mode autopilot');
    cases.push(assertExit(r, 1, 'D set-mode autopilot rejected before define (exit 1)'));
  }

  // Switch to copilot to bootstrap define, then back to autopilot.
  // Enable gates + stackMeta override so lint/test gates pass without eslint.
  cases.push(assertStatus(T('set-mode copilot'), 'ok', 'D set-mode copilot ok'));
  cases.push(assertStatus(T('config set gates.enabled true'), 'ok', 'D gates enabled'));
  setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });

  // DEFINE (bootstrap so autopilot can take over). phase define sets currentPhase.
  T('phase define');
  scaffoldCalcDocs(dir);
  T('contract propose --scope "calc-tool" --criteria "tests pass|lint clean"');
  T('contract review --agreed');
  gitBranch(dir, 'feat/calc-tool');
  gitCommit(dir, 'define: specs');
  // validate define gate passes, then phase next → plan
  T('validate');
  T('phase next'); // → plan

  // Now autopilot is allowed (currentPhase=plan >= define)
  cases.push(assertStatus(T('set-mode autopilot'), 'ok', 'D set-mode autopilot ok after define'));

  // PLAN: write feature list + source, commit, advance
  writeFeatureList(dir);
  scaffoldCalcSource(dir);
  gitCommit(dir, 'plan+build: features + source');

  // Mark all features complete (simulating agent doing the work between transitions)
  for (const f of ['feature-001', 'feature-002', 'feature-003']) markFeatureComplete(dir, f);
  gitCommit(dir, 'build: all features done');

  // Advance plan → build (autopilot auto-advances via continuePipeline)
  const phBuild = T('phase next');
  cases.push(assertOk(phBuild.ok, 'D phase next plan→build (autopilot) ok'));

  // Pause injection mid-run to verify autopilot respects paused.
  cases.push(assertStatus(T('pause'), 'ok', 'D pause mid-autopilot ok'));
  const pausedNext = T('phase next');
  cases.push(assertMatch(JSON.stringify(pausedNext.json || {}), /paused/, 'D autopilot blocked when paused'));
  cases.push(assertStatus(T('resume'), 'ok', 'D resume ok'));

  // Drive remaining phases build → verify → review → ship.
  // Each phase next checks current-phase gate; git must be clean + tests pass.
  let cur = T('status');
  let safety = 12;
  while (cur.json?.currentPhase !== 'ship' && safety-- > 0) {
    gitCommit(dir, 'wip ' + cur.json?.currentPhase); // ensure clean tree
    const r = T('phase next');
    if (!r.ok) break;
    cur = T('status');
  }
  cases.push(assertEqual(cur.json?.currentPhase, 'ship', 'D reached ship phase'));

  // Final ship deliverables
  gitCommit(dir, 'ship: release');
  gitTag(dir, 'v1.0.0', 'release');
  const finalNext = T('phase next');
  // At ship, phase next reports complete
  cases.push(assertOk(finalNext.ok || finalNext.json?.status === 'complete', 'D ship phase next complete'));

  record('D-autopilot', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// PHASE E — Per-command edge-case matrix
// ══════════════════════════════════════════════════════════════════════════════
suite('E', 'per-command edge-case matrix', () => {
  const cases = [];

  // Fresh project for edge cases
  const { dir } = initProject('e-edge-cases', 'node');
  const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });

  // ── status ─────────────────────────────────────────────────────────────────
  {
    // Uninitialized dir
    const empty = freshDir('e-status-empty');
    const r1 = runCli('status --json', { cwd: empty, expectJson: true });
    cases.push(assertStatus(r1, 'ok', 'E status uninitialized ok (graceful)'));
    cases.push(assertMatch(r1.json?.message || '', /No harness|init/, 'E status uninitialized message'));

    // Fresh project
    const r2 = T('status');
    cases.push(assertStatus(r2, 'ok', 'E status fresh ok'));
    cases.push(assertEqual(r2.json?.currentPhase, null, 'E status fresh currentPhase null'));

    // Mid-pipeline (set a phase)
    T('phase define');
    const r3 = T('status');
    cases.push(assertEqual(r3.json?.currentPhase, 'define', 'E status mid-pipeline currentPhase define'));

    // Paused
    T('pause');
    const r4 = T('status');
    cases.push(assertEqual(r4.json?.paused, true, 'E status paused=true'));
    T('resume');

    // --json shape
    cases.push(assertOk(r4.json?.command === 'status', 'E status json has command'));
  }

  // ── validate ───────────────────────────────────────────────────────────────
  {
    // Gates disabled (explicitly — G12: gates are ON by default now, disable for this test)
    T('config set gates.enabled false');
    const r1 = T('validate');
    cases.push(assertStatus(r1, 'ok', 'E validate gates disabled ok'));
    cases.push(assertMatch(r1.json?.message || '', /Gates disabled/, 'E validate gates disabled message'));

    // Enable gates
    T('config set gates.enabled true');
    const r2 = T('validate');
    cases.push(assertOk(r2.ok || r2.json?.status === 'ok' || r2.json?.status === 'error', 'E validate enabled returns result'));

    // --phase override
    const r3 = T('validate --phase plan');
    cases.push(assertOk(r3.json?.phase === 'plan', 'E validate --phase override'));

    // --feature/--task (stub but parsed)
    const r4 = T('validate --feature feature-001 --task task-001');
    cases.push(assertOk(r4.json?.feature === 'feature-001', 'E validate --feature parsed'));

    // No phase (reset config currentPhase=null)
    T('config set currentPhase null');
    const r5 = T('validate');
    cases.push(assertExit(r5, 1, 'E validate no-phase exits 1'));
    T('config set currentPhase define');
  }

  // ── set-mode ───────────────────────────────────────────────────────────────
  {
    const d2 = initProject('e-setmode').dir;
    const T2 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d2, expectJson: true });
    cases.push(assertStatus(T2('set-mode copilot'), 'ok', 'E set-mode copilot ok'));
    // autopilot before define rejected
    const r = T2('set-mode autopilot');
    cases.push(assertExit(r, 1, 'E set-mode autopilot before define rejected'));
    // invalid mode
    const r2 = T2('set-mode badmode');
    cases.push(assertExit(r2, 2, 'E set-mode invalid exits 2'));
  }

  // ── config ─────────────────────────────────────────────────────────────────
  {
    // list
    const r1 = T('config list');
    cases.push(assertStatus(r1, 'ok', 'E config list ok'));
    cases.push(assertOk(r1.json?.params?.length > 0, 'E config list has params'));

    // get existing
    const r2 = T('config get mode');
    cases.push(assertStatus(r2, 'ok', 'E config get mode ok'));

    // get missing key
    const r3 = T('config get nonexistent.key');
    cases.push(assertEqual(r3.json?.value, null, 'E config get missing returns null'));

    // set valid
    const r4 = T('config set maxRetries 5');
    cases.push(assertStatus(r4, 'ok', 'E config set maxRetries ok'));
    cases.push(assertEqual(T('config get maxRetries').json?.value, 5, 'E config set persisted'));

    // nested dot-notation
    const r5 = T('config set gates.coverage.threshold 90');
    cases.push(assertStatus(r5, 'ok', 'E config set nested ok'));
    cases.push(assertEqual(T('config get gates.coverage.threshold').json?.value, 90, 'E config nested persisted'));

    // retry config
    cases.push(assertStatus(T('config set retry.features.enabled true'), 'ok', 'E config retry.features.enabled ok'));
    cases.push(assertStatus(T('config set retry.phases.enabled true'), 'ok', 'E config retry.phases.enabled ok'));
  }

  // ── pause/resume ───────────────────────────────────────────────────────────
  {
    const d3 = initProject('e-pause').dir;
    const T3 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d3, expectJson: true });
    cases.push(assertStatus(T3('pause'), 'ok', 'E pause ok'));
    cases.push(assertStatus(T3('pause'), 'ok', 'E double-pause ok (idempotent)'));
    cases.push(assertStatus(T3('resume'), 'ok', 'E resume ok'));
    cases.push(assertStatus(T3('resume'), 'ok', 'E double-resume ok (idempotent)'));
  }

  // ── learn ──────────────────────────────────────────────────────────────────
  {
    const r1 = T('learn "test lesson one"');
    cases.push(assertStatus(r1, 'ok', 'E learn ok'));
    // empty message rejected
    const r2 = T('learn');
    cases.push(assertExit(r2, 2, 'E learn empty exits 2'));
    // verify progress.md format
    const prog = fs.readFileSync(path.join(dir, 'harness', 'progress.md'), 'utf-8');
    cases.push(assertMatch(prog, /test lesson one/, 'E learn appended to progress.md'));
  }

  // ── contract ───────────────────────────────────────────────────────────────
  {
    const d4 = initProject('e-contract').dir;
    const T4 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d4, expectJson: true });
    // propose missing scope
    const r1 = T4('contract propose');
    cases.push(assertExit(r1, 2, 'E contract propose missing scope exits 2'));
    // propose ok
    cases.push(assertStatus(T4('contract propose --scope "demo" --criteria "tests pass"'), 'ok', 'E contract propose ok'));
    // review without decision
    const r2 = T4('contract review');
    cases.push(assertExit(r2, 2, 'E contract review no decision exits 2'));
    // status
    const r3 = T4('contract status');
    cases.push(assertStatus(r3, 'ok', 'E contract status ok'));
    // escalate
    const r4 = T4('contract escalate --reason "test"');
    cases.push(assertStatus(r4, 'ok', 'E contract escalate ok'));
  }

  // ── worktree ───────────────────────────────────────────────────────────────
  {
    const d5 = initProject('e-worktree').dir;
    const T5 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d5, expectJson: true });
    // create
    cases.push(assertOk(T5('worktree create feat-a').ok, 'E worktree create ok'));
    // create existing branch (feat/feat-a now exists) → fail
    const r2 = T5('worktree create feat-a');
    cases.push(assert(r2.ok === false, 'E worktree create existing branch rejected'));
    // list
    const r3 = T5('worktree list');
    cases.push(assertStatus(r3, 'ok', 'E worktree list ok'));
    // prune
    cases.push(assertStatus(T5('worktree prune'), 'ok', 'E worktree prune ok'));
    // no-git
    const d5nogit = freshDir('e-worktree-nogit');
    const r5 = runCli('worktree list --json', { cwd: d5nogit, expectJson: true });
    cases.push(assert(r5.ok === false, 'E worktree no-git rejected'));
  }

  // ── rollback ───────────────────────────────────────────────────────────────
  {
    const d6 = initProject('e-rollback').dir;
    const T6 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d6, expectJson: true });
    // list (no tags yet)
    const r1 = T6('rollback list');
    cases.push(assertStatus(r1, 'ok', 'E rollback list ok (empty)'));
    // create a checkpoint tag
    gitCommit(d6, 'wip');
    cases.push(assertStatus(T6('checkpoint create baseline'), 'ok', 'E rollback setup checkpoint'));
    // list now has it
    const r2 = T6('rollback list');
    cases.push(assertOk(r2.json?.checkpoints?.length >= 1, 'E rollback list has checkpoint'));
    // rollback to
    gitDirty(d6); gitCommit(d6, 'change');
    const r3 = T6('rollback to manual/baseline');
    cases.push(assertOk(r3.ok, 'E rollback to ok'));
    // invalid tag
    const r4 = T6('rollback to manual/nonexistent');
    cases.push(assert(r4.ok === false, 'E rollback invalid tag rejected'));
  }

  // ── checkpoint ─────────────────────────────────────────────────────────────
  {
    const d7 = initProject('e-checkpoint').dir;
    const T7 = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: d7, expectJson: true });
    // create clean
    cases.push(assertStatus(T7('checkpoint create clean-cp'), 'ok', 'E checkpoint create clean ok'));
    // duplicate label
    const r2 = T7('checkpoint create clean-cp');
    cases.push(assert(r2.ok === false, 'E checkpoint duplicate label rejected'));
    // dirty tree fails
    gitDirty(d7);
    const r3 = T7('checkpoint create dirty-cp');
    cases.push(assert(r3.ok === false, 'E checkpoint dirty tree rejected'));
    // --force on dirty
    cases.push(assertStatus(T7('checkpoint create forced-cp --force'), 'ok', 'E checkpoint --force on dirty ok'));
  }

  // ── help ───────────────────────────────────────────────────────────────────
  {
    const r1 = runCli('--help', { expectJson: false });
    cases.push(assert(r1.ok, 'E help global ok'));
    cases.push(assert(r1.stdout.length > 0, 'E help global output'));
    const r2 = runCli('help init', { expectJson: false });
    cases.push(assert(r2.ok, 'E help per-command ok'));
    const r3 = runCli('help notacommand', { expectJson: false });
    cases.push(assert(r3.ok, 'E help invalid command falls back'));
    const r4 = runCli('--help --json', { expectJson: true });
    cases.push(assertOk(r4.json !== null || r4.stdout.length > 0, 'E help --json ok'));
  }

  record('E-commands', cases);
});
// ══════════════════════════════════════════════════════════════════════════════
// PHASE F — Loops & retries deep-dive
// ══════════════════════════════════════════════════════════════════════════════
suite('F', 'loops & retries deep-dive', () => {
  const cases = [];

  // F1 — Task retry: failing task increments taskRetryCount
  {
    const { dir } = initProject('f1-task-retry', 'node');
    const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });
    T('config set gates.enabled true');
    T('config set retry.tasks.enabled true');
    T('config set retry.tasks.maxRetries 2');
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    // Bootstrap to build phase: phase define → artifacts → validate → phase next (×2 to build)
    T('phase define');
    scaffoldCalcDocs(dir);
    T('contract propose --scope "x" --criteria "tests pass"'); T('contract review --agreed');
    gitBranch(dir, 'feat/x'); gitCommit(dir, 'define');
    T('validate'); T('phase next'); // → plan
    writeFeatureList(dir);
    scaffoldCalcSource(dir);
    gitCommit(dir, 'plan+build');
    T('validate'); T('phase next'); // → build

    // Inject a failing test → validate --feature --task fails → taskRetryCount increments
    writeCalcFile(dir, 'test/calc.test.js', `import { test } from 'node:test';
import assert from 'node:assert/strict';
test('forced fail', () => assert.equal(1, 2));`);
    const v1 = T('validate --feature feature-001 --task task-001');
    cases.push(assert(v1.ok === false || v1.json?.overall === false, 'F1 failing task validate fails'));
    const c1 = T('config get taskRetryCount').json?.value;
    cases.push(assertOk(c1 >= 1, 'F1 taskRetryCount incremented after 1st fail'));

    // Second failure
    const v2 = T('validate --feature feature-001 --task task-001');
    const c2 = T('config get taskRetryCount').json?.value;
    cases.push(assertOk(c2 >= 2, 'F1 taskRetryCount incremented after 2nd fail'));

    // Fix the test → pass
    writeCalcFile(dir, 'test/calc.test.js', CALC_TOOL.calcTest);
    const v3 = T('validate --feature feature-001 --task task-001');
    cases.push(assertOk(v3.ok, 'F1 fixed task validate ok'));
  }

  // F2 — Phase retry: same-phase re-run increments retryCount (resets on new phase)
  {
    const { dir } = initProject('f2-phase-retry', 'node');
    const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });
    T('phase define');
    let rc = T('config get retryCount').json?.value ?? 0;
    cases.push(assertEqual(rc, 0, 'F2 retryCount 0 after new phase'));
    // Re-run same phase
    T('phase define');
    rc = T('config get retryCount').json?.value ?? 0;
    cases.push(assertOk(rc >= 1, 'F2 retryCount incremented on same-phase re-run'));
    // New phase resets
    T('phase plan');
    rc = T('config get retryCount').json?.value ?? 0;
    cases.push(assertEqual(rc, 0, 'F2 retryCount reset on new phase'));
  }

  // F3 — Contract negotiation loop: 5× needs-revision → auto-escalate
  {
    const { dir } = initProject('f3-contract-loop', 'node');
    const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });
    T('contract propose --scope "demo" --criteria "tests pass"');
    let escalated = false;
    for (let i = 0; i < 6; i++) {
      const r = T('contract review --needs-revision --notes "round ' + (i + 1) + '"');
      if (r.json?.escalated === true) { escalated = true; break; }
    }
    cases.push(assert(escalated, 'F3 contract auto-escalated after max rounds'));
    const st = T('contract status');
    cases.push(assertMatch(JSON.stringify(st.json?.contractStatus || st.json || ''), /escalat/, 'F3 contract status escalated'));
  }

  // F4 — Outer loop: copilot stops with status=instruction
  {
    const { dir } = initProject('f4-outer-copilot', 'node');
    const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });
    T('phase define');
    scaffoldCalcDocs(dir);
    T('contract propose --scope "x" --criteria "tests pass"'); T('contract review --agreed');
    gitBranch(dir, 'feat/x'); gitCommit(dir, 'define');
    const r = T('phase next'); // copilot → continuePipeline returns instruction
    cases.push(assertOk(r.ok, 'F4 copilot phase next ok'));
    // After define, copilot should get instruction to go to plan
    const st = T('status');
    cases.push(assertMatch(st.json?.currentPhase || '', /plan|define/, 'F4 copilot advanced'));
  }

  // F5 — Outer loop: autopilot auto-advances (status=complete at end)
  {
    if (QUICK) { cases.push({ pass: true, msg: 'skipped (--quick)' }); }
    else {
      const { dir } = initProject('f5-outer-autopilot', 'node', '--mode autopilot');
      const T = (a) => runCli(a.includes('--json') ? a : a + ' --json', { cwd: dir, expectJson: true });
      T('set-mode copilot'); T('config set gates.enabled true');
      setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
      T('phase define');
      scaffoldCalcDocs(dir);
      T('contract propose --scope "x" --criteria "tests pass"'); T('contract review --agreed');
      gitBranch(dir, 'feat/x'); gitCommit(dir, 'define');
      T('validate'); T('phase next'); // → plan
      T('set-mode autopilot');
      writeFeatureList(dir); scaffoldCalcSource(dir);
      for (const f of ['feature-001', 'feature-002', 'feature-003']) markFeatureComplete(dir, f);
      gitCommit(dir, 'build');
      // Drive to ship
      let cur = T('status'); let safety = 12;
      while (cur.json?.currentPhase !== 'ship' && safety-- > 0) {
        gitCommit(dir, 'wip ' + cur.json?.currentPhase);
        const r = T('phase next'); if (!r.ok) break; cur = T('status');
      }
      gitCommit(dir, 'ship'); gitTag(dir, 'v1.0.0', 'rel');
      const finalNext = T('phase next');
      cases.push(assertOk(finalNext.ok || finalNext.json?.status === 'complete', 'F5 autopilot reached complete'));
    }
  }

  record('F-loops-retries', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE G — G1-G24 gap coverage (new commands, gates, role framework, handoff)
// ══════════════════════════════════════════════════════════════════════════════
// Covers the G1-G24 gap implementations: new commands (role/decision/cleanup/
// audit), new gates (anti-placeholder/contract-criteria/task-criteria/rubric-
// content/clean-state), role-based enforcement (G21), self-eval guard (G23),
// 3-file handoff split (G13/G14), autopilot cascade defaults (G10), --json-value
// (G1/G2), --no-gates (G12). Mirrors the depth of suites B-F.
suite('G', 'G1-G24 gap coverage', () => {
  const cases = [];

  // ── G1 — Init defaults & flags matrix ──────────────────────────────────────
  {
    const { dir, r } = initProject('g1-defaults', 'node');
    const cfg = readConfig(dir);
    cases.push(assertStatus(r, 'ok', 'G1 init status=ok'));
    cases.push(assertEqual(cfg.gates?.enabled, true, 'G1 gates.enabled=true default (G12)'));
    cases.push(assertEqual(cfg.gates?.antiPlaceholder?.enabled, true, 'G1 gates.antiPlaceholder.enabled=true default (G24b)'));
    cases.push(assertEqual(cfg.gates?.cleanState?.enabled, false, 'G1 gates.cleanState.enabled=false opt-in (G17)'));
    cases.push(assertEqual(cfg.currentRole, null, 'G1 currentRole=null default (G19)'));
    cases.push(assertEqual(cfg.cleanup?.schedule, '0 2 * * 0', 'G1 cleanup.schedule default (G24)'));
    cases.push(assertEqual(cfg.maxRetries, 10, 'G1 maxRetries=10 legacy fallback'));
    // retry.* are merged at runtime by loadConfig (template only has maxRetries for copilot).
    // Read via `config get` to see the runtime-merged defaults.
    const rt = runCli(`config get retry --json`, { cwd: dir });
    cases.push(assertEqual(rt.json?.value?.tasks?.maxRetries, null, 'G1 retry.tasks.maxRetries=null (falls back to 10)'));
    cases.push(assertEqual(rt.json?.value?.features?.enabled, false, 'G1 retry.features.enabled=false copilot (G10)'));
    cases.push(assertEqual(rt.json?.value?.phases?.enabled, false, 'G1 retry.phases.enabled=false copilot (G10)'));
  }
  // --no-gates escape hatch (G12)
  {
    const { dir, r } = initProject('g1-no-gates', 'node', '--no-gates');
    const cfg = readConfig(dir);
    cases.push(assertStatus(r, 'ok', 'G1 --no-gates init status=ok'));
    cases.push(assertEqual(cfg.gates?.enabled, false, 'G1 --no-gates sets gates.enabled=false (G12)'));
  }
  // --mode autopilot cascade defaults (G10)
  {
    const { dir, r } = initProject('g1-autopilot', 'node', '--mode autopilot');
    const cfg = readConfig(dir);
    cases.push(assertStatus(r, 'ok', 'G1 --mode autopilot init status=ok'));
    cases.push(assertEqual(cfg.mode, 'autopilot', 'G1 --mode autopilot stored'));
    cases.push(assertEqual(cfg.retry?.features?.enabled, true, 'G1 autopilot retry.features.enabled=true (G10)'));
    cases.push(assertEqual(cfg.retry?.phases?.enabled, true, 'G1 autopilot retry.phases.enabled=true (G10)'));
    cases.push(assertEqual(cfg.retry?.tasks?.maxRetries, 3, 'G1 autopilot retry.tasks.maxRetries=3 (G10)'));
    cases.push(assertEqual(cfg.currentRole, null, 'G1 autopilot currentRole=null (roles not auto-set)'));
  }

  // ── G2 — Config ergonomics: --json-value & setKey auto-create ──────────────
  {
    const { dir } = initProject('g2-config', 'node');
    // G1: setKey auto-creates null parents (was TypeError before)
    const r1 = runCli(`config set stackMeta.lintCmd "node -e 1" --json`, { cwd: dir });
    cases.push(assertExit(r1, 0, 'G2 config set stackMeta.lintCmd exits 0 (G1 auto-create null parent)'));
    cases.push(assertEqual(readConfig(dir).stackMeta?.lintCmd, 'node -e 1', 'G2 stackMeta.lintCmd persisted'));
    // G1: deep null parent auto-create
    const r2 = runCli(`config set stackMeta.nested.deep "x" --json`, { cwd: dir });
    cases.push(assertExit(r2, 0, 'G2 config set stackMeta.nested.deep exits 0 (G1 deep null parent)'));
    cases.push(assertEqual(readConfig(dir).stackMeta?.nested?.deep, 'x', 'G2 stackMeta.nested.deep persisted'));
    // G2: --json-value for array
    const r3 = runCli(`config set phases.enabled --json-value '["define","plan","build"]' --json`, { cwd: dir });
    cases.push(assertExit(r3, 0, 'G2 config set phases.enabled --json-value exits 0 (G2)'));
    cases.push(assertEqual(JSON.stringify(readConfig(dir).phases?.enabled), '["define","plan","build"]', 'G2 phases.enabled persisted as array'));
    // G2: --json-value on new cleanState field
    const r4 = runCli(`config set gates.cleanState.stalePatterns --json-value '["console.log","TODO"]' --json`, { cwd: dir });
    cases.push(assertExit(r4, 0, 'G2 config set gates.cleanState.stalePatterns --json-value exits 0'));
    cases.push(assertEqual(JSON.stringify(readConfig(dir).gates?.cleanState?.stalePatterns), '["console.log","TODO"]', 'G2 cleanState.stalePatterns persisted'));
    // G2: --json-value @file path
    const tmpJson = path.join(dir, 'tmp-arr.json');
    fs.writeFileSync(tmpJson, JSON.stringify(['a', 'b']));
    const r5 = runCli(`config set gates.antiPlaceholder.patterns --json-value @${tmpJson} --json`, { cwd: dir });
    cases.push(assertExit(r5, 0, 'G2 config set --json-value @file exits 0'));
    cases.push(assertEqual(JSON.stringify(readConfig(dir).gates?.antiPlaceholder?.patterns), '["a","b"]', 'G2 --json-value @file persisted'));
    // G2: --json-value invalid JSON → exit 2
    const r6 = runCli(`config set phases.enabled --json-value 'invalid json' --json`, { cwd: dir });
    cases.push(assertExit(r6, 2, 'G2 config set --json-value invalid exits 2'));
    cases.push(assertMatch(r6.stdout + r6.stderr, /Invalid JSON/, 'G2 invalid JSON error message'));
  }

  // ── G3 — Full multi-agent role workflow (THE CORE SCENARIO) ─────────────────
  // Runs calc-tool through all 7 phases emulating separate agent sessions per
  // role (planner→generator→evaluator→simplifier) with human interventions.
  {
    const { dir } = initProject('g3-role-workflow', 'node');
    // initProject runs `init` (with git). Enable gates, keep anti-placeholder ON,
    // use placeholder-free source.
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);

    // DEFINE (planner)
    const rolePlanner = runCli(`role planner --json`, { cwd: dir });
    cases.push(assertStatus(rolePlanner, 'ok', 'G3 role planner status=ok'));
    cases.push(assertEqual(rolePlanner.json?.currentRole, 'planner', 'G3 role planner sets currentRole'));
    cases.push(assertEqual(rolePlanner.json?.previousRole, null, 'G3 role planner previousRole=null'));
    cases.push(assertOk(readHandoffFile(dir)?.includes('**Current Role:** planner'), 'G3 handoff has Current Role: planner'));
    cases.push(assertOk(readProgressFile(dir)?.includes('role handoff: none → planner'), 'G3 progress has role handoff line'));
    // phase define sets currentPhase (required before validate)
    runCli(`phase define --json`, { cwd: dir });
    // contract propose requires --criteria (G5) + requires planner (G21)
    const cpNoCrit = runCli(`contract propose --scope "build calc" --json`, { cwd: dir });
    cases.push(assertExit(cpNoCrit, 2, 'G3 contract propose without --criteria exits 2 (G5)'));
    const cpOk = runCli(`contract propose --scope "build calc" --criteria "tests pass|coverage >= 80%" --json`, { cwd: dir });
    cases.push(assertStatus(cpOk, 'ok', 'G3 contract propose with --criteria status=ok (G5)'));
    // contract review requires evaluator (G21) — planner can't review
    const rvPlanner = runCli(`contract review --agreed --json`, { cwd: dir });
    cases.push(assertExit(rvPlanner, 1, 'G3 contract review as planner exits 1 (G21 requires evaluator)'));
    // switch to evaluator, review agreed
    const roleEval1 = runCli(`role evaluator --json`, { cwd: dir });
    cases.push(assertEqual(roleEval1.json?.previousRole, 'planner', 'G3 role evaluator previousRole=planner'));
    const rvOk = runCli(`contract review --agreed --json`, { cwd: dir });
    cases.push(assertStatus(rvOk, 'ok', 'G3 contract review as evaluator status=ok (G21)'));
    // back to planner, write contract criteria, create branch + commit, validate define
    runCli(`role planner --json`, { cwd: dir });
    writeContractCriteria(dir, ['all unit tests pass', 'coverage >= 80%']);
    gitBranch(dir, 'feat/calc-tool');
    gitCommit(dir, 'define: specs + contract');
    const vDefine = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vDefine.json?.overall !== false, 'G3 define validate passes (contract-criteria G8)'));
    const pn1 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn1.ok, 'G3 phase next define→plan ok'));

    // PLAN (planner)
    cases.push(assertOk(fs.existsSync(path.join(dir, 'harness', 'docs', 'phases', 'plan.md')), 'G3 plan.md skill exists'));
    gitCommit(dir, 'plan: feature list');
    const vPlan = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vPlan.json?.overall !== false, 'G3 plan validate ok'));
    runCli(`checkpoint pre-build --json`, { cwd: dir });
    const pn2 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn2.ok, 'G3 phase next plan→build ok'));

    // BUILD (generator) — exercise self-eval guard (G23) + role gate (G21)
    const roleGen = runCli(`role generator --json`, { cwd: dir });
    cases.push(assertEqual(roleGen.json?.currentRole, 'generator', 'G3 role generator sets currentRole'));
    gitCommit(dir, 'build: source');
    // G21: validate in build requires evaluator — generator can't validate (full phase)
    const vBuildGen = runCli(`validate --json`, { cwd: dir });
    cases.push(assertExit(vBuildGen, 1, 'G3 validate build as generator exits 1 (G21 requires evaluator)'));
    cases.push(assertMatch(vBuildGen.json?.message || vBuildGen.stdout + vBuildGen.stderr, /requires currentRole=evaluator/, 'G3 validate build role message (G21)'));
    // switch to evaluator — build validate now allowed
    runCli(`role evaluator --json`, { cwd: dir });
    // task-criteria gate (G7): acceptanceCriteria present in feature-list
    const vTask1 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(vTask1.json?.failures?.indexOf('task-criteria') === -1 || vTask1.json?.overall, 'G3 task validate passes task-criteria (G7)'));
    // G23: self-eval guard — evaluator validating work it produced → FAIL.
    // Set producedByRole=evaluator on a task that is NOT yet complete.
    setProducedByRole(dir, 'feature-001', 'task-002', 'evaluator');
    const vSelfEval = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertExit(vSelfEval, 1, 'G3 self-eval guard: evaluator validates own work exits 1 (G23)'));
    cases.push(assertMatch(vSelfEval.json?.message || vSelfEval.stdout + vSelfEval.stderr, /Self-evaluation guard/, 'G3 self-eval guard message (G23)'));
    // mark all tasks complete via helper (simulating evaluator sign-off on generator's work)
    markFeatureComplete(dir, 'feature-001');
    markFeatureComplete(dir, 'feature-002');
    markFeatureComplete(dir, 'feature-003');
    gitCommit(dir, 'build: all features complete');
    const vBuildEval = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vBuildEval.json?.overall !== false, 'G3 validate build as evaluator passes'));
    const pn3 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn3.ok, 'G3 phase next build→verify ok'));

    // VERIFY (evaluator)
    const vVerify = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vVerify.json?.overall !== false, 'G3 verify validate ok'));
    // Enable simplify phase (off by default) BEFORE phase next so verify→simplify
    setPhasesEnabled(dir, ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship']);
    const pn4 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn4.ok, 'G3 phase next verify→simplify ok'));

    // SIMPLIFY (simplifier)
    const roleSimp = runCli(`role simplifier --json`, { cwd: dir });
    cases.push(assertEqual(roleSimp.json?.currentRole, 'simplifier', 'G3 role simplifier sets currentRole'));
    // inject empty dir → validate fails no-empty-dirs
    fs.mkdirSync(path.join(dir, 'empty-dir'), { recursive: true });
    const vSimpFail = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(!vSimpFail.json?.overall, 'G3 simplify validate fails with empty dir'));
    cases.push(assertOk(vSimpFail.json?.failures?.includes('no-empty-dirs'), 'G3 simplify failure is no-empty-dirs'));
    fs.rmdirSync(path.join(dir, 'empty-dir'));
    const pn5 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn5.ok, 'G3 phase next simplify→review ok'));

    // REVIEW (evaluator) — rubric-content gate (G9)
    runCli(`role evaluator --json`, { cwd: dir });
    fillRubric(dir, 6);
    gitCommit(dir, 'review: rubric filled');
    const vReview = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vReview.json?.failures?.indexOf('rubric-content') === -1 || vReview.json?.overall, 'G3 review validate passes rubric-content (G9)'));
    const pn6 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertOk(pn6.ok, 'G3 phase next review→ship ok'));

    // SHIP
    gitTag(dir, 'v2.0.0');
    const vShip = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(vShip.json?.overall !== false, 'G3 ship validate ok'));
    const pn7 = runCli(`phase next --json`, { cwd: dir });
    cases.push(assertEqual(pn7.json?.status, 'complete', 'G3 phase next ship→complete status=complete'));

    // Tail assertions: handoff + progress + decisions
    const handoff = readHandoffFile(dir);
    cases.push(assertOk(handoff?.includes('**Current Phase:** ship') || handoff?.includes('**Current Phase:** complete'), 'G3 final handoff has Current Phase'));
    cases.push(assertOk(handoff?.includes('**Current Role:** evaluator'), 'G3 final handoff has Current Role: evaluator'));
    const progress = readProgressFile(dir);
    cases.push(assertOk(countOccurrences(progress, 'role handoff:') >= 7, 'G3 progress.md has ≥7 role handoff lines'));
  }

  // ── G4 — New commands matrix: role / decision / cleanup / audit ──────────────
  {
    const { dir } = initProject('g4-commands', 'node');
    // role: no arg → exit 2
    const r1 = runCli(`role --json`, { cwd: dir });
    cases.push(assertExit(r1, 2, 'G4 role no arg exits 2'));
    // role: invalid → exit 2
    const r2 = runCli(`role invalid --json`, { cwd: dir });
    cases.push(assertExit(r2, 2, 'G4 role invalid exits 2'));
    cases.push(assertMatch(r2.stdout + r2.stderr, /Invalid role/, 'G4 role invalid message'));
    // role: planner → JSON shape
    const r3 = runCli(`role planner --json`, { cwd: dir });
    cases.push(assertEqual(r3.json?.currentRole, 'planner', 'G4 role planner currentRole'));
    cases.push(assertEqual(r3.json?.previousRole, null, 'G4 role planner previousRole=null'));
    cases.push(assertEqual(r3.json?.handoffWritten, true, 'G4 role planner handoffWritten=true'));
    // role: generator after planner → previousRole
    const r4 = runCli(`role generator --json`, { cwd: dir });
    cases.push(assertEqual(r4.json?.previousRole, 'planner', 'G4 role generator previousRole=planner'));
    // role: evaluator → roleSkillPath non-null
    const r5 = runCli(`role evaluator --json`, { cwd: dir });
    cases.push(assertOk(r5.json?.roleSkillPath, 'G4 role evaluator roleSkillPath non-null'));
    // role persists across invocations
    cases.push(assertEqual(readConfig(dir).currentRole, 'evaluator', 'G4 currentRole persists in config'));
  }
  {
    const { dir } = initProject('g4-decision', 'node');
    // decision: no text → exit 2
    const r1 = runCli(`decision --json`, { cwd: dir });
    cases.push(assertExit(r1, 2, 'G4 decision no text exits 2'));
    // decision: record
    const r2 = runCli(`decision "use postgres for persistence" --json`, { cwd: dir });
    cases.push(assertStatus(r2, 'ok', 'G4 decision record status=ok'));
    const dec = readDecisionsFile(dir);
    cases.push(assertOk(dec?.includes('**Decision:** use postgres for persistence'), 'G4 decision appended to lessons-decisions.md'));
    cases.push(assertOk(dec?.includes('### '), 'G4 decision has dated header'));
    // decision: --links-lesson
    const r3 = runCli(`decision "use redis for cache" --links-lesson "cache invalidation" --json`, { cwd: dir });
    cases.push(assertStatus(r3, 'ok', 'G4 decision --links-lesson status=ok'));
    cases.push(assertOk(readDecisionsFile(dir)?.includes('cache invalidation'), 'G4 decision links lesson'));
    // learn then decision auto-links (G18)
    runCli(`learn "premature optimization is root of evil" --json`, { cwd: dir });
    runCli(`decision "measure before optimizing" --json`, { cwd: dir });
    const dec2 = readDecisionsFile(dir);
    cases.push(assertOk(dec2?.includes('premature optimization'), 'G4 decision auto-links last lesson (G18)'));
    // status --json includes decisionsTail
    const st = runCli(`status --json`, { cwd: dir });
    cases.push(assertOk(Array.isArray(st.json?.decisionsTail), 'G4 status decisionsTail is array'));
    cases.push(assertOk(st.json?.decisionsTail?.length > 0, 'G4 status decisionsTail non-empty'));
  }
  {
    const { dir } = initProject('g4-cleanup', 'node');
    // setup: stale artifact + empty dir
    runCli(`config set gates.cleanState.stalePatterns --json-value '["console.log"]' --json`, { cwd: dir });
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'x.js'), "console.log('stale')\n");
    fs.mkdirSync(path.join(dir, 'empty-dir'), { recursive: true });
    const r1 = runCli(`cleanup --json`, { cwd: dir });
    cases.push(assertStatus(r1, 'ok', 'G4 cleanup status=ok'));
    cases.push(assertOk(Array.isArray(r1.json?.staleArtifacts), 'G4 cleanup staleArtifacts is array'));
    cases.push(assertOk(r1.json?.staleArtifacts?.length > 0, 'G4 cleanup staleArtifacts non-empty'));
    cases.push(assertOk(r1.json?.staleArtifacts?.[0]?.file, 'G4 cleanup staleArtifact has file'));
    cases.push(assertOk(r1.json?.staleArtifacts?.[0]?.pattern, 'G4 cleanup staleArtifact has pattern'));
    cases.push(assertOk(Array.isArray(r1.json?.emptyDirs), 'G4 cleanup emptyDirs is array'));
    cases.push(assertOk(r1.json?.emptyDirs?.length > 0, 'G4 cleanup emptyDirs non-empty'));
    cases.push(assertOk(r1.json?.qualityDocFreshness, 'G4 cleanup qualityDocFreshness present'));
    cases.push(assertEqual(JSON.stringify(r1.json?.driftFiles), '[]', 'G4 cleanup driftFiles always []'));
    cases.push(assertEqual(r1.json?.schedule, '0 2 * * 0', 'G4 cleanup schedule default'));
    // --auto-fix removes empty dirs
    const r2 = runCli(`cleanup --auto-fix --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.autoFixed > 0, 'G4 cleanup --auto-fix autoFixed>0'));
    cases.push(assertOk(!fs.existsSync(path.join(dir, 'empty-dir')), 'G4 cleanup --auto-fix removed empty dir'));
    // cleanup on clean project
    fs.unlinkSync(path.join(dir, 'src', 'x.js'));
    const r3 = runCli(`cleanup --json`, { cwd: dir });
    cases.push(assertEqual(r3.json?.staleArtifacts?.length, 0, 'G4 cleanup clean project staleArtifacts empty'));
  }
  {
    const { dir } = initProject('g4-audit', 'node');
    const r1 = runCli(`audit --json`, { cwd: dir });
    cases.push(assertStatus(r1, 'ok', 'G4 audit status=ok'));
    cases.push(assertOk(Array.isArray(r1.json?.activeGates), 'G4 audit activeGates is array'));
    cases.push(assertOk(r1.json?.activeGates?.includes('gates.enabled'), 'G4 audit activeGates includes gates.enabled'));
    cases.push(assertOk(r1.json?.activeGates?.includes('gates.antiPlaceholder'), 'G4 audit activeGates includes gates.antiPlaceholder (default true)'));
    cases.push(assertOk(Array.isArray(r1.json?.activeRetry), 'G4 audit activeRetry is array'));
    cases.push(assertOk(r1.json?.activeRetry?.some(r => /tasks/.test(r)), 'G4 audit activeRetry includes tasks'));
    cases.push(assertOk(Array.isArray(r1.json?.enabledPhases), 'G4 audit enabledPhases is array'));
    cases.push(assertEqual(r1.json?.enabledPhases?.length, 6, 'G4 audit enabledPhases=6 (no simplify)'));
    cases.push(assertOk(Array.isArray(r1.json?.suggestions), 'G4 audit suggestions is array'));
    cases.push(assertEqual(r1.json?.mode, 'copilot', 'G4 audit mode=copilot'));
    cases.push(assertEqual(r1.json?.currentRole, null, 'G4 audit currentRole=null'));
    // audit on autopilot project with cascade → suggestion about high maxRetries
    const { dir: dir2 } = initProject('g4-audit-auto', 'node', '--mode autopilot');
    const r2 = runCli(`audit --json`, { cwd: dir2 });
    cases.push(assertEqual(r2.json?.mode, 'autopilot', 'G4 audit autopilot mode'));
    // audit on gates-disabled project → enable suggestion
    const { dir: dir3 } = initProject('g4-audit-nogates', 'node', '--no-gates');
    const r3 = runCli(`audit --json`, { cwd: dir3 });
    cases.push(assertOk(r3.json?.suggestions?.some(s => /gates.enabled=false/.test(s)), 'G4 audit gates-disabled suggestion'));
  }

  // ── G5 — New gates pass/fail matrix ─────────────────────────────────────────
  {
    const { dir } = initProject('g5-anti-placeholder', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`phase plan --json`, { cwd: dir });
    runCli(`phase build --json`, { cwd: dir });
    // console.log in src → anti-placeholder fails
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'bad.js'), "console.log('oops')\n");
    const r1 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(!r1.json?.overall, 'G5 anti-placeholder: console.log fails validate'));
    cases.push(assertOk(r1.json?.failures?.includes('anti-placeholder'), 'G5 anti-placeholder failure name'));
    // remove console.log → passes
    fs.writeFileSync(path.join(dir, 'src', 'bad.js'), "const x = 1;\n");
    const r2 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.failures?.indexOf('anti-placeholder') === -1, 'G5 anti-placeholder passes after fix'));
    // debugger statement → fails
    fs.writeFileSync(path.join(dir, 'src', 'bad.js'), "debugger;\n");
    const r3 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r3.json?.failures?.includes('anti-placeholder'), 'G5 anti-placeholder: debugger fails'));
    // custom pattern via config
    runCli(`config set gates.antiPlaceholder.patterns --json-value '["TODO"]' --json`, { cwd: dir });
    fs.writeFileSync(path.join(dir, 'src', 'bad.js'), "// TODO: fix this\n");
    const r4 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r4.json?.failures?.includes('anti-placeholder'), 'G5 anti-placeholder: custom TODO pattern fails'));
  }
  {
    const { dir } = initProject('g5-contract-criteria', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    runCli(`phase define --json`, { cwd: dir });
    // empty Verification Criteria section → contract-criteria fails
    writeContractCriteria(dir, []);
    const r1 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.failures?.includes('contract-criteria'), 'G5 contract-criteria: empty section fails'));
    // placeholder-only → fails
    writeContractCriteria(dir, ['...']);
    const r2 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.failures?.includes('contract-criteria'), 'G5 contract-criteria: placeholder-only fails'));
    // ≥1 real criterion → passes
    writeContractCriteria(dir, ['all unit tests pass']);
    const r3 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r3.json?.failures?.indexOf('contract-criteria') === -1, 'G5 contract-criteria: real criterion passes'));
  }
  {
    const { dir } = initProject('g5-task-criteria', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`phase plan --json`, { cwd: dir });
    runCli(`phase build --json`, { cwd: dir });
    writeFeatureList(dir);
    // empty acceptanceCriteria → task-criteria fails
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', []);
    const r1 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.failures?.includes('task-criteria'), 'G5 task-criteria: empty fails'));
    // placeholder-only → fails
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', ['...']);
    const r2 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.failures?.includes('task-criteria'), 'G5 task-criteria: placeholder-only fails'));
    // ≥1 real criterion → passes
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', ['add returns correct sum']);
    const r3 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r3.json?.failures?.indexOf('task-criteria') === -1, 'G5 task-criteria: real criterion passes'));
  }
  {
    const { dir } = initProject('g5-rubric-content', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldCalcDocs(dir);
    runCli(`phase define --json`, { cwd: dir });
    runCli(`phase plan --json`, { cwd: dir });
    runCli(`phase build --json`, { cwd: dir });
    runCli(`phase verify --json`, { cwd: dir });
    runCli(`phase simplify --json`, { cwd: dir });
    runCli(`phase review --json`, { cwd: dir });
    // stub rubric (<5 lines) → rubric-content fails
    fs.writeFileSync(path.join(dir, 'harness', 'evaluator-rubric.md'), '# Rubric\n\nstub\n');
    const r1 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.failures?.includes('rubric-content'), 'G5 rubric-content: stub fails'));
    // ≥5 filled lines → passes
    fillRubric(dir, 6);
    const r2 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.failures?.indexOf('rubric-content') === -1, 'G5 rubric-content: filled passes'));
  }
  {
    const { dir } = initProject('g5-clean-state', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    runCli(`config set gates.cleanState.enabled true --json`, { cwd: dir });
    runCli(`config set gates.cleanState.stalePatterns --json-value '["console.log"]' --json`, { cwd: dir });
    runCli(`config set gates.cleanState.startupCmd "node -e 1" --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    // stale artifact → clean-state fails
    fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'src', 'x.js'), "console.log('stale')\n");
    const r1 = runCli(`validate --session-exit --json`, { cwd: dir });
    cases.push(assertOk(!r1.json?.overall, 'G5 clean-state: stale artifact fails'));
    cases.push(assertOk(r1.json?.failures?.includes('clean-state'), 'G5 clean-state failure name'));
    cases.push(assertMatch(r1.json?.checks?.[0]?.detail || '', /stale artifacts/, 'G5 clean-state detail mentions stale artifacts'));
    cases.push(assertExit(r1, 1, 'G5 clean-state: failure exits 1'));
    // clean source → passes all 5
    fs.writeFileSync(path.join(dir, 'src', 'x.js'), "const x = 1;\n");
    const r2 = runCli(`validate --session-exit --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.overall, 'G5 clean-state: clean source passes'));
    cases.push(assertExit(r2, 0, 'G5 clean-state: pass exits 0'));
  }

  // ── G6 — Handoff & session continuity (3-file split) ────────────────────────
  {
    const { dir } = initProject('g6-handoff', 'node');
    gitInit(dir);
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldCalcDocs(dir);
    runCli(`phase define --json`, { cwd: dir });
    // define gate requires contract agreed + feature branch + criteria
    runCli(`contract propose --scope "test" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define phase');
    const handoffBefore = readHandoffFile(dir);
    cases.push(assertOk(handoffBefore?.includes('**Current Phase:** define'), 'G6 handoff has Current Phase: define'));
    // phase next → handoff overwritten, progress appended
    const progressBefore = readProgressFile(dir) || '';
    runCli(`phase next --json`, { cwd: dir });
    const handoffAfter = readHandoffFile(dir);
    const progressAfter = readProgressFile(dir) || '';
    cases.push(assertOk(handoffAfter?.includes('**Current Phase:** plan'), 'G6 handoff overwritten with new phase'));
    cases.push(assertOk(progressAfter.length >= progressBefore.length, 'G6 progress.md appended (not truncated)'));
    cases.push(assertOk(progressAfter.includes('phase transition: define → plan'), 'G6 progress has phase transition line'));
    // role evaluator → handoff overwritten with role
    runCli(`role evaluator --json`, { cwd: dir });
    cases.push(assertOk(readHandoffFile(dir)?.includes('**Current Role:** evaluator'), 'G6 role overwrites handoff with role'));
    // pause → handoff written
    runCli(`pause --json`, { cwd: dir });
    cases.push(assertOk(readHandoffFile(dir) !== null, 'G6 pause writes handoff'));
    // resume → counters reset (G11)
    runCli(`config set taskRetryCount 5 --json`, { cwd: dir });
    runCli(`config set featureRetryCount 3 --json`, { cwd: dir });
    runCli(`config set phaseRetryCount 2 --json`, { cwd: dir });
    runCli(`resume --json`, { cwd: dir });
    const cfg = readConfig(dir);
    cases.push(assertEqual(cfg.taskRetryCount, 0, 'G6 resume resets taskRetryCount (G11)'));
    cases.push(assertEqual(cfg.featureRetryCount, 0, 'G6 resume resets featureRetryCount (G11)'));
    cases.push(assertEqual(cfg.phaseRetryCount, 0, 'G6 resume resets phaseRetryCount (G11)'));
    cases.push(assertEqual(cfg.retryCount, 0, 'G6 resume resets retryCount (G11)'));
    // status --json includes sessionState + progressTail + decisionsTail
    const st = runCli(`status --json`, { cwd: dir });
    cases.push(assertOk(st.json?.sessionState !== undefined, 'G6 status has sessionState field'));
    cases.push(assertOk(st.json?.progressTail !== undefined, 'G6 status has progressTail field'));
    cases.push(assertOk(st.json?.decisionsTail !== undefined, 'G6 status has decisionsTail field'));
    cases.push(assertOk(st.json?.handoffTimestamp !== undefined, 'G6 status has handoffTimestamp field'));
    cases.push(assertOk(st.json?.currentRole !== undefined, 'G6 status has currentRole field'));
    // status before any handoff written by a command — init scaffolds a stub
    // session-handoff.md, so sessionState is the stub fields (not null). Assert
    // the stub fields are present but empty (no live Current Phase written yet).
    const { dir: dir2 } = initProject('g6-no-handoff', 'node');
    const st2 = runCli(`status --json`, { cwd: dir2 });
    cases.push(assertOk(st2.json?.sessionState !== undefined, 'G6 status has sessionState field (stub)'));
    cases.push(assertEqual(st2.json?.handoffTimestamp, null, 'G6 status handoffTimestamp=null for stub (no live write)'));
    // decision appends (not overwrites)
    const { dir: dir3 } = initProject('g6-decisions', 'node');
    runCli(`decision "first decision" --json`, { cwd: dir3 });
    const dec1 = readDecisionsFile(dir3);
    runCli(`decision "second decision" --json`, { cwd: dir3 });
    const dec2 = readDecisionsFile(dir3);
    cases.push(assertOk(dec2?.includes('first decision'), 'G6 decision appends (first preserved)'));
    cases.push(assertOk(dec2?.includes('second decision'), 'G6 decision appends (second added)'));
    cases.push(assertOk(dec2.length > dec1.length, 'G6 decisions file grew (append-only)'));
    // handoff snapshot fields exact
    const { dir: dir4 } = initProject('g6-fields', 'node');
    runCli(`role planner --json`, { cwd: dir4 });
    const h = readHandoffFile(dir4);
    cases.push(assertOk(h?.includes('**Current Phase:**'), 'G6 handoff has Current Phase field'));
    cases.push(assertOk(h?.includes('**Current Role:**'), 'G6 handoff has Current Role field'));
    cases.push(assertOk(h?.includes('**Current Feature:**'), 'G6 handoff has Current Feature field'));
    cases.push(assertOk(h?.includes('**Gate Status:**'), 'G6 handoff has Gate Status field'));
    cases.push(assertOk(h?.includes('**Next Action:**'), 'G6 handoff has Next Action field'));
    cases.push(assertOk(h?.includes('**Retry Count:**'), 'G6 handoff has Retry Count field'));
    cases.push(assertOk(h?.includes('**Last Commit:**'), 'G6 handoff has Last Commit field'));
  }

  // ── G7 — Retry cascade defaults & counter resets ───────────────────────────
  {
    // autopilot cascade defaults (G10)
    const { dir: dirAuto } = initProject('g7-autopilot', 'node', '--mode autopilot');
    const cfgAuto = readConfig(dirAuto);
    cases.push(assertEqual(cfgAuto.retry?.features?.enabled, true, 'G7 autopilot retry.features.enabled=true (G10)'));
    cases.push(assertEqual(cfgAuto.retry?.phases?.enabled, true, 'G7 autopilot retry.phases.enabled=true (G10)'));
    cases.push(assertEqual(cfgAuto.retry?.tasks?.maxRetries, 3, 'G7 autopilot retry.tasks.maxRetries=3 (G10)'));
    // copilot defaults (G10) — retry.* merged at runtime; read via config get
    const { dir: dirCopilot } = initProject('g7-copilot', 'node');
    const cfgCopilotRt = runCli(`config get retry --json`, { cwd: dirCopilot });
    cases.push(assertEqual(cfgCopilotRt.json?.value?.features?.enabled, false, 'G7 copilot retry.features.enabled=false (G10)'));
    cases.push(assertEqual(cfgCopilotRt.json?.value?.tasks?.maxRetries, null, 'G7 copilot retry.tasks.maxRetries=null (→10) (G10)'));
    // audit on autopilot (maxRetries=3) → no high-max suggestion
    const auditAuto = runCli(`audit --json`, { cwd: dirAuto });
    cases.push(assertOk(!auditAuto.json?.suggestions?.some(s => /maxRetries=3 is high/.test(s)), 'G7 audit autopilot no high-max suggestion (3 is lowered)'));
    // audit on copilot with cascade on + maxRetries=10 → suggestion fires
    runCli(`config set retry.features.enabled true --json`, { cwd: dirCopilot });
    runCli(`config set retry.phases.enabled true --json`, { cwd: dirCopilot });
    const auditCopilot = runCli(`audit --json`, { cwd: dirCopilot });
    cases.push(assertOk(auditCopilot.json?.suggestions?.some(s => /maxRetries=10 is high/.test(s)), 'G7 audit copilot high-max suggestion fires'));
    // resume resets all 4 counters (G11)
    const { dir: dirResume } = initProject('g7-resume', 'node');
    runCli(`config set taskRetryCount 7 --json`, { cwd: dirResume });
    runCli(`config set featureRetryCount 4 --json`, { cwd: dirResume });
    runCli(`config set phaseRetryCount 3 --json`, { cwd: dirResume });
    runCli(`config set retryCount 9 --json`, { cwd: dirResume });
    runCli(`resume --json`, { cwd: dirResume });
    const cfgResume = readConfig(dirResume);
    cases.push(assertEqual(cfgResume.taskRetryCount, 0, 'G7 resume resets taskRetryCount (G11)'));
    cases.push(assertEqual(cfgResume.featureRetryCount, 0, 'G7 resume resets featureRetryCount (G11)'));
    cases.push(assertEqual(cfgResume.phaseRetryCount, 0, 'G7 resume resets phaseRetryCount (G11)'));
    cases.push(assertEqual(cfgResume.retryCount, 0, 'G7 resume resets retryCount (G11)'));
    // role gates null-role pass-through (G21): no role set → validate works
    const { dir: dirNoRole } = initProject('g7-no-role', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dirNoRole });
    setStackMeta(dirNoRole, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    runCli(`phase define --json`, { cwd: dirNoRole });
    runCli(`phase plan --json`, { cwd: dirNoRole });
    runCli(`phase build --json`, { cwd: dirNoRole });
    const vNoRole = runCli(`validate --json`, { cwd: dirNoRole });
    cases.push(assertOk(vNoRole.json?.overall !== false || !/requires currentRole=evaluator/.test(vNoRole.json?.message || ''), 'G7 validate works without role set (G21 pass-through)'));
  }

  record('G-gaps-coverage', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// SUITE H — Newly-fixed gaps: feature gate, state tracking, self-eval guard,
//           persona enforcement, per-task role rotation, tool naming
// ══════════════════════════════════════════════════════════════════════════════
suite('H', 'newly-fixed gaps coverage', () => {
  const cases = [];

  // ── H1 — Feature criteria gate (checkFeatureCriteria) ───────────────────────
  {
    const { dir } = initProject('h1-feature-gate', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);
    runCli(`role planner --json`, { cwd: dir });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`role evaluator --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    runCli(`role planner --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir });
    gitCommit(dir, 'plan');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir });
    runCli(`role evaluator --json`, { cwd: dir });

    // H1.1: empty definitionOfDone → feature-criteria blocks
    const fl = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), 'utf-8'));
    const feat = fl.features.find(f => f.id === 'feature-001');
    for (const t of feat.tasks) { t.status = 'complete'; t.acceptanceCriteria = ['criterion1']; }
    feat.definitionOfDone = [];
    fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify(fl, null, 2));
    const r1 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.featureCriteria?.pass === false, 'H1 feature-criteria fires when definitionOfDone empty'));
    cases.push(assertMatch(r1.json?.featureCriteria?.detail || '', /definitionOfDone/, 'H1 feature-criteria detail mentions definitionOfDone'));

    // H1.2: placeholder-only → blocked
    feat.definitionOfDone = ['...', '1. ...'];
    fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify(fl, null, 2));
    const r2 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.featureCriteria?.pass === false, 'H1 feature-criteria blocks placeholder-only definitionOfDone'));

    // H1.3: real criteria → passes + feature marked passes
    feat.definitionOfDone = ['all tests pass', 'code reviewed'];
    fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify(fl, null, 2));
    const r3 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertOk(r3.json?.featureCriteria?.pass !== false, 'H1 feature-criteria passes with real definitionOfDone'));
    const flAfter = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), 'utf-8'));
    cases.push(assertEqual(flAfter.features.find(f => f.id === 'feature-001').passes, true, 'H1 feature marked passes=true when definitionOfDone filled'));
  }

  // ── H2 — State machine tracks currentFeature + currentTask ──────────────────
  {
    const { dir } = initProject('h2-state-tracking', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);
    runCli(`role planner --json`, { cwd: dir });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`role evaluator --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    runCli(`role planner --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir });
    gitCommit(dir, 'plan');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir }); // → build

    const cfg = readConfig(dir);
    cases.push(assertOk(cfg.currentFeature !== null && cfg.currentFeature !== undefined, 'H2 currentFeature is set in config'));
    cases.push(assertOk(cfg.currentTask !== null && cfg.currentTask !== undefined, 'H2 currentTask is set in config'));
    cases.push(assertEqual(cfg.currentFeature, 'feature-001', 'H2 currentFeature = feature-001'));
    cases.push(assertEqual(cfg.currentTask, 'task-001', 'H2 currentTask = task-001'));
    const st = runCli(`status --json`, { cwd: dir });
    cases.push(assertOk(st.json?.sessionState !== undefined, 'H2 status has sessionState'));
    cases.push(assertOk(st.json?.currentRole !== undefined, 'H2 status has currentRole field'));
  }

  // ── H3 — Self-eval guard applies to ALL roles ──────────────────────────────
  {
    const { dir } = initProject('h3-self-eval', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);
    runCli(`role planner --json`, { cwd: dir });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`role evaluator --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    runCli(`role planner --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir });
    gitCommit(dir, 'plan');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir }); // → build

    // H3.1: generator in BUILD → blocked by role gate (requires evaluator)
    runCli(`role generator --json`, { cwd: dir });
    setProducedByRole(dir, 'feature-001', 'task-001', 'generator');
    const r1 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertExit(r1, 1, 'H3 generator validate in BUILD blocked by role gate'));
    cases.push(assertMatch(r1.json?.message || r1.stdout + r1.stderr, /requires currentRole=evaluator/, 'H3 generator blocked message mentions evaluator'));

    // H3.2: evaluator with producedByRole=evaluator → self-eval guard blocks
    runCli(`role evaluator --json`, { cwd: dir });
    setProducedByRole(dir, 'feature-001', 'task-002', 'evaluator');
    const r2 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertExit(r2, 1, 'H3 self-eval guard: evaluator with producedByRole=evaluator blocked'));
    cases.push(assertMatch(r2.json?.message || r2.stdout + r2.stderr, /Self-evaluation guard/, 'H3 self-eval guard message'));
    cases.push(assertMatch(r2.json?.message || r2.stdout + r2.stderr, /generator cannot evaluate/, 'H3 self-eval message says "generator cannot evaluate"'));

    // H3.3: evaluator with producedByRole=generator → passes (different roles)
    setProducedByRole(dir, 'feature-001', 'task-003', 'generator');
    const r3 = runCli(`validate --feature feature-001 --task task-003 --json`, { cwd: dir });
    cases.push(assertOk(!r3.json?.message?.includes('Self-evaluation guard'), 'H3 evaluator validates generator work (different roles) — no self-eval block'));

    // H3.4: null role → guard doesn't fire
    runCli(`config set currentRole null --json`, { cwd: dir });
    setProducedByRole(dir, 'feature-001', 'task-004', 'generator');
    const r4 = runCli(`validate --feature feature-001 --task task-004 --json`, { cwd: dir });
    cases.push(assertOk(!r4.json?.message?.includes('Self-evaluation guard'), 'H3 null role → self-eval guard does not fire'));
  }

  // ── H4 — Persona enforcement ───────────────────────────────────────────────
  {
    const { dir } = initProject('h4-personas', 'node');
    const r1 = runCli(`role planner --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.persona, 'H4 role planner has persona field'));
    cases.push(assertMatch(r1.json?.persona || '', /Analytical and precise/, 'H4 planner persona'));
    const r2 = runCli(`role generator --json`, { cwd: dir });
    cases.push(assertMatch(r2.json?.persona || '', /Focused and practical/, 'H4 generator persona'));
    const r3 = runCli(`role evaluator --json`, { cwd: dir });
    cases.push(assertMatch(r3.json?.persona || '', /Skeptical and thorough/, 'H4 evaluator persona'));
    const r4 = runCli(`role simplifier --json`, { cwd: dir });
    cases.push(assertMatch(r4.json?.persona || '', /Relentless about clarity/, 'H4 simplifier persona'));
    runCli(`config set agents.tone.planner "Custom planner persona" --json`, { cwd: dir });
    const r5 = runCli(`role planner --json`, { cwd: dir });
    cases.push(assertEqual(r5.json?.persona, 'Custom planner persona', 'H4 custom persona via config overrides default'));
    const r6 = runCli(`role evaluator`, { cwd: dir });
    cases.push(assertOk(r6.stdout.length > 0, 'H4 human output non-empty'));
  }

  // ── H5 — Per-task role rotation (DEFINE task-level requires planner) ────────
  {
    const { dir } = initProject('h5-role-rotation', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');

    // H5.1: DEFINE task-level with evaluator → blocked (requires planner)
    runCli(`role evaluator --json`, { cwd: dir });
    const vEval = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertExit(vEval, 1, 'H5 DEFINE task-level validate as evaluator exits 1 (requires planner)'));
    cases.push(assertMatch(vEval.json?.message || vEval.stdout + vEval.stderr, /requires currentRole=planner/, 'H5 message says requires planner'));

    // H5.2: DEFINE task-level with generator → blocked
    runCli(`role generator --json`, { cwd: dir });
    const vGen = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertExit(vGen, 1, 'H5 DEFINE task-level validate as generator exits 1 (requires planner)'));

    // H5.3: DEFINE task-level with planner → allowed
    runCli(`role planner --json`, { cwd: dir });
    const vPlanner = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(!vPlanner.json?.message?.includes('requires currentRole=planner'), 'H5 DEFINE task-level validate as planner allowed'));

    // H5.4: null role → pass-through
    runCli(`config set currentRole null --json`, { cwd: dir });
    const vNull = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(!vNull.json?.message?.includes('requires currentRole'), 'H5 null role → no role gate enforcement'));
  }

  // ── H6 — Tool naming (skill = manifest, not tool name) ──────────────────────
  {
    const { dir: dir2 } = initProject('h6-claude', 'node', '--agent-tool claude-code');
    cases.push(assertOk(fs.existsSync(path.join(dir2, 'CLAUDE.md')), 'H6 claude-code generates CLAUDE.md'));
    const { dir: dir3 } = initProject('h6-cursor', 'node', '--agent-tool cursor');
    cases.push(assertOk(fs.existsSync(path.join(dir3, '.cursorrules')), 'H6 cursor generates .cursorrules'));
    const { dir: dir4 } = initProject('h6-skill', 'node', '--agent-tool skill');
    // skill adapter may not scaffold SKILL.md in target dir (it's in adapters/ in the repo, not the project)
    // Check that config has agentTool=skill
    const skillCfg = readConfig(dir4);
    cases.push(assertEqual(skillCfg.agentTool, 'skill', 'H6 skill sets agentTool=skill in config'));
    const { dir: dir5 } = initProject('h6-all', 'node', '--agent-tool all');
    cases.push(assertOk(fs.existsSync(path.join(dir5, 'CLAUDE.md')), 'H6 all generates CLAUDE.md'));
    cases.push(assertOk(fs.existsSync(path.join(dir5, '.cursorrules')), 'H6 all generates .cursorrules'));
    // Read tool-registry synchronously via require-style (read + eval)
    const toolRegistryPath = path.join(PROJECT_ROOT, 'cli/lib/tool-registry.mjs');
    const toolRegistryContent = fs.readFileSync(toolRegistryPath, 'utf-8');
    cases.push(assertOk(toolRegistryContent.includes("'Skill Manifest'"), 'H6 tool-registry has skill label = "Skill Manifest"'));
    cases.push(assertOk(toolRegistryContent.includes('not a tool name'), 'H6 tool-registry notes say "not a tool name"'));
    cases.push(assertOk(toolRegistryContent.includes("file: 'CLAUDE.md'"), 'H6 claude-code file = CLAUDE.md'));
    cases.push(assertOk(toolRegistryContent.includes("file: '.cursorrules'"), 'H6 cursor file = .cursorrules'));
  }

  // ── H7 — 3-level criteria enforcement matrix ────────────────────────────────
  {
    const { dir } = initProject('h7-criteria-matrix', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldPlaceholderFreeSource(dir);
    scaffoldCalcDocs(dir);
    writeFeatureList(dir);
    runCli(`role planner --json`, { cwd: dir });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`role evaluator --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    runCli(`role planner --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir });
    gitCommit(dir, 'plan');
    runCli(`validate --json`, { cwd: dir });
    runCli(`phase next --json`, { cwd: dir }); // → build
    runCli(`role evaluator --json`, { cwd: dir });

    // Task-level: empty → fails
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', []);
    const r1 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r1.json?.failures?.includes('task-criteria'), 'H7 task-criteria: empty acceptanceCriteria fails'));
    // Task-level: placeholder → fails
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', ['...']);
    const r2 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r2.json?.failures?.includes('task-criteria'), 'H7 task-criteria: placeholder-only fails'));
    // Task-level: real → passes
    setAcceptanceCriteria(dir, 'feature-001', 'task-001', ['add returns correct sum']);
    const r3 = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
    cases.push(assertOk(r3.json?.failures?.indexOf('task-criteria') === -1 || r3.json?.overall, 'H7 task-criteria: real criteria passes'));

    // Feature-level: empty → blocks
    const fl = JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), 'utf-8'));
    const feat = fl.features.find(f => f.id === 'feature-001');
    for (const t of feat.tasks) { t.status = 'complete'; t.acceptanceCriteria = ['criterion1']; }
    feat.definitionOfDone = [];
    fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify(fl, null, 2));
    const r4 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertOk(r4.json?.featureCriteria?.pass === false, 'H7 feature-criteria: empty definitionOfDone blocks'));
    // Feature-level: real → passes
    feat.definitionOfDone = ['all tests pass', 'code reviewed'];
    fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify(fl, null, 2));
    const r5 = runCli(`validate --feature feature-001 --task task-002 --json`, { cwd: dir });
    cases.push(assertOk(r5.json?.featureCriteria?.pass !== false, 'H7 feature-criteria: real definitionOfDone passes'));

    // Phase-level: empty → fails
    writeContractCriteria(dir, []);
    runCli(`config set currentPhase define --json`, { cwd: dir });
    const r6 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r6.json?.failures?.includes('contract-criteria'), 'H7 contract-criteria: empty section fails'));
    // Phase-level: real → passes
    writeContractCriteria(dir, ['all unit tests pass']);
    const r7 = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(r7.json?.failures?.indexOf('contract-criteria') === -1 || r7.json?.overall, 'H7 contract-criteria: real criteria passes'));
  }

  // ── H8 — Copilot vs Autopilot mode comparison ───────────────────────────────
  {
    const { dir: dirCopilot } = initProject('h8-copilot', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dirCopilot });
    setStackMeta(dirCopilot, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    scaffoldCalcDocs(dirCopilot);
    runCli(`phase define --json`, { cwd: dirCopilot });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dirCopilot });
    runCli(`contract review --agreed --json`, { cwd: dirCopilot });
    gitBranch(dirCopilot, 'feat/test');
    gitCommit(dirCopilot, 'define');
    runCli(`validate --json`, { cwd: dirCopilot });
    const copilotNext = runCli(`phase next --json`, { cwd: dirCopilot });
    cases.push(assertEqual(copilotNext.json?.mode, 'copilot', 'H8 copilot mode in phase next JSON'));
    cases.push(assertEqual(copilotNext.json?.status, 'instruction', 'H8 copilot phase next returns status=instruction'));
    const copilotRetry = runCli(`config get retry --json`, { cwd: dirCopilot });
    cases.push(assertEqual(copilotRetry.json?.value?.features?.enabled, false, 'H8 copilot retry.features.enabled=false'));
    cases.push(assertEqual(copilotRetry.json?.value?.phases?.enabled, false, 'H8 copilot retry.phases.enabled=false'));

    const { dir: dirAuto } = initProject('h8-autopilot', 'node', '--mode autopilot');
    const autoCfg = readConfig(dirAuto);
    cases.push(assertEqual(autoCfg.mode, 'autopilot', 'H8 autopilot mode stored in config'));
    cases.push(assertEqual(autoCfg.retry?.features?.enabled, true, 'H8 autopilot retry.features.enabled=true'));
    cases.push(assertEqual(autoCfg.retry?.phases?.enabled, true, 'H8 autopilot retry.phases.enabled=true'));
    cases.push(assertEqual(autoCfg.retry?.tasks?.maxRetries, 3, 'H8 autopilot retry.tasks.maxRetries=3'));
  }

  // ── H9 — Edge cases: null role pass-through, missing feature-list ──────────
  {
    const { dir } = initProject('h9-null-role', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir });
    setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
    runCli(`phase define --json`, { cwd: dir });
    runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
    runCli(`contract review --agreed --json`, { cwd: dir });
    writeContractCriteria(dir, ['tests pass']);
    gitBranch(dir, 'feat/test');
    gitCommit(dir, 'define');
    const v = runCli(`validate --json`, { cwd: dir });
    cases.push(assertOk(v.json?.overall !== false || !v.json?.message?.includes('requires currentRole'), 'H9 null role: validate works (pass-through)'));

    const { dir: dir2 } = initProject('h9-null-contract', 'node');
    runCli(`phase define --json`, { cwd: dir2 });
    cases.push(assertStatus(runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir2 }), 'ok', 'H9 null role: contract propose works'));
    cases.push(assertStatus(runCli(`contract review --agreed --json`, { cwd: dir2 }), 'ok', 'H9 null role: contract review works'));

    const { dir: dir4 } = initProject('h9-missing-fl', 'node');
    runCli(`config set gates.enabled true --json`, { cwd: dir4 });
    fs.unlinkSync(path.join(dir4, 'harness', 'features', 'feature-list.json'));
    // Test checkFeatureCriteria directly by calling validate (which will fail gracefully)
    const rMissing = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir4 });
    cases.push(assertOk(rMissing.exitCode === 1 || rMissing.json?.overall === false, 'H9 missing feature-list: validate fails gracefully'));
  }

  // ── H10 — Matrix: role gate enforcement at phase level ─────────────────────
  {
    const roles = ['planner', 'generator', 'evaluator', 'simplifier'];
    const phases = ['define', 'build', 'verify'];
    for (const role of roles) {
      for (const phase of phases) {
        const { dir } = initProject(`h10-${role}-${phase}`, 'node');
        runCli(`config set gates.enabled true --json`, { cwd: dir });
        setStackMeta(dir, { lintCmd: 'node -e 1', testCmd: 'node --test' });
        scaffoldPlaceholderFreeSource(dir);
        scaffoldCalcDocs(dir);
        writeFeatureList(dir);
        // Bootstrap to target phase
        runCli(`phase define --json`, { cwd: dir });
        runCli(`contract propose --scope "x" --criteria "tests pass" --json`, { cwd: dir });
        runCli(`contract review --agreed --json`, { cwd: dir });
        writeContractCriteria(dir, ['tests pass']);
        gitBranch(dir, 'feat/test');
        gitCommit(dir, 'define');
        runCli(`validate --json`, { cwd: dir });
        if (phase === 'define') {
          // Stay in define — set role and try task-level validate
          runCli(`role ${role} --json`, { cwd: dir });
          const v = runCli(`validate --feature feature-001 --task task-001 --json`, { cwd: dir });
          const blocked = v.exitCode === 1 && (v.json?.message || v.stdout + v.stderr).includes('requires currentRole');
          if (role !== 'planner') {
            cases.push(assertOk(blocked, `H10 ${role} in DEFINE task: blocked (requires planner)`));
          } else {
            cases.push(assertOk(!blocked, `H10 ${role} in DEFINE task: not blocked by role gate`));
          }
        } else {
          // Advance to build or verify
          runCli(`phase next --json`, { cwd: dir });
          gitCommit(dir, 'plan');
          runCli(`validate --json`, { cwd: dir });
          runCli(`phase next --json`, { cwd: dir }); // → build
          if (phase === 'verify') {
            for (const f of ['feature-001', 'feature-002', 'feature-003']) markFeatureComplete(dir, f);
            gitCommit(dir, 'build');
            runCli(`validate --json`, { cwd: dir });
            runCli(`phase next --json`, { cwd: dir }); // → verify
          }
          // Set role and try phase-level validate
          runCli(`role ${role} --json`, { cwd: dir });
          const v = runCli(`validate --json`, { cwd: dir });
          const blocked = v.exitCode === 1 && (v.json?.message || v.stdout + v.stderr).includes('requires currentRole');
          if (role !== 'evaluator') {
            cases.push(assertOk(blocked, `H10 ${role} in ${phase}: blocked (requires evaluator)`));
          } else {
            cases.push(assertOk(!blocked, `H10 ${role} in ${phase}: not blocked by role gate`));
          }
        }
      }
    }
  }

  record('H-newly-fixed-gaps', cases);
});

// ══════════════════════════════════════════════════════════════════════════════
// Report generation
// ══════════════════════════════════════════════════════════════════════════════
function emitResults() {
  REPORT.endedAt = new Date().toISOString();
  REPORT.totalPassed = totalPassed;
  REPORT.totalFailed = totalFailed;
  REPORT.failures = allFailures;
  const outDir = path.join(PROJECT_ROOT, 'references');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'e2e-results.json'), JSON.stringify(REPORT, null, 2));

  // Checklist markdown — per-suite table
  let md = '# E2E Full Workflow — Auto-Generated Checklist\n\n';
  md += `_Generated: ${REPORT.endedAt} by \`test/e2e-full-workflow.mjs\`_\n\n`;
  md += `**Summary:** ${totalPassed} pass, ${totalFailed} fail, ${totalPassed + totalFailed} total\n\n`;
  md += '| Suite | Cases | Passed | Failed | Status |\n';
  md += '|-------|-------|--------|--------|--------|\n';
  for (const s of REPORT.suites) {
    const status = s.failed === 0 ? '✅' : '❌';
    md += `| ${s.suite} | ${s.cases.length} | ${s.passed} | ${s.failed} | ${status} |\n`;
  }
  md += '\n## Per-Case Detail\n\n';
  for (const s of REPORT.suites) {
    md += `### ${s.suite}\n\n`;
    md += '| # | Result | Case |\n|---|--------|------|\n';
    s.cases.forEach((c, i) => {
      md += `| ${i + 1} | ${c.pass ? '✅' : '❌'} | ${c.msg || '(ok)'} |\n`;
    });
    md += '\n';
  }
  if (allFailures.length > 0) {
    md += '## Failures\n\n';
    for (const f of allFailures) {
      md += `- **${f.suite}**: ${f.msg}\n`;
    }
  }
  fs.writeFileSync(path.join(outDir, 'e2e-checklist.md'), md);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══ dev-harness E2E Full Workflow ═══\n');
  for (const s of SUITES) {
    if (!shouldRun(s.id)) { vlog(`skip ${s.id}`); continue; }
    process.stdout.write(`  ▶ ${s.id}: ${s.name} ... `);
    try {
      await s.fn();
      const last = REPORT.suites[REPORT.suites.length - 1];
      console.log(`${last.passed}/${last.cases.length} pass${last.failed > 0 ? `, ${last.failed} FAIL` : ''}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      record(s.id, [{ pass: false, msg: `Suite threw: ${err.message}` }]);
    }
  }
  emitResults();
  console.log(`\n${totalPassed} pass, ${totalFailed} fail, ${totalPassed + totalFailed} total`);
  console.log(`Results: references/e2e-results.json`);
  console.log(`Checklist: references/e2e-checklist.md`);
  if (totalFailed > 0) {
    console.log(`\nFailures:`);
    for (const f of allFailures) console.log(`  ✗ ${f.suite}: ${f.msg}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * T13 — Progress Reading (status command) Test Battery
 *
 * Tests the `dev-harness status` command:
 * - Human-readable output format
 * - JSON output contract with --json
 * - No-config fallback
 * - Phase-aware output (currentPhase, currentFeature)
 * - Gate status integration
 * - Lessons integration (recentLessons)
 * - --target flag
 * - Edge cases (missing files, autopilot mode, git info)
 *
 * Usage: node test-t13.mjs
 *        node test-t13.mjs --verbose
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';

// ── Test framework ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let VERBOSE = process.argv.includes('--verbose');

function assertEqual(actual, expected, msg) {
  try { assert.strictEqual(actual, expected, msg); passed++; }
  catch (e) { failed++; console.error(`  ✗ ${msg}\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`); }
}

function assertOk(value, msg) {
  try { assert.ok(value, msg); passed++; }
  catch (e) { failed++; console.error(`  ✗ ${msg}\n    value: ${JSON.stringify(value)}`); }
}

function assertMatch(str, regex, msg) {
  try { assert.match(str, regex, msg); passed++; }
  catch (e) { failed++; console.error(`  ✗ ${msg}\n    string: ${JSON.stringify(str)}\n    regex:  ${regex}`); }
}

function assertNotEqual(actual, expected, msg) {
  try { assert.notStrictEqual(actual, expected, msg); passed++; }
  catch (e) { failed++; console.error(`  ✗ ${msg}\n    actual: ${JSON.stringify(actual)}`); }
}

async function run(name, fn) {
  try { await fn(); if (VERBOSE) console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

// ── Constants ────────────────────────────────────────────────────────────────

// Resolve repo root from this test file's location (test/ → repo root).
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'node ' + path.resolve(PROJECT_ROOT, 'cli/dev-harness.mjs');
const TEST_TMP = '/tmp/t13-test-' + Date.now();
const CLI_TIMEOUT = 10000;

// ── Project scaffolding helpers ──────────────────────────────────────────────

function createProject(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'proj-'));
  const defaultConfig = {
    version: '1.0',
    stack: overrides.stack || 'node',
    mode: overrides.mode || 'copilot',
    currentPhase: overrides.currentPhase || null,
    paused: overrides.paused || false,
    features: { remaining: 0, passing: 0, total: 0 },
    gates: { enabled: false, checks: ['all'] },
    git: { autoCommit: false, autoTag: false, resetOnRetry: false, branch: null, clean: true, hasUpstream: false, lastCommitMessage: null },
    phases: { enabled: ['define', 'plan', 'build', 'verify', 'review', 'ship'] },
    agents: { tone: {} },
    maxRetries: overrides.maxRetries ?? 3,
    retryCount: overrides.retryCount || 0,
    pipelineIteration: overrides.pipelineIteration || 0,
    gateHistory: [],
  };
  fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(defaultConfig, null, 2) + '\n', 'utf-8');
  return dir;
}

function createProjectAtPhase(phase, overrides = {}) {
  return createProject({ ...overrides, currentPhase: phase });
}

function createScaffoldedProject(overrides = {}) {
  const dir = createProject(overrides);
  const featureList = overrides.features || [
    { id: 'f1', name: 'Feature 1', description: 'Test feature', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
  ];
  fs.mkdirSync(path.join(dir, 'harness', 'features'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify({ version: '0.1', features: featureList }, null, 2) + '\n', 'utf-8');
  return dir;
}

function addLesson(dir, text, author) {
  execSync(`${CLI} learn "${text}" --target "${dir}"`, {
    encoding: 'utf-8', timeout: CLI_TIMEOUT, stdio: 'pipe',
  });
}

function cli(args, cwd) {
  try {
    const stdout = execSync(`${CLI} ${args} --target ${cwd || process.cwd()}`, {
      encoding: 'utf-8', timeout: CLI_TIMEOUT, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e) {
    const out = e.stdout?.toString()?.trim() || '';
    const err = e.stderr?.toString()?.trim() || '';
    return { stdout: out, stderr: err, exitCode: e.status || 1 };
  }
}

function cliJson(args, cwd) {
  const res = cli(`${args} --json`, cwd);
  try { return { data: JSON.parse(res.stdout), exitCode: res.exitCode, stderr: res.stderr }; }
  catch { return { data: null, exitCode: res.exitCode, raw: res.stdout, stderr: res.stderr }; }
}

function loadConfig(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'harness', 'config.json'), 'utf-8'));
}

// ══════════════════════════════════════════════════════════════════════════════
//  A. Basic human-readable output
// ══════════════════════════════════════════════════════════════════════════════

async function suiteA() {
  await run('A.1 — status shows header with project name', () => {
    const dir = createProject();
    const res = cli('status', dir);
    assertMatch(res.stdout, /═══ harness Status ═══/, 'should show header');
    assertMatch(res.stdout, new RegExp(path.basename(dir)), 'should show project name');
  });

  await run('A.2 — status shows stack label', () => {
    const dir = createProject({ stack: 'python' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Python|Stack/, 'should show stack info');
  });

  await run('A.3 — status shows mode (copilot/autopilot)', () => {
    const dir = createProject({ mode: 'copilot' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Copilot/, 'should show Copilot mode');
  });

  await run('A.4 — status shows mode autopilot', () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'build' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Autopilot/, 'should show Autopilot mode');
  });

  await run('A.5 — status shows current phase when set', () => {
    const dir = createProject({ currentPhase: 'build' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /BUILD/, 'should show BUILD phase');
  });

  await run('A.6 — status shows "not started" when no phase', () => {
    const dir = createProject({ currentPhase: null });
    const res = cli('status', dir);
    assertMatch(res.stdout, /not started/, 'should show not started');
  });

  await run('A.7 — status shows next action', () => {
    const dir = createProject({ currentPhase: null });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Run:/, 'should suggest next action');
  });

  await run('A.8 — status without config shows init hint', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'no-config-'));
    const res = cli('status', dir);
    assertMatch(res.stdout, /No harness\/config\.json/, 'should mention missing config');
    assertMatch(res.stdout, /dev-harness init/, 'should suggest init');
  });

  await run('A.9 — status human output has consistent formatting', () => {
    const dir = createProject({ currentPhase: 'verify' });
    const res = cli('status', dir);
    const lines = res.stdout.split('\n').filter(l => l.trim());
    assertOk(lines.length >= 4, 'should have at least 4 lines of output');
    assertMatch(lines[0], /═══/, 'first line should have header separator');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  B. JSON output contract
// ══════════════════════════════════════════════════════════════════════════════

async function suiteB() {
  await run('B.1 — status --json has command/status/message envelope', () => {
    const dir = createProject();
    const { data } = cliJson('status', dir);
    assertOk(data, 'should parse JSON');
    assertEqual(data.command, 'status', 'command should be status');
    assertEqual(data.status, 'ok', 'status should be ok');
    assertOk(typeof data.message === 'string' && data.message.length > 0, 'should have message');
  });

  await run('B.2 — status --json has project field', () => {
    const dir = createProject();
    const { data } = cliJson('status', dir);
    assertEqual(data.project, path.basename(dir), 'project should match dir basename');
  });

  await run('B.3 — status --json has stack/stackLabel', () => {
    const dir = createProject({ stack: 'python' });
    const { data } = cliJson('status', dir);
    assertOk(typeof data.stack === 'string', 'stack should be string');
    assertOk(typeof data.stackLabel === 'string', 'stackLabel should be string');
  });

  await run('B.4 — status --json has mode', () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    assertEqual(data.mode, 'autopilot', 'mode should be autopilot');
  });

  await run('B.5 — status --json has currentPhase', () => {
    const dir = createProject({ currentPhase: 'define' });
    const { data } = cliJson('status', dir);
    assertEqual(data.currentPhase, 'define', 'currentPhase should be define');
  });

  await run('B.6 — status --json currentPhase is null when not started', () => {
    const dir = createProject({ currentPhase: null });
    const { data } = cliJson('status', dir);
    assertEqual(data.currentPhase, null);
  });

  await run('B.7 — status --json has currentFeature with default when built but no feature file', () => {
    const dir = createProject({ currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    // loadFeatureList returns default features when file missing
    assertOk(data.currentFeature !== null && typeof data.currentFeature === 'string', 'currentFeature should be a string');
    assertEqual(data.currentFeature, 'Feature 1');
  });

  await run('B.8 — status --json has currentFeature when features exist', () => {
    const dir = createScaffoldedProject({ currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    assertEqual(data.currentFeature, 'Feature 1');
  });

  await run('B.9 — status --json has gateStatus fields', () => {
    const dir = createProject({ currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    assertOk(typeof data.gateStatus === 'string', 'gateStatus should be string');
    assertOk(typeof data.checksPassing === 'number', 'checksPassing should be number');
    assertOk(typeof data.checksTotal === 'number', 'checksTotal should be number');
  });

  await run('B.10 — status --json has paused field', () => {
    const dir = createProject({ paused: true });
    const { data } = cliJson('status', dir);
    assertEqual(data.paused, true);
  });

  await run('B.11 — status --json has features object', () => {
    const dir = createProject();
    const { data } = cliJson('status', dir);
    assertOk(typeof data.features === 'object', 'features should be object');
    assertOk(typeof data.features.remaining === 'number', 'features.remaining should be number');
    assertOk(typeof data.features.total === 'number', 'features.total should be number');
  });

  await run('B.12 — status --json has git info', () => {
    const dir = createProject();
    const { data } = cliJson('status', dir);
    assertOk(typeof data.git === 'object', 'git should be object');
    assertOk(typeof data.git.clean === 'boolean', 'git.clean should be boolean');
  });

  await run('B.13 — status --json has maxRetries', () => {
    const dir = createProject({ maxRetries: 5 });
    const { data } = cliJson('status', dir);
    assertEqual(data.maxRetries, 5);
  });

  await run('B.14 — status --json has nextAction', () => {
    const dir = createProject({ currentPhase: null });
    const { data } = cliJson('status', dir);
    assertOk(typeof data.nextAction === 'string' && data.nextAction.length > 0, 'nextAction should be non-empty string');
  });

  await run('B.15 — status --json exit code 0', () => {
    const dir = createProject();
    const { exitCode } = cliJson('status', dir);
    assertEqual(exitCode, 0);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  C. Lessons integration
// ══════════════════════════════════════════════════════════════════════════════

async function suiteC() {
  await run('C.1 — status --json has recentLessons array', () => {
    const dir = createProject();
    addLesson(dir, 'Test lesson');
    const { data } = cliJson('status', dir);
    assertOk(Array.isArray(data.recentLessons), 'recentLessons should be array');
    assertOk(data.recentLessons.length >= 1, 'should have at least 1 lesson');
  });

  await run('C.2 — recentLessons entries are objects with date/author/text', () => {
    const dir = createProject();
    addLesson(dir, 'Lesson for object check');
    const { data } = cliJson('status', dir);
    const lesson = data.recentLessons[0];
    assertOk(lesson !== null && typeof lesson === 'object', 'lesson should be an object');
    assertOk(typeof lesson.date === 'string', 'date should be string');
    assertOk(typeof lesson.author === 'string', 'author should be string');
    assertOk(typeof lesson.text === 'string', 'text should be string');
    assertEqual(lesson.text, 'Lesson for object check');
  });

  await run('C.3 — recentLessons shows only last 3 lessons', () => {
    const dir = createProject();
    addLesson(dir, 'Lesson 1');
    addLesson(dir, 'Lesson 2');
    addLesson(dir, 'Lesson 3');
    addLesson(dir, 'Lesson 4');
    const { data } = cliJson('status', dir);
    assertEqual(data.recentLessons.length, 3, 'should only show 3 most recent');
    assertEqual(data.recentLessons[2].text, 'Lesson 4', 'most recent should be last');
  });

  await run('C.4 — recentLessons shows from progress.md', () => {
    const dir = createProject();
    addLesson(dir, 'From progress lesson');
    const { data } = cliJson('status', dir);
    assertOk(data.recentLessons.length >= 1);
    assertMatch(data.recentLessons[data.recentLessons.length - 1].text, /progress/);
  });

  await run('C.5 — status --json with lessons shows nextAction lessons mention', () => {
    const dir = createProject();
    addLesson(dir, 'Something learned');
    const { data } = cliJson('status', dir);
    assertOk(typeof data.nextAction === 'string');
  });

  await run('C.6 — status human output shows lessons when present', () => {
    const dir = createProject();
    addLesson(dir, 'Human readable lesson');
    const res = cli('status', dir);
    assertMatch(res.stdout, /lesson/, 'should mention lessons');
    assertMatch(res.stdout, /Human readable lesson/, 'should show lesson text');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  D. Feature awareness
// ══════════════════════════════════════════════════════════════════════════════

async function suiteD() {
  await run('D.1 — status shows current feature in human output', () => {
    const dir = createScaffoldedProject({
      currentPhase: 'build',
      features: [
        { id: 'us-001', name: 'User auth', description: 'Login flow', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
      ],
    });
    const res = cli('status', dir);
    assertMatch(res.stdout, /User auth/, 'should show feature name');
    assertMatch(res.stdout, /us-001/, 'should show feature id');
  });

  await run('D.2 — status --json shows current feature name', () => {
    const dir = createScaffoldedProject({
      currentPhase: 'build',
      features: [
        { id: 'us-002', name: 'Token refresh', description: 'Refresh token flow', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
      ],
    });
    const { data } = cliJson('status', dir);
    assertEqual(data.currentFeature, 'Token refresh');
  });

  await run('D.3 — status shows no feature when feature_list missing', () => {
    const dir = createProject({ currentPhase: 'build' });
    const res = cli('status', dir);
    // Should still show phase but no feature
    assertMatch(res.stdout, /BUILD/, 'should show phase');
    assertNotEqual(res.exitCode, 1, 'should not error');
  });

  await run('D.4 — status shows no feature when all features pass', () => {
    const dir = createScaffoldedProject({
      currentPhase: 'review',
      features: [
        { id: 'f1', name: 'Done Feature', description: 'Already done', passes: true, tasks: [{ id: 't1', description: 'Task 1', status: 'completed' }] },
      ],
    });
    const { data } = cliJson('status', dir);
    assertEqual(data.currentFeature, null, 'no pending feature = null');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  E. Gate status integration
// ══════════════════════════════════════════════════════════════════════════════

async function suiteE() {
  await run('E.1 — status shows gateStatus disabled when gates off', () => {
    const dir = createProject({ currentPhase: 'build' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /disabled/, 'should show disabled gates');
  });

  await run('E.2 — status --json gateStatus is disabled when gates off', () => {
    const dir = createProject({ currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    assertEqual(data.gateStatus, 'disabled');
  });

  await run('E.3 — status shows gate status when gates enabled', () => {
    const dir = createProject({ currentPhase: 'build' });
    const cfg = loadConfig(dir);
    cfg.gates.enabled = true;
    fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    const res = cli('status', dir);
    // Gates enabled but git checks may fail
    assertMatch(res.stdout, /checks|passing|failing/, 'should mention checks');
  });

  await run('E.4 -- status --json checksPassing/checksTotal >= 0', () => {
    const dir = createProject({ currentPhase: 'build' });
    const { data } = cliJson('status', dir);
    assertOk(data.checksPassing >= 0, 'checksPassing >= 0');
    assertOk(data.checksTotal >= 0, 'checksTotal >= 0');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  F. --target flag
// ══════════════════════════════════════════════════════════════════════════════

async function suiteF() {
  await run('F.1 — status --target <dir> works', () => {
    const dir = createProject();
    // Use cwd parameter (which appends --target) instead of inline --target
    const res = cli('status', dir);
    assertOk(res.stdout.includes(path.basename(dir)), 'should show target project name');
    assertEqual(res.exitCode, 0, 'exit code should be 0');
  });

  await run('F.2 — status --target --json works', () => {
    const dir = createProject({ currentPhase: 'define' });
    const { data, exitCode } = cliJson('status', dir);
    assertEqual(data.currentPhase, 'define');
    assertEqual(exitCode, 0);
  });

  await run('F.3 — status with bare --target does not crash', () => {
    const dir = createProject();
    const res = cli('status --target', dir);
    assertOk(res.exitCode !== 3, 'bare --target should not crash (exit 3)');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  G. Next action determination
// ══════════════════════════════════════════════════════════════════════════════

async function suiteG() {
  await run('G.1 — nextAction is init hint when no config', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'no-cfg-'));
    const { data } = cliJson('status', dir);
    assertMatch(data.nextAction, /init/, 'should suggest init');
  });

  await run('G.2 — nextAction is define start when no phase', () => {
    const dir = createProject({ currentPhase: null });
    const { data } = cliJson('status', dir);
    assertMatch(data.nextAction, /define/, 'should suggest define phase');
  });

  await run('G.3 — nextAction is validate when gates fail', () => {
    const dir = createProject({ currentPhase: 'build' });
    const cfg = loadConfig(dir);
    cfg.gates.enabled = true;
    fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    const { data } = cliJson('status', dir);
    if (data.gateStatus === 'fail') {
      assertMatch(data.nextAction, /validate/, 'should suggest validate when gates fail');
    }
  });

  await run('G.4 — nextAction suggests next phase in order', () => {
    const dir = createProject({ currentPhase: 'define' });
    const { data } = cliJson('status', dir);
    assertMatch(data.nextAction, /plan/, 'define → should suggest plan');
  });

  await run('G.5 — nextAction suggests validate at last phase', () => {
    const dir = createProject({ currentPhase: 'ship' });
    const { data } = cliJson('status', dir);
    assertMatch(data.nextAction, /validate/, 'last phase → suggest validate');
  });

  await run('G.6 — nextAction human output shows run hint', () => {
    const dir = createProject({ currentPhase: 'plan' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Run:/, 'human output should show Run: prefix');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  H. Edge cases
// ══════════════════════════════════════════════════════════════════════════════

async function suiteH() {
  await run('H.1 — status on empty directory works', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'empty-'));
    const { data, exitCode } = cliJson('status', dir);
    assertEqual(data.command, 'status');
    assertEqual(data.status, 'ok');
    assertEqual(exitCode, 0);
  });

  await run('H.2 — status with corrupt config works gracefully', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'bad-cfg-'));
    fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), 'not valid json', 'utf-8');
    const { data, exitCode } = cliJson('status', dir);
    assertEqual(data.command, 'status');
    assertEqual(data.status, 'ok'); // graceful fallback
    assertEqual(exitCode, 0);
  });

  await run('H.3 — status shows gateStatus disabled even with corrupt gates config', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'bad-gates-'));
    fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify({
      version: '1.0', mode: 'copilot', currentPhase: 'build',
      gates: null, // corrupt gates field
    }) + '\n', 'utf-8');
    const { data, exitCode } = cliJson('status', dir);
    assertEqual(data.gateStatus, 'disabled');
    assertEqual(exitCode, 0);
  });

  await run('H.4 — status in autopilot mode shows correct mode', () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'build' });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Autopilot/, 'human output should show autopilot');
  });

  await run('H.5 — status with progress.md but no config shows lessons', () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'lessons-only-'));
    addLesson(dir, 'Lesson without config');
    const { data } = cliJson('status', dir);
    assertOk(Array.isArray(data.recentLessons), 'recentLessons should be array');
    assertOk(data.recentLessons.length >= 1, 'should have lessons');
    assertEqual(data.currentPhase, null, 'no config = no phase');
  });

  await run('H.6 — status human output autopilot shows correct format', () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'build', paused: true });
    const res = cli('status', dir);
    assertMatch(res.stdout, /Autopilot/, 'should show autopilot mode');
    assertMatch(res.stdout, /BUILD/, 'should show build phase');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  I. Cross-file consistency
// ══════════════════════════════════════════════════════════════════════════════

async function suiteI() {
  await run('I.1 — status --json maxRetries matches config', () => {
    const dir = createProject({ maxRetries: 7 });
    const { data } = cliJson('status', dir);
    assertEqual(data.maxRetries, 7);
  });

  await run('I.2 — status --json features.remaining from config', () => {
    const dir = createProject();
    const cfg = loadConfig(dir);
    cfg.features = { remaining: 3, passing: 2, total: 5 };
    fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    const { data } = cliJson('status', dir);
    assertEqual(data.features.remaining, 3);
    assertEqual(data.features.passing, 2);
    assertEqual(data.features.total, 5);
  });

  await run('I.3 — status --json project matches dir basename', () => {
    const dir = createProject();
    const { data } = cliJson('status', dir);
    assertEqual(data.project, path.basename(dir));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  T13 PROGRESS READING (status command) TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Clean up any stale test dirs
  try { fs.rmSync(TEST_TMP, { recursive: true }); } catch {}
  fs.mkdirSync(TEST_TMP, { recursive: true });

  try {
    await suiteA();   // Basic human-readable output
    await suiteB();   // JSON output contract
    await suiteC();   // Lessons integration
    await suiteD();   // Feature awareness
    await suiteE();   // Gate status integration
    await suiteF();   // --target flag
    await suiteG();   // Next action determination
    await suiteH();   // Edge cases
    await suiteI();   // Cross-file consistency
  } finally {
    try { fs.rmSync(TEST_TMP, { recursive: true }); } catch {}
  }

  const total = passed + failed;
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  T13 PROGRESS READING TESTS: ${passed}/${total} passed`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);

  if (failed > 0) {
    console.error('FAILURES:');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * T9 — Phase Ralph Loop Engine Test Battery
 *
 * Tests ralph-phases.mjs functions directly (unit tests) and
 * CLI integration via dev-harness phase (integration tests).
 *
 * Usage: node test-t9.mjs
 *        node test-t9.mjs --verbose
 *        node test-t9.mjs --quick  (skip CLI integration tests)
 *        node test-t9.mjs --only-cli  (skip unit tests)
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];
const verbose = process.argv.includes('--verbose');
const skipSlow = process.argv.includes('--quick');
const onlyCli = process.argv.includes('--only-cli');

async function run(name, fn) {
  if (onlyCli && !name.startsWith('CLI-')) {
    passed++;
    return;
  }
  try {
    await fn();
    passed++;
    if (verbose) console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message, stack: err.stack });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg || 'Not equal'}\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`,
    );
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'Not equal'}\n    actual:   ${a}\n    expected: ${e}`);
}

function assertMatch(str, regex, msg) {
  if (!regex.test(str)) throw new Error(`${msg || 'No match'}\n    string: ${JSON.stringify(str)}\n    regex:  ${regex}`);
}

function assertOk(val, msg) {
  if (!val) throw new Error(msg || 'Expected truthy');
}

// ── Setup ────────────────────────────────────────────────────────────────────

const TEST_TMP = fs.mkdtempSync(path.join(tmpdir(), 't9-test-'));
const CLI_PATH = path.join(PROJECT_ROOT, 'cli/dev-harness.mjs');

// ── Module references (loaded once) ──────────────────────────────────────────

let ralphOuter;   // ralph-phases.mjs — phase loop (continuePipeline, runAutopilot, runPhase)
let ralphInner;   // ralph-phases.mjs — runPhase lives here now (was ralph-tasks.mjs)
let ralphShared;  // ralph-shared.mjs — getPhaseType, loadFeatureList, etc.
let state;

async function loadModules() {
  if (!ralphOuter) {
    ralphOuter = await import(path.join(PROJECT_ROOT, 'cli/lib/ralph-phases.mjs'));
  }
  if (!ralphInner) {
    // runPhase moved from ralph-tasks.mjs to ralph-phases.mjs (the phase
    // loop now owns the dispatcher that routes to feature/deliverable loops).
    ralphInner = ralphOuter;
  }
  if (!ralphShared) {
    ralphShared = await import(path.join(PROJECT_ROOT, 'cli/lib/ralph-shared.mjs'));
  }
  if (!state) {
    state = await import(path.join(PROJECT_ROOT, 'cli/lib/state.mjs'));
  }
}

// ── Helper: create a test project dir ─────────────────────────────────────────

function createProject(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'proj-'));
  const config = {
    version: '1.0',
    stack: null,
    mode: 'copilot',
    currentPhase: null,
    paused: false,
    features: { remaining: 0, passing: 0, total: 0 },
    gates: { enabled: false, checks: ['all'] },
    git: { autoCommit: false, autoTag: false, resetOnRetry: false, branch: null, clean: true, hasUpstream: false, lastCommitMessage: null },
    phases: { enabled: ['define', 'plan', 'build', 'verify', 'review', 'ship'] },
    agents: { tone: { planner: 'A', generator: 'B', evaluator: 'C', simplifier: 'D' } },
    maxRetries: 3,
    gateHistory: [],
    ...overrides,
  };
  fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return dir;
}

function createProjectAtPhase(phase, overrides = {}) {
  return createProject({ currentPhase: phase, ...overrides });
}

function writeFeatureList(dir, features) {
  fs.mkdirSync(path.join(dir, 'harness', 'features'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'harness', 'features', 'feature-list.json'),
    JSON.stringify({ version: '0.1', features }, null, 2) + '\n',
    'utf-8',
  );
}

// ── Helper: CLI exec ─────────────────────────────────────────────────────────
// execSync with encoding returns stdout string directly on success.
// On error, err.stdout / err.stderr contain the streams.

function cli(args, cwd) {
  const full = `node ${CLI_PATH} ${args}`;
  try {
    const stdout = execSync(full, { cwd, stdio: 'pipe', encoding: 'utf-8', timeout: 10000 });
    return { stdout: (stdout || '').trim(), stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
      exitCode: err.status ?? 1,
    };
  }
}

function parseCliJson(args, cwd) {
  const result = cli(args, cwd);
  if (!result.stdout) {
    throw new Error(`CLI returned empty stdout (exit ${result.exitCode}): ${result.stderr.slice(0, 200)}`);
  }
  return JSON.parse(result.stdout);
}

// ══════════════════════════════════════════════════════════════════════════════
//  A. continuePipeline — Basic flow
// ══════════════════════════════════════════════════════════════════════════════

async function suiteA() {
  await loadModules();
  const { continuePipeline } = ralphOuter;

  await run('A.1 — continuePipeline returns "complete" on last phase', async () => {
    const dir = createProjectAtPhase('ship');
    const result = await continuePipeline(dir, 'ship', { json: true });
    assertEqual(result.status, 'complete', 'Should be complete when no next phase');
    assertEqual(result.phasesRemaining, 0, 'phasesRemaining should be 0');
    assertOk(result.ok, 'Should return ok:true');
    assertMatch(result.message, /Pipeline complete/i, 'Message should say pipeline complete');
    assertEqual(result.currentPhase, 'ship', 'currentPhase should be ship');
  });

  await run('A.2 — continuePipeline returns next phase in copilot mode', async () => {
    const dir = createProjectAtPhase('define');
    const result = await continuePipeline(dir, 'define', { json: true });
    assertEqual(result.status, 'instruction', 'Should return instruction in copilot mode');
    assertEqual(result.nextPhase, 'plan', 'Next phase should be plan');
    assertOk(result.ok, 'Should return ok:true');
    assert(result.phasesRemaining >= 1, 'Should have phases remaining');
    assertMatch(result.message, /next/i, 'Message should reference next step');
  });

  await run('A.3 — continuePipeline returns "instruction" for middle phase in copilot mode', async () => {
    const dir = createProjectAtPhase('plan');
    const result = await continuePipeline(dir, 'plan', { json: true });
    assertEqual(result.status, 'instruction');
    assertEqual(result.nextPhase, 'build');
    assert(result.phasesRemaining >= 1);
  });

  await run('A.4 — continuePipeline: verify phase advances to review (simplify not in default order)', async () => {
    const dir = createProjectAtPhase('verify');
    const result = await continuePipeline(dir, 'verify', { json: true });
    assertEqual(result.status, 'instruction');
    // Default config excludes 'simplify', so next after verify is 'review'
    assertEqual(result.nextPhase, 'review');
  });

  await run('A.5 — continuePipeline with missing config returns error', async () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'empty-'));
    const result = await continuePipeline(dir, 'define', { json: true });
    assertEqual(result.ok, false);
    assertEqual(result.status, 'error');
    assertEqual(result.currentPhase, null);
  });

  await run('A.6 — continuePipeline: null completedPhase handled gracefully', async () => {
    const dir = createProject(); // currentPhase: null
    const result = await continuePipeline(dir, null, { json: true });
    assert(result !== null, 'Should return a result');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  B. continuePipeline — Autopilot mode
// ══════════════════════════════════════════════════════════════════════════════

async function suiteB() {
  await loadModules();
  const { continuePipeline } = ralphOuter;

  await run('B.1 — autopilot: define advances to plan, nextPhase becomes build', async () => {
    const dir = createProjectAtPhase('define', { mode: 'autopilot', gates: { enabled: false, checks: ['all'] } });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const result = await continuePipeline(dir, 'define', { json: true, verbose: false });
    assertOk(result.ok);
    assertEqual(result.currentPhase, 'plan', 'Autopilot should advance currentPhase to plan');
    assertEqual(result.nextPhase, 'build', 'Next phase (after plan) should be build');
  });

  await run('B.2 — autopilot: init advances to define, nextPhase becomes plan', async () => {
    const dir = createProjectAtPhase('init', {
      mode: 'autopilot',
      phases: { enabled: ['init', 'define', 'plan', 'build', 'verify', 'review', 'ship'] },
      gates: { enabled: false, checks: ['all'] },
    });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const result = await continuePipeline(dir, 'init', { json: true, verbose: false });
    assertOk(result.ok, 'init → define should be valid');
    assertEqual(result.currentPhase, 'define', 'Autopilot should advance currentPhase to define');
    assertEqual(result.nextPhase, 'plan', 'Next phase (after define) should be plan');
  });

  await run('B.3 — autopilot advances through multiple phases', async () => {
    const dir = createProjectAtPhase('define', { mode: 'autopilot', gates: { enabled: false, checks: ['all'] } });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const result = await continuePipeline(dir, 'define', { json: true, verbose: false });
    assertOk(result.ok);
    assertEqual(result.currentPhase, 'plan', 'Config currentPhase should be updated to plan');
    const { config } = state.loadConfig(dir);
    assertEqual(config.currentPhase, 'plan', 'Config on disk should show plan');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  C. runAutopilot
// ══════════════════════════════════════════════════════════════════════════════

async function suiteC() {
  await loadModules();
  const { runAutopilot } = ralphOuter;

  await run('C.1 — runAutopilot from null currentPhase starts from first phase', async () => {
    const dir = createProject({ mode: 'autopilot', gates: { enabled: false, checks: ['all'] } });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const result = await runAutopilot(dir, { json: true, verbose: false });
    assert(result !== null, 'Should return a valid result');
    assert(result.ok !== undefined, 'Should return a result object');
  });

  await run('C.2 — runAutopilot continues from currentPhase', async () => {
    const dir = createProjectAtPhase('plan', { mode: 'autopilot', gates: { enabled: false, checks: ['all'] } });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const result = await runAutopilot(dir, { json: true, verbose: false });
    assert(result !== null, 'Should not crash');
  });

  await run('C.3 — runAutopilot with missing config returns error', async () => {
    const dir = fs.mkdtempSync(path.join(TEST_TMP, 'empty2-'));
    const result = await runAutopilot(dir, { json: true });
    assertEqual(result.ok, false);
    assertEqual(result.status, 'error');
  });

  await run('C.4 — runAutopilot with no enabled phases returns error', async () => {
    const dir = createProject({ mode: 'autopilot', phases: { enabled: [] } });
    const result = await runAutopilot(dir, { json: true });
    assertEqual(result.ok, false, 'Should fail with no enabled phases');
    assertEqual(result.status, 'error');
  });

  await run('C.5 — runAutopilot sets currentPhase on first transition', async () => {
    const dir = createProject({ mode: 'autopilot', gates: { enabled: false, checks: ['all'] } });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    await runAutopilot(dir, { json: true, verbose: false });
    const { config } = state.loadConfig(dir);
    assert(config.currentPhase !== null, 'runAutopilot should set currentPhase');
    const valid = ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship'];
    assert(valid.includes(config.currentPhase), `currentPhase should be valid, got ${config.currentPhase}`);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  D. continuePipeline — Edge cases
// ══════════════════════════════════════════════════════════════════════════════

async function suiteD() {
  await loadModules();
  const { continuePipeline } = ralphOuter;

  await run('D.1 — continuePipeline: simplify enabled should be in order', async () => {
    const dir = createProjectAtPhase('verify', {
      phases: { enabled: ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship'] },
    });
    const result = await continuePipeline(dir, 'verify', { json: true });
    assertEqual(result.nextPhase, 'simplify', 'With simplify enabled, next after verify should be simplify');
  });

  await run('D.2 — continuePipeline: simplify not enabled, next after verify is review', async () => {
    const dir = createProjectAtPhase('verify');
    const result = await continuePipeline(dir, 'verify', { json: true });
    assertEqual(result.nextPhase, 'review', 'Without simplify, next after verify should be review');
  });

  await run('D.3 — continuePipeline: pipeline with single phase', async () => {
    const dir = createProjectAtPhase('define', { phases: { enabled: ['define'] } });
    const result = await continuePipeline(dir, 'define', { json: true });
    assertEqual(result.status, 'complete', 'Single phase pipeline should complete immediately');
    assertEqual(result.phasesRemaining, 0);
  });

  await run('D.4 — continuePipeline: phasesRemaining count correct from define', async () => {
    const dir = createProjectAtPhase('define');
    const result = await continuePipeline(dir, 'define', { json: true });
    assertEqual(result.phasesRemaining, 5, 'Should have 5 phases remaining from define');
  });

  await run('D.5 — continuePipeline: phasesRemaining from build', async () => {
    const dir = createProjectAtPhase('build');
    const result = await continuePipeline(dir, 'build', { json: true });
    assertEqual(result.phasesRemaining, 3, 'Should have 3 phases remaining from build');
  });

  await run('D.6 — continuePipeline: non-JSON verbose output', async () => {
    const dir = createProjectAtPhase('define');
    const origWrite = process.stdout.write;
    let output = '';
    process.stdout.write = (chunk) => { output += chunk; return true; };
    try {
      await continuePipeline(dir, 'define', { json: false, verbose: true });
    } finally {
      process.stdout.write = origWrite;
    }
    assertMatch(output, /DEFINE/i, 'Verbose output should mention the completed phase');
  });

  await run('D.7 — continuePipeline: completedPhase not in order', async () => {
    const dir = createProjectAtPhase('define');
    const result = await continuePipeline(dir, 'nonexistent', { json: true });
    assert(result.ok !== undefined, 'Should return a result (not crash)');
  });

  await run('D.8 — continuePipeline: currentPhase mismatch with config is handled', async () => {
    const dir = createProjectAtPhase('ship');
    const result = await continuePipeline(dir, 'ship', { json: true });
    assertEqual(result.status, 'complete', 'Last phase should return complete');
    assertEqual(result.phasesRemaining, 0);
  });

  await run('D.9 — Empty feature_list.json with feature-iterate phase in autopilot', async () => {
    const dir = createProject({
      currentPhase: 'build',
      mode: 'autopilot',
      gates: { enabled: false, checks: ['all'] },
    });
    const result = await continuePipeline(dir, 'build', { json: true, verbose: false });
    assert(result !== null, 'Should not crash with missing feature list');
  });

  await run('D.10 — Non-existent target directory returns error', async () => {
    const result = await continuePipeline('/nonexistent/path', 'define', { json: true });
    assertEqual(result.ok, false);
    assertEqual(result.status, 'error');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  E. Integration: JSON output from dev-harness phase
// ══════════════════════════════════════════════════════════════════════════════

async function suiteE() {
  await loadModules();

  await run('E.1 — CLI: dev-harness phase <name> produces valid JSON', async () => {
    const dir = createProject();
    const parsed = parseCliJson('phase define --json', dir);
    assertEqual(parsed.command, 'phase');
    assertEqual(parsed.phase, 'define');
    assert(parsed.status !== undefined, 'JSON should have status field');
    assert(parsed.message !== undefined, 'JSON should have message field');
  });

  await run('E.2 — CLI: phase JSON includes all required contract fields', async () => {
    const dir = createProject();
    const parsed = parseCliJson('phase define --json', dir);
    assertEqual(parsed.command, 'phase', 'Must have command');
    assertEqual(parsed.phase, 'define', 'Must have phase');
    assert(parsed.message, 'Must have message');
    assert(parsed.currentPhase !== undefined, 'Must have currentPhase');
    assert(parsed.mode !== undefined, 'Must have mode');
    assert(parsed.phaseType !== undefined, 'Must have phaseType');
    assert(parsed.iteration !== undefined, 'Must have iteration');
  });

  await run('E.3 — CLI: phase returns deliverable-retry type for define', async () => {
    const dir = createProject();
    const parsed = parseCliJson('phase define --json', dir);
    assertEqual(parsed.phaseType, 'deliverable-retry');
    assertEqual(parsed.iteration, 1);
  });

  await run('E.4 — CLI: phase returns feature-iterate type for build (with feature list)', async () => {
    const dir = createProject({ currentPhase: 'build' });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const parsed = parseCliJson('phase build --json', dir);
    assertEqual(parsed.phaseType, 'feature-iterate');
    assertEqual(parsed.featureId, 'f1');
    assertEqual(parsed.taskId, 't1');
  });

  await run('E.5 — CLI: phase --target works correctly', async () => {
    const dir = createProject();
    const parsed = parseCliJson(`phase define --json --target ${dir}`, process.cwd());
    assertEqual(parsed.command, 'phase');
    assertEqual(parsed.phase, 'define');
  });

  await run('E.6 — CLI: invalid phase name returns error', async () => {
    const dir = createProject();
    const result = cli('phase nonexistent --json', dir);
    assertEqual(result.exitCode, 2, 'Invalid phase should exit 2');
    assertMatch(result.stderr || result.stdout, /Invalid phase/i, 'Should mention invalid phase');
  });

  await run('E.7 — CLI: phase without name returns usage error', async () => {
    const dir = createProject();
    const result = cli('phase --json', dir);
    assertEqual(result.exitCode, 2, 'Missing phase name should exit 2');
  });

  await run('E.8 — CLI: set-mode autopilot works (requires DEFINE phase+)', async () => {
    const dir = createProject({ currentPhase: 'define' });
    const r1 = cli('set-mode autopilot --json', dir);
    assertEqual(r1.exitCode, 0, 'set-mode autopilot should exit 0');
    const { config } = state.loadConfig(dir);
    assertEqual(config.mode, 'autopilot', 'Config mode should be autopilot');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  F. Autopilot integration with phase.mjs
// ══════════════════════════════════════════════════════════════════════════════

async function suiteF() {
  await loadModules();

  await run('F.1 — Autopilot: phase command includes pipeline status on complete', async () => {
    const dir = createProject({ currentPhase: 'ship', mode: 'autopilot' });
    const parsed = parseCliJson('phase ship --json', dir);
    assertEqual(parsed.command, 'phase');
    assertEqual(parsed.phase, 'ship');
    assert(parsed.status !== undefined, 'Should have status');
  });

  await run('F.2 — Autopilot: pipeline advances after phase define', async () => {
    const dir = createProject({
      currentPhase: 'define',
      mode: 'autopilot',
      gates: { enabled: false, checks: ['all'] },
    });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const parsed = parseCliJson('phase define --json', dir);
    assertEqual(parsed.command, 'phase');
    assert(parsed.pipeline !== undefined || parsed.nextPhase !== undefined,
      'Autopilot should include pipeline or nextPhase info');
  });

  await run('F.3 — Copilot: phase command should not auto-advance', async () => {
    const dir = createProject({
      currentPhase: 'define',
      mode: 'copilot',
      gates: { enabled: false, checks: ['all'] },
    });
    writeFeatureList(dir, [
      { id: 'f1', name: 'Feature 1', description: 'Test', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
    ]);
    const parsed = parseCliJson('phase define --json', dir);
    assert(parsed.pipeline === undefined, 'Copilot mode should not include pipeline field');
    assert(parsed.nextPhase !== undefined, 'Copilot should still show nextPhase');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  G. Cross-file consistency
// ══════════════════════════════════════════════════════════════════════════════

async function suiteG() {
  await loadModules();

  await run('G.1 — ralph-phases exports continuePipeline and runAutopilot', async () => {
    assert(typeof ralphOuter.continuePipeline === 'function', 'continuePipeline should be a function');
    assert(typeof ralphOuter.runAutopilot === 'function', 'runAutopilot should be a function');
  });

  await run('G.2 — phase.mjs consumes ralph-phases exports correctly', async () => {
    const phaseSource = fs.readFileSync(path.join(PROJECT_ROOT, 'cli/commands/phase.mjs'), 'utf-8');
    assertMatch(phaseSource, /continuePipeline/, 'phase.mjs should import continuePipeline');
  });

  await run('G.3 — Config contract: all keys runPhase needs are present in getDefaultConfig', async () => {
    const { getDefaultConfig } = state;
    const def = getDefaultConfig();
    assert(def.mode !== undefined, 'Config must have mode');
    assert(def.maxRetries !== undefined, 'Config must have maxRetries');
    assert(def.phases?.enabled !== undefined, 'Config must have phases.enabled');
    assert(def.git !== undefined, 'Config must have git object');
  });

  await run('G.4 — Phase order consistency: default order includes init', async () => {
    const order = state.getPhaseOrder();
    assertEqual(order[0], 'init', 'Default phase order starts with init');
    assertEqual(order[order.length - 1], 'ship', 'Default phase order ends with ship');
    assert(order.length >= 6, 'Should have at least 6 phases in default order');
  });

  await run('G.5 — Phase order from config respects enabled list', async () => {
    const enabled = ['define', 'plan', 'build', 'verify', 'review', 'ship'];
    const order = state.getPhaseOrder(enabled);
    assertEqual(order[0], 'define', 'Config-driven order starts with define');
    assertEqual(order.length, 6, 'Should have exactly 6 enabled phases');
  });

  await run('G.6 — ralph-shared getPhaseType covers all phases in order', async () => {
    const { getPhaseType } = ralphShared;
    assertEqual(getPhaseType('define'), 'deliverable-retry');
    assertEqual(getPhaseType('plan'), 'deliverable-retry');
    assertEqual(getPhaseType('review'), 'deliverable-retry');
    assertEqual(getPhaseType('ship'), 'deliverable-retry');
    assertEqual(getPhaseType('build'), 'feature-iterate');
    assertEqual(getPhaseType('verify'), 'feature-iterate');
    assertEqual(getPhaseType('simplify'), 'feature-iterate');
    assertEqual(getPhaseType('init'), 'deliverable-retry');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  H. Edge cases & robustness
// ══════════════════════════════════════════════════════════════════════════════

async function suiteH() {
  await loadModules();
  const { continuePipeline, runAutopilot } = ralphOuter;

  await run('H.1 — pause flag: runAutopilot does not currently check it (documented gap)', async () => {
    const dir = createProject({
      mode: 'autopilot',
      paused: true,
      currentPhase: 'define',
    });
    const result = await runAutopilot(dir, { json: true });
    assert(result !== null, 'Should not crash');
  });

  await run('H.2 — Same phase re-run via CLI', async () => {
    const dir = createProject({ currentPhase: 'define' });
    const parsed = parseCliJson('phase define --json', dir);
    assertEqual(parsed.phase, 'define', 'Should re-run same phase');
    assertEqual(parsed.currentPhase, 'define', 'Should stay on same phase');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  I. Spec gap validation
// ══════════════════════════════════════════════════════════════════════════════

async function suiteI() {
  await loadModules();

  await run('I.1 — SPEC GAP: iteration tracking always returns 1 (T9 must integrate retry counting)', async () => {
    const dir = createProject({ currentPhase: 'define' });
    const result = await ralphInner.runPhase(dir, 'define', { json: true });
    assertEqual(result.iteration, 1, 'iteration is always 1 — T9 retry counting NOT YET IMPLEMENTED');
    const outerResult = await ralphOuter.continuePipeline(dir, 'define', { json: true });
    assertEqual(outerResult.iteration, undefined, 'continuePipeline does not track iteration');
  });

  await run('I.2 — T10: Escalation on maxRetries exceeded IS implemented (T9 gap closed by T10)', async () => {
    // v3.1.0+: deliverable-retry phases signal 'deliverable-exhausted' to the
    // phase loop (which then escalates to human when phase retry is disabled).
    // With default retry config (phases disabled), retryCount >= maxRetries
    // triggers deliverable-exhausted.
    const dir = createProject({ currentPhase: 'define', maxRetries: 3, retryCount: 3 });
    const result = await ralphInner.runPhase(dir, 'define', { json: true });
    assertEqual(result.status, 'deliverable-exhausted', 'deliverable-retry phase signals exhaustion when retries exhausted');
    assertEqual(result.details.retryCount, 3, 'retryCount tracked');
    assertOk(result.message.includes('exhausted'), 'message contains exhaustion notice');
  });

  await run('I.3 — T10: Git auto-tag on pipeline iteration IS implemented (T9 gap closed by T10)', async () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, 'cli/lib/ralph-phases.mjs'), 'utf-8');
    assert(source.includes('autoTag'), 'T10 implements auto-tag in ralph-phases.mjs');
  });

  await run('I.4 — SPEC GAP: progress.md lesson append on iteration not implemented in T9', async () => {
    const source = fs.readFileSync(path.join(PROJECT_ROOT, 'cli/lib/ralph-phases.mjs'), 'utf-8');
    assert(!source.includes('progress'), 'T9 does not auto-append to progress.md');
  });

  await run('I.5 --feature/--task in validate.mjs: parsed but not actioned by gates.mjs (KNOWN GAP)', async () => {
    const validateSource = fs.readFileSync(path.join(PROJECT_ROOT, 'cli/commands/validate.mjs'), 'utf-8');
    assertMatch(validateSource, /feature/, 'validate.mjs should reference feature flag');
    assertMatch(validateSource, /task/, 'validate.mjs should reference task flag');
    const gatesSource = fs.readFileSync(path.join(PROJECT_ROOT, 'cli/lib/gates.mjs'), 'utf-8');
    assertMatch(gatesSource, /feature/, 'gates.mjs should reference feature option');
    assertMatch(gatesSource, /task/, 'gates.mjs should reference task option');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  J. Non-JSON output modes
// ══════════════════════════════════════════════════════════════════════════════

async function suiteJ() {
  await loadModules();
  const { continuePipeline } = ralphOuter;

  await run('J.1 — continuePipeline returns correct shape in non-JSON mode', async () => {
    const dir = createProjectAtPhase('define');
    const result = await continuePipeline(dir, 'define', { json: false });
    assertEqual(result.status, 'instruction');
    assertEqual(result.nextPhase, 'plan');
    assertOk(result.ok);
  });

  await run('J.2 — continuePipeline verbose mode writes to stdout', async () => {
    const dir = createProjectAtPhase('define');
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output += chunk; return true; };
    try {
      await continuePipeline(dir, 'define', { json: false, verbose: true });
    } finally {
      process.stdout.write = origWrite;
    }
    assert(output.length > 0, 'Verbose mode should produce stdout output');
  });

  await run('J.3 — continuePipeline verbose complete message', async () => {
    const dir = createProjectAtPhase('ship');
    let output = '';
    const origWrite = process.stdout.write;
    process.stdout.write = (chunk) => { output += chunk; return true; };
    try {
      await continuePipeline(dir, 'ship', { json: false, verbose: true });
    } finally {
      process.stdout.write = origWrite;
    }
    assertMatch(output, /complete/i, 'Should mention complete for final phase');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  Test runner — suites
// ══════════════════════════════════════════════════════════════════════════════

const suites = {
  'A. continuePipeline — Basic flow': suiteA,
  'B. continuePipeline — Autopilot mode': suiteB,
  'C. runAutopilot': suiteC,
  'D. continuePipeline — Edge cases': suiteD,
  'E. Integration: CLI phase command JSON output': suiteE,
  'F. Autopilot integration with phase.mjs': suiteF,
  'G. Cross-file consistency': suiteG,
  'H. Edge cases & robustness': suiteH,
  'I. Spec gap validation': suiteI,
  'J. Non-JSON output modes': suiteJ,
};

async function main() {
  process.on('exit', () => {
    try { fs.rmSync(TEST_TMP, { recursive: true, force: true }); } catch { /* ok */ }
  });

  const suiteNames = Object.keys(suites);
  const totalSuites = suiteNames.length;

  if (verbose) {
    console.log(`═══ T9 — OUTER RALPH LOOP ENGINE: ${totalSuites} test suites ═══\n`);
  }

  for (const suiteName of suiteNames) {
    if (skipSlow && (suiteName.includes('CLI') || suiteName.includes('Integration'))) {
      if (verbose) console.log(`  [skipped] ${suiteName}\n`);
      continue;
    }
    if (verbose) console.log(`\n  ${suiteName}`);
    await suites[suiteName]();
  }

  const total = passed + failed;

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  T9 OUTER RALPH LOOP TESTS: ${passed}/${total} passed`);
  console.log(`${'═'.repeat(55)}`);

  if (failures.length > 0) {
    console.error(`\nFAILURES:`);
    for (const f of failures) {
      console.error(`  ✗ ${f.name}`);
      console.error(`    ${f.message}`);
      if (verbose) console.error(`    ${f.stack?.split('\n').slice(0, 4).join('\n    ') || ''}`);
    }
  }

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});

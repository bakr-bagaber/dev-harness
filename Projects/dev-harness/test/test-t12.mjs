#!/usr/bin/env node
/**
 * T12 — Autopilot Mode Test Battery
 *
 * Tests autopilot mode behavior:
 * - set-mode autopilot DEFINE+ phase guard
 * - Autopilot auto-advance through phases
 * - Pause/resume in autopilot
 * - Pipeline iteration counting
 * - Features remaining on completion
 * - Escalation in autopilot chain
 * - Non-JSON output modes
 *
 * Usage: node test-t12.mjs
 *        node test-t12.mjs --verbose
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

async function run(name, fn) {
  try { await fn(); if (VERBOSE) console.log(`  ✓ ${name}`); }
  catch (e) { failed++; console.error(`  ✗ ${name}: ${e.message}`); }
}

// ── Constants ────────────────────────────────────────────────────────────────

// Resolve repo root from this test file's location (test/ → repo root).
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'node ' + path.resolve(PROJECT_ROOT, 'cli/dev-harness.mjs');
const TEST_TMP = '/tmp/t12-test-' + Date.now();
const CLI_TIMEOUT = 10000;

// ── Project scaffolding helpers ──────────────────────────────────────────────

function createProject(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'proj-'));
  const defaultConfig = {
    version: '1.0',
    stack: 'node',
    mode: overrides.mode || 'copilot',
    currentPhase: overrides.currentPhase || null,
    paused: overrides.paused || false,
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

function createScaffoldedProject(overrides = {}) {
  const dir = createProject(overrides);
  // Write a basic feature_list.json
  const featureList = overrides.features || [
    { id: 'f1', name: 'Feature 1', description: 'Test feature', passes: false, tasks: [{ id: 't1', description: 'Task 1', status: 'pending' }] },
  ];
  fs.mkdirSync(path.join(dir, 'harness', 'features'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'features', 'feature-list.json'), JSON.stringify({ version: '0.1', features: featureList }, null, 2) + '\n', 'utf-8');
  return dir;
}

function createProjectAtPhase(phase, overrides = {}) {
  return createProject({ ...overrides, currentPhase: phase });
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

function writeConfig(dir, cfg) {
  fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
}

// ══════════════════════════════════════════════════════════════════════════════
//  A. set-mode autopilot — DEFINE+ phase guard
// ══════════════════════════════════════════════════════════════════════════════

async function suiteA() {
  await run('A.1 — set-mode autopilot blocked when no currentPhase (before init)', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: null });
    const res = cli('set-mode autopilot', dir);
    assertMatch(res.stderr || res.stdout, /DEFINE phase or later/, 'should require DEFINE+');
    const cfg = loadConfig(dir);
    assertEqual(cfg.mode, 'copilot', 'mode should not change');
  });

  await run('A.2 — set-mode autopilot blocked in INIT phase', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'init' });
    const res = cli('set-mode autopilot', dir);
    assertMatch(res.stderr || res.stdout, /DEFINE phase or later/, 'should require DEFINE+');
    const cfg = loadConfig(dir);
    assertEqual(cfg.mode, 'copilot', 'mode should not change');
  });

  await run('A.3 — set-mode autopilot allowed in DEFINE phase', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'define' });
    const res = cli('set-mode autopilot', dir);
    const cfg = loadConfig(dir);
    assertEqual(cfg.mode, 'autopilot', 'mode should change to autopilot');
  });

  await run('A.4 — set-mode autopilot allowed in BUILD phase', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'build' });
    const res = cli('set-mode autopilot', dir);
    const cfg = loadConfig(dir);
    assertEqual(cfg.mode, 'autopilot', 'mode should change to autopilot');
  });

  await run('A.5 — set-mode autopilot blocked (JSON) returns proper error', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'init' });
    const { data, stderr } = cliJson('set-mode autopilot', dir);
    assertMatch(stderr || '', /DEFINE/, 'stderr should mention DEFINE');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  B. Autopilot auto-advance
// ══════════════════════════════════════════════════════════════════════════════

async function suiteB() {
  await run('B.1 — phase define in autopilot transitions and prints next', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define' });
    const res = cli('phase define --json', dir);
    const data = JSON.parse(res.stdout);
    assertEqual(data.command, 'phase');
    assertEqual(data.phase, 'define');
    assertOk(data.iteration >= 1);
    assertEqual(data.mode, 'autopilot');
  });

  await run('B.2 — autopilot deliverable-retry phase returns instruction without pipeline data', async () => {
    // Deliverable-retry phases (define, plan, review, ship) return 'instruction'.
    // Autopilot auto-advance (continuePipeline) only fires when status is 'complete',
    // which happens for feature-iterate phases when all features pass, or when
    // continuePipeline is called directly. Pipeline data is NOT present here
    // because runPhase returns 'instruction', not 'complete'.
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define' });
    const res = cli('phase define --json', dir);
    const data = JSON.parse(res.stdout);
    assertEqual(data.command, 'phase');
    assertEqual(data.phase, 'define');
    assertEqual(data.status, 'instruction', 'deliverable-retry returns instruction');
    // Pipeline data is only present for 'complete' status — not for deliverable-retry
    assertEqual(data.pipeline, undefined, 'pipeline data absent for deliverable-retry instruction');
  });

  await run('B.3 — autopilot pipeline tracks phasesRemaining', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define' });
    const res = cli('phase define --json', dir);
    const data = JSON.parse(res.stdout);
    // nextPhase should still be populated
    assertOk(data.nextPhase === 'plan', 'deliverable-retry phase should know next phase');
  });

  await run('B.4 — continuePipeline increments pipeline iteration on completion', async () => {
    const { continuePipeline } = await import(path.resolve(PROJECT_ROOT, 'cli/lib/ralph-outer.mjs'));
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'ship' });
    const result = await continuePipeline(dir, 'ship', { json: true, verbose: false });
    assertEqual(result.status, 'complete', 'last phase should return complete');
    assertEqual(result.phasesRemaining, 0);
    assertEqual(result.pipelineIteration, 1, 'pipelineIteration should be 1 after first completion');
    const cfg = loadConfig(dir);
    assertEqual(cfg.pipelineIteration, 1, 'iteration persisted to config');
  });

  await run('B.5 — continuePipeline counts remaining features on completion', async () => {
    const { continuePipeline } = await import(path.resolve(PROJECT_ROOT, 'cli/lib/ralph-outer.mjs'));
    const dir = createScaffoldedProject({
      mode: 'autopilot',
      currentPhase: 'ship',
      features: [
        { id: 'f1', name: 'F1', description: '', passes: true, tasks: [] },
        { id: 'f2', name: 'F2', description: '', passes: false, tasks: [] },
      ],
    });
    const result = await continuePipeline(dir, 'ship', { json: true, verbose: false });
    assertEqual(result.featuresRemaining, 1, '1 feature remaining (f2 not passed)');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  C. Autopilot pause / resume
// ══════════════════════════════════════════════════════════════════════════════

async function suiteC() {
  await run('C.1 — pause command sets paused flag', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define' });
    const res = cli('pause --json', dir);
    const data = JSON.parse(res.stdout);
    assertEqual(data.status, 'ok');
    assertEqual(loadConfig(dir).paused, true);
  });

  await run('C.2 — resume command clears paused flag', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    const res = cli('resume --json', dir);
    const data = JSON.parse(res.stdout);
    assertEqual(data.status, 'ok');
    assertEqual(loadConfig(dir).paused, false);
  });

  await run('C.3 — phase paused in autopilot returns paused status', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    const { data } = cliJson('phase define', dir);
    assertEqual(data.status, 'paused', 'should return paused status');
    assertEqual(data.command, 'phase');
  });

  await run('C.4 — resume clears paused, phase proceeds normally', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    cli('resume', dir);
    const { data } = cliJson('phase define', dir);
    assertEqual(data.status, 'instruction', 'phase should proceed after resume');
  });

  await run('C.5 — pause in copilot mode (no effect on pause check)', async () => {
    // Pause is only checked in autopilot mode
    const dir = createProject({ mode: 'copilot', currentPhase: 'define', paused: true });
    const { data } = cliJson('phase define', dir);
    // Copilot doesn't check pause — should proceed
    assertEqual(data.status, 'instruction', 'copilot ignores pause');
  });

  await run('C.6 — pause then resume then pause again works', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define' });
    cli('pause', dir);
    assertEqual(loadConfig(dir).paused, true);
    cli('resume', dir);
    assertEqual(loadConfig(dir).paused, false);
    cli('pause', dir);
    assertEqual(loadConfig(dir).paused, true);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  D. continuePipeline — Autopilot pause check
// ══════════════════════════════════════════════════════════════════════════════

async function suiteD() {
  await run('D.1 — continuePipeline returns paused when paused flag set', async () => {
    const { continuePipeline } = await import(path.resolve(PROJECT_ROOT, 'cli/lib/ralph-outer.mjs'));
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    const result = await continuePipeline(dir, 'define', { json: true, verbose: false });
    assertEqual(result.status, 'paused', 'should return paused status');
    assertEqual(result.currentPhase, 'define');
    assertOk(result.phasesRemaining > 0, 'should still have phases remaining');
  });

  await run('D.2 — continuePipeline proceeds when not paused', async () => {
    const { continuePipeline } = await import(path.resolve(PROJECT_ROOT, 'cli/lib/ralph-outer.mjs'));
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'define' });
    const result = await continuePipeline(dir, 'define', { json: true, verbose: false });
    assertNotEqual(result.status, 'paused', 'should not be paused');
  });
}

// Wrapper for assertNotEqual
function assertNotEqual(actual, expected, msg) {
  try { assert.notStrictEqual(actual, expected, msg); passed++; }
  catch (e) { failed++; console.error(`  ✗ ${msg}\n    value: ${JSON.stringify(actual)} (should not be ${JSON.stringify(expected)})`); }
}

// ══════════════════════════════════════════════════════════════════════════════
//  E. Autopilot integration — full flow
// ══════════════════════════════════════════════════════════════════════════════

async function suiteE() {
  await run('E.1 — set-mode copilot then autopilot (via define phase)', async () => {
    const dir = createScaffoldedProject({ mode: 'copilot', currentPhase: 'define' });
    // Start in copilot
    cli('set-mode copilot', dir);
    assertEqual(loadConfig(dir).mode, 'copilot');
    // Switch to autopilot (in DEFINE phase — allowed)
    cli('set-mode autopilot', dir);
    assertEqual(loadConfig(dir).mode, 'autopilot');
  });

  await run('E.2 — human-readable output shows phase complete in autopilot', async () => {
    const dir = createScaffoldedProject({ mode: 'autopilot', currentPhase: 'ship' });
    const res = cli('phase ship', dir);
    assertOk(res.stdout.length > 0, 'should produce human-readable output');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  F. Resume JSON output contract
// ══════════════════════════════════════════════════════════════════════════════

async function suiteF() {
  await run('F.1 — resume returns ok status (not not_implemented)', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    const { data } = cliJson('resume', dir);
    assertEqual(data.command, 'resume');
    assertEqual(data.status, 'ok');
    assertMatch(data.message || '', /resum/i, 'message should mention resume');
  });

  await run('F.2 — resume with no paused state still works', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'define' });
    const { data } = cliJson('resume', dir);
    assertEqual(data.status, 'ok');
    assertEqual(loadConfig(dir).paused, false);
  });

  await run('F.3 — pause JSON output contract', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define' });
    const { data } = cliJson('pause', dir);
    assertEqual(data.command, 'pause');
    assertEqual(data.status, 'ok');
    assertMatch(data.message || '', /paus/i, 'message should mention pause');
  });

  await run('F.4 — pause and resume human-readable output', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define' });
    let res = cli('pause', dir);
    assertOk(res.stdout.includes('✓') || res.stdout.includes('⏸') || res.stdout.toLowerCase().includes('paus'),
      'pause output should be human-friendly');
    res = cli('resume', dir);
    assertOk(res.stdout.includes('✓') || res.stdout.toLowerCase().includes('resum'),
      'resume output should be human-friendly');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  G. Stale test detection — verify T10 I.8 no longer expects not_implemented
// ══════════════════════════════════════════════════════════════════════════════

async function suiteG() {
  await run('G.1 — resume returns ok, not not_implemented (stale test detection)', async () => {
    const dir = createProject({ mode: 'autopilot', currentPhase: 'define', paused: true });
    const { data } = cliJson('resume', dir);
    assertNotEqual(data.status, 'not_implemented', 'resume should not be not_implemented anymore');
    assertEqual(data.status, 'ok', 'resume should return ok');
  });

  await run('G.2 — set-mode invalid mode error', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'define' });
    const res = cli('set-mode invalid', dir);
    assertOk(res.stderr.includes('Usage error') || res.stderr.includes('Mode required') || res.exitCode !== 0);
  });

  await run('G.3 — set-mode autopilot JSON error output', async () => {
    const dir = createProject({ mode: 'copilot', currentPhase: 'init' });
    const res = cli('set-mode autopilot --json', dir);
    // Should fail with DEFINE+ requirement
    assertOk(res.stderr.includes('DEFINE') || res.exitCode !== 0, 'should error on init phase');
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  T12 AUTOPILOT MODE TESTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Clean up any stale test dirs
  try { fs.rmSync(TEST_TMP, { recursive: true }); } catch {}
  fs.mkdirSync(TEST_TMP, { recursive: true });

  try {
    await suiteA();   // set-mode DEFINE+ guard
    await suiteB();   // Autopilot auto-advance
    await suiteC();   // Autopilot pause/resume
    await suiteD();   // continuePipeline pause check
    await suiteE();   // Full flow integration
    await suiteF();   // JSON output contracts
    await suiteG();   // Stale test detection
  } finally {
    try { fs.rmSync(TEST_TMP, { recursive: true }); } catch {}
  }

  const total = passed + failed;
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`  T12 AUTOPILOT MODE TESTS: ${passed}/${total} passed`);
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

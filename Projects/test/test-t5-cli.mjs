#!/usr/bin/env node
/**
 * T5 CLI Integration Tests
 *
 * Tests T5 commands: status, config, phase from the CLI entry point.
 */
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = path.resolve(path.dirname(process.argv[1]), '..', 'cli/dev-harness.mjs');
const TEST_TMP = fs.mkdtempSync(path.join(tmpdir(), 't5-cli-test-'));
let passed = 0;
let failed = 0;
const failures = [];

function run(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, message: err.message });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function exec(args, cwd) {
  return execSync(`node ${CLI} ${args}`, {
    cwd: cwd || TEST_TMP,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
  });
}

function execJson(args, cwd) {
  const out = execSync(`node ${CLI} ${args} --json`, {
    cwd: cwd || TEST_TMP,
    encoding: 'utf-8',
    stdio: 'pipe',
    timeout: 5000,
  });
  return JSON.parse(out.trim());
}

function execWithExit(args, cwd) {
  try {
    const out = execSync(`node ${CLI} ${args}`, {
      cwd: cwd || TEST_TMP,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000,
    });
    return { stdout: out, stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.status,
    };
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ── Create a project directory for testing ────────────────────────────────────

const PROJ = path.join(TEST_TMP, 'my-project');
fs.mkdirSync(PROJ, { recursive: true });

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-1: status command');
console.log('═══════════════════════════════════════════════════════════════');

run('CLI-1.1 — status with no config (human)', async () => {
  const out = exec(`status`, PROJ);
  assert(out.includes('No harness/config.json'), `should mention missing config:\n${out}`);
  assert(out.includes('harness Status'), `should show header:\n${out}`);
});

run('CLI-1.2 — status with no config (JSON)', async () => {
  const r = execJson(`status`, PROJ);
  assert(r.command === 'status', `wrong command: ${r.command}`);
  assert(r.status === 'ok', `wrong status: ${r.status}`);
  assert(r.currentPhase === null, 'currentPhase should be null');
  assert(r.mode === 'copilot', 'mode should be copilot');
  assert(r.gateStatus === 'disabled', 'gateStatus should be disabled');
  assert(r.git.clean === true, 'git clean should be true');
  assert(typeof r.maxRetries === 'number', 'maxRetries should be number');
});

run('CLI-1.3 — status with --target (no value) does not crash', async () => {
  const r = execWithExit(`status --target`, PROJ);
  // The T4 bug was bare --target causing exit code 3
  assert(r.exitCode === 0 || r.exitCode === 2,
    `bare --target should not crash (exit 3): got ${r.exitCode}\nstderr: ${r.stderr}`);
});

run('CLI-1.4 — status after init shows correct state', async () => {
  const p = path.join(TEST_TMP, 'CLI-1.4');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);
  const r = execJson(`status`, p);
  assert(r.command === 'status', `wrong command: ${r.command}`);
  assert(r.status === 'ok', `wrong status: ${r.status}`);
  assert(r.stack === 'node', `expected node stack, got ${r.stack}`);
  assert(r.currentPhase === null, 'currentPhase should be null after init');
  assert(r.gateStatus === 'disabled', 'gateStatus should be disabled');
});

// ──────────────────────────────────────────────────────────────────────────────
// CLI-2: config get/set
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-2: config command');
console.log('═══════════════════════════════════════════════════════════════');

run('CLI-2.1 — config get without init', async () => {
  const d = path.join(TEST_TMP, 'CLI-2.1');
  fs.mkdirSync(d, { recursive: true });
  // Config get without config returns status 'error' with default values
  const r = execJson(`config get`, d);
  assert(r.command === 'config', `wrong command: ${r.command}`);
  assert(r.status === 'error', `expected error, got ${r.status}`);
  // Should still have a useful message
  assert(typeof r.message === 'string' && r.message.length > 0, 'should have error message');
});

run('CLI-2.2 — config get specific key', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.2');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  const r = execJson(`config get mode`, p);
  assert(r.command === 'config', `wrong command: ${r.command}`);
  assert(r.subcommand === 'get', `wrong subcommand: ${r.subcommand}`);
  assert(r.value === 'copilot', `expected copilot, got ${r.value}`);
  assert(r.status === 'ok', `expected ok, got ${r.status}`);
});

run('CLI-2.3 — config get nested key', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.3');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  const r = execJson(`config get gates.enabled`, p);
  assert(r.value === false, `expected false, got ${JSON.stringify(r.value)}`);
});

run('CLI-2.4 — config set top-level value', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.4');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  const out = exec(`config set mode autopilot`, p);
  assert(out.includes('✓'), `set should show checkmark:\n${out}`);

  const verify = execJson(`config get mode`, p);
  assert(verify.value === 'autopilot', `mode should be autopilot, got ${verify.value}`);
});

run('CLI-2.5 — config set boolean (true)', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.5');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  exec(`config set gates.enabled true`, p);
  const verify = execJson(`config get gates.enabled`, p);
  assert(verify.value === true, `expected true, got ${JSON.stringify(verify.value)}`);
});

run('CLI-2.6 — config set number', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.6');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  exec(`config set maxRetries 7`, p);
  const verify = execJson(`config get maxRetries`, p);
  assert(verify.value === 7, `expected 7, got ${verify.value}`);
});

run('CLI-2.7 — config set nested value', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.7');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  exec(`config set git.autoCommit true`, p);
  const verify = execJson(`config get git.autoCommit`, p);
  assert(verify.value === true, `expected true, got ${verify.value}`);
});

run('CLI-2.8 — config set without subcommand gives usage error', async () => {
  const r = execWithExit(`config`, PROJ);
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
});

run('CLI-2.9 — config set without enough args gives usage error', async () => {
  const r = execWithExit(`config set mode`, PROJ);
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
});

run('CLI-2.10 — config get missing key returns status ok', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.10');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  const r = execJson(`config get nonexistent.key`, p);
  assert(r.status === 'ok', `expected ok, got ${r.status}`);
  // JSON.stringify omits undefined, so 'value' may be missing
  // This is acceptable — the key legitimately doesn't exist
});

run('CLI-2.11 — config get --> All (no key) shows full config', async () => {
  const p = path.join(TEST_TMP, 'CLI-2.11');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack python`, p);

  const r = execJson(`config get`, p);
  assert(r.status === 'ok', `expected ok, got ${r.status}`);
  assert(r.value.stack === 'python', `expected python stack, got ${r.value.stack}`);
});

run('CLI-2.12 — config set before init creates file', async () => {
  const d = path.join(TEST_TMP, 'CLI-2.12');
  fs.mkdirSync(d, { recursive: true });

  // Set a value before init
  const r = execWithExit(`config set mode autopilot`, d);
  assert(r.exitCode === 0, `expected exit 0, got ${r.exitCode}`);

  // File should exist now
  const configFile = path.join(d, 'harness', 'config.json');
  assert(fs.existsSync(configFile), 'config file should be created');

  // Verify value persisted
  const verify = execJson(`config get mode`, d);
  assert(verify.value === 'autopilot', `expected autopilot, got ${verify.value}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// CLI-3: phase command
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-3: phase command');
console.log('═══════════════════════════════════════════════════════════════');

run('CLI-3.1 — phase without argument gives usage error', async () => {
  const r = execWithExit(`phase`, PROJ);
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
  assert(r.stderr.includes('Phase name required'), 'should mention phase name required');
});

run('CLI-3.2 — phase with invalid name gives usage error', async () => {
  const r = execWithExit(`phase nope`, PROJ);
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
  assert(r.stderr.includes('Invalid phase'), 'should mention invalid phase');
});

run('CLI-3.3 — phase without config gives error', async () => {
  const d = path.join(TEST_TMP, 'CLI-3.3');
  fs.mkdirSync(d, { recursive: true });
  const r = execWithExit(`phase define`, d);
  // No config exists — transitionPhase returns error
  assert(r.exitCode !== 0, 'should exit non-zero without config');
});

run('CLI-3.4 — phase define succeeds with config', async () => {
  const p = path.join(TEST_TMP, 'CLI-3.4');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);

  const r = execJson(`phase define`, p);
  assert(r.command === 'phase', `wrong command: ${r.command}`);
  assert((r.status === 'ok' || r.status === 'instruction'), `expected ok/instruction, got ${r.status}`);
  assert(r.phase === 'define', `expected define, got ${r.phase}`);
  assert(r.currentPhase === 'define', `currentPhase should be define`);
  assert(r.mode === 'copilot', `mode should be copilot`);
  assert(typeof r.nextPhase === 'string', 'nextPhase should be a string');
});

run('CLI-3.5 — full pipeline phase transitions', async () => {
  const p = path.join(TEST_TMP, 'CLI-3.5');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack go`, p);

  const phases = ['define', 'plan', 'build', 'verify', 'review', 'ship'];
  for (const phase of phases) {
    const r = execJson(`phase ${phase}`, p);
    assert((r.status === 'ok' || r.status === 'instruction'), `${phase}: expected ok/instruction, got ${r.status}`);
    assert(r.currentPhase === phase, `${phase}: currentPhase mismatch`);
  }
});

run('CLI-3.6 — skip phase is rejected', async () => {
  const p = path.join(TEST_TMP, 'CLI-3.6');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);
  exec(`phase define`, p);

  const r = execWithExit(`phase verify`, p); // skip plan+build
  assert(r.exitCode === 1, `expected exit 1, got ${r.exitCode}`);
  assert(r.stderr.includes('Invalid transition'), 'should mention invalid transition');
});

run('CLI-3.7 — backward transition rejected', async () => {
  const p = path.join(TEST_TMP, 'CLI-3.7');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack node`, p);
  exec(`phase define`, p);
  exec(`phase plan`, p);

  const r = execWithExit(`phase define`, p); // backward
  assert(r.exitCode === 1, `expected exit 1, got ${r.exitCode}`);
  assert(r.stderr.includes('Invalid transition'), 'should mention invalid transition');
});

run('CLI-3.8 — JSON output contract (phase)', async () => {
  const p = path.join(TEST_TMP, 'CLI-3.8');
  fs.mkdirSync(p, { recursive: true });
  exec(`init --stack rust`, p);

  const r = execJson(`phase define`, p);
  // Contract: {command, status, message}
  assert(r.command === 'phase', `missing 'command' field`);
  assert((r.status === 'ok' || r.status === 'instruction'), `missing 'status' field: got ${r.status}`);
  assert(typeof r.message === 'string', `missing 'message' field`);
  // Extra fields: phase, currentPhase, mode, nextPhase
  assert(r.phase === 'define', 'missing phase');
  assert(r.currentPhase === 'define', 'missing currentPhase');
});

// ──────────────────────────────────────────────────────────────────────────────
// CLI-4: JSON output contract
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-4: JSON output contract verification');
console.log('═══════════════════════════════════════════════════════════════');

run('CLI-4.1 — --help JSON contract', async () => {
  const r = execJson(``, PROJ);  // no command → help
  assert(r.help === true, 'should have help=true');
  assert(typeof r.version === 'string', 'version should be string');
  assert(r.commands.status !== undefined, 'should list status command');
});

run('CLI-4.2 — --version JSON contract', async () => {
  try {
    const out = execSync(`node ${CLI} --version --json`, {
      cwd: PROJ, encoding: 'utf-8', timeout: 5000,
    });
    const r = JSON.parse(out.trim());
    assert(typeof r.version === 'string', 'version should be string');
  } catch (e) {
    const r = JSON.parse(e.stdout);
    assert(typeof r.version === 'string', 'version should be string');
  }
});

run('CLI-4.3 — unknown command JSON contract (stderr)', async () => {
  const r = execWithExit(`unknowncommand`, PROJ);
  // Should exit 2 (usage error)
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
  // Error goes to stderr
  assert(r.stderr.length > 0, 'stderr should have error message');
  // Try to parse stderr as JSON
  try {
    const parsed = JSON.parse(r.stderr.trim());
    // Error contract: should have error/message/exitCode
    assert(parsed.error !== undefined, 'error field missing');
    assert(parsed.message !== undefined, 'message field missing');
    assert(parsed.exitCode !== undefined, 'exitCode field missing');
  } catch {
    // Non-JSON stderr is also acceptable for human mode
    assert(r.stderr.includes('Unknown command'), 'should mention unknown command');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// CLI-5: --target flag
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-5: --target flag (all T5 commands)');
console.log('═══════════════════════════════════════════════════════════════');

run('CLI-5.1 — status --target <dir>', async () => {
  const d = path.join(TEST_TMP, 'CLI-5.1');
  fs.mkdirSync(d, { recursive: true });
  exec(`init --stack node`, d);

  const r = execJson(`status --target ${d}`, PROJ);
  assert(r.status === 'ok', `expected ok, got ${r.status}`);
  assert(r.stack === 'node', `expected node, got ${r.stack}`);
});

run('CLI-5.2 — config get --target <dir>', async () => {
  const d = path.join(TEST_TMP, 'CLI-5.2');
  fs.mkdirSync(d, { recursive: true });
  exec(`init --stack python`, d);

  const r = execJson(`config get mode --target ${d}`, PROJ);
  assert(r.value === 'copilot', `expected copilot, got ${r.value}`);
});

run('CLI-5.3 — config set --target <dir>', async () => {
  const d = path.join(TEST_TMP, 'CLI-5.3');
  fs.mkdirSync(d, { recursive: true });
  exec(`init --stack python`, d);

  exec(`config set mode autopilot --target ${d}`, PROJ);
  const verify = execJson(`config get mode --target ${d}`, PROJ);
  assert(verify.value === 'autopilot', `expected autopilot, got ${verify.value}`);
});

run('CLI-5.4 — phase --target <dir>', async () => {
  const d = path.join(TEST_TMP, 'CLI-5.4');
  fs.mkdirSync(d, { recursive: true });
  exec(`init --stack node`, d);

  const r = execJson(`phase define --target ${d}`, PROJ);
  assert((r.status === 'ok' || r.status === 'instruction'), `expected ok/instruction, got ${r.status}`);
  assert(r.currentPhase === 'define', `expected define, got ${r.currentPhase}`);
});

run('CLI-5.5 — bare --target (no value) does not crash phase/config', async () => {
  // The T4 audit found bare --target caused exit 3 in init.mjs
  // Verify phase and config don't have the same bug
  const r1 = execWithExit(`phase define --target`, PROJ);
  // Bare --target means flags.target = true, which should fall back to cwd
  // If cwd has no config, should exit non-zero but NOT crash (exit 3)
  assert(r1.exitCode !== 3, `phase bare --target should not exit 3: got ${r1.exitCode}`);

  const r2 = execWithExit(`config get mode --target`, PROJ);
  assert(r2.exitCode !== 3, `config bare --target should not exit 3: got ${r2.exitCode}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  T5 CLI INTEGRATION TESTS: ${passed}/${total} passed`);
console.log('═══════════════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.error('\nFAILURES:');
  for (const f of failures) {
    console.error(`  ✗ ${f.name}`);
    console.error(`    ${f.message}`);
  }
  process.exit(1);
}

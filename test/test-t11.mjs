/**
 * test-t11.mjs — T11 Copilot Mode test battery.
 *
 * Usage: node test-t11.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TMP = '/tmp/t11-test-' + Date.now();
const PROJ_DIR = TMP;
// Resolve repo root from this test file's location (test/ → repo root).
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Resolve CLI from this test file's location (test/ → repo root).
const CLI = 'node ' + resolve(PROJECT_ROOT, 'cli/dev-harness.mjs');
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function cli(args) {
  return execSync(`${CLI} ${args} --target ${PROJ_DIR} 2>/dev/null`, { encoding: 'utf-8' }).trim();
}

function cliGet(key) {
  const raw = cli(`config get ${key}`);
  const m = raw.match(/=\s*(.+)/);
  if (m) {
    try { return JSON.parse(m[1]); } catch { return m[1]; }
  }
  return raw;
}

// Bootstrap
mkdirSync(TMP, { recursive: true });
cli('init --stack node --no-git');

console.log('=== T11 Mode Tests ===\n');

// ── A. modes.mjs ─────────────────────────────────────────────────────────────

async function testModesModule() {
  const m = await import(`${PROJECT_ROOT}/cli/lib/modes.mjs`);

  let mode = m.getMode(PROJ_DIR);
  assert.equal(mode, 'copilot');
  passed++;

  assert.equal(m.shouldAutoPrompt(PROJ_DIR), true);
  passed++;

  assert.equal(m.shouldConfirmGates(PROJ_DIR), true);
  passed++;

  m.ensureCopilotConfig(PROJ_DIR);
  const out = cliGet('copilot');
  assert.equal(out.autoPrompt, true);
  assert.equal(out.confirmGates, true);
  passed++;

  if (VERBOSE) console.log('  ✓ modes.mjs (4)');
}

// ── B. set-mode ──────────────────────────────────────────────────────────────

async function testSetMode() {
  let out = cli('set-mode copilot');
  assert.ok(out.includes('copilot'));
  assert.equal(cliGet('mode'), 'copilot');
  passed++;

  cli('phase define --json');
  out = cli('set-mode autopilot');
  assert.ok(out.includes('autopilot'));
  assert.equal(cliGet('mode'), 'autopilot');
  passed++;

  out = cli('set-mode copilot --json');
  const d = JSON.parse(out);
  assert.equal(d.command, 'set-mode');
  assert.equal(d.mode, 'copilot');
  assert.equal(d.status, 'ok');
  passed++;

  try {
    execSync(`${CLI} set-mode invalid --target ${PROJ_DIR} 2>&1`, { encoding: 'utf-8' });
    assert.fail('should throw');
  } catch (e) {
    const err = e.stderr?.toString() || e.stdout?.toString() || '';
    assert.ok(err.includes('Usage error') || err.includes('Mode required'));
    passed++;
  }

  if (VERBOSE) console.log('  ✓ set-mode (4)');
}

// ── C. pause / resume ────────────────────────────────────────────────────────

async function testPauseResume() {
  let out = cli('pause');
  assert.ok(out.toLowerCase().includes('paus'));
  assert.equal(cliGet('paused'), true);
  passed++;

  out = cli('resume');
  assert.ok(out.toLowerCase().includes('resum'));
  assert.equal(cliGet('paused'), false);
  passed++;

  out = cli('pause --json');
  let d = JSON.parse(out);
  assert.equal(d.command, 'pause');
  assert.equal(d.status, 'ok');
  passed++;

  out = cli('resume --json');
  d = JSON.parse(out);
  assert.equal(d.command, 'resume');
  assert.equal(d.status, 'ok');
  passed++;

  if (VERBOSE) console.log('  ✓ pause/resume (4)');
}

// ── D. Autopilot pause integration ───────────────────────────────────────────

async function testAutopilotPause() {
  cli('phase define --json');
  cli('set-mode autopilot');
  cli('pause');
  let out = cli('phase define --json');
  let d = JSON.parse(out);
  assert.equal(d.status, 'paused');
  passed++;

  cli('resume');
  out = cli('phase define --json');
  d = JSON.parse(out);
  assert.notEqual(d.status, 'paused');
  passed++;

  cli('set-mode copilot');
  out = cliGet('copilot');
  assert.equal(out.autoPrompt, true);
  assert.equal(out.confirmGates, true);
  passed++;

  if (VERBOSE) console.log('  ✓ autopilot pause (3)');
}

// ── E. shouldAutoPrompt config ───────────────────────────────────────────────

async function testAutoPromptConfig() {
  const m = await import(`${PROJECT_ROOT}/cli/lib/modes.mjs`);

  assert.equal(m.shouldAutoPrompt(PROJ_DIR), true);
  passed++;

  assert.equal(m.shouldConfirmGates(PROJ_DIR), true);
  passed++;

  cli('config set copilot.autoPrompt false');
  assert.equal(m.shouldAutoPrompt(PROJ_DIR), false);
  passed++;

  cli('config set copilot.confirmGates false');
  assert.equal(m.shouldConfirmGates(PROJ_DIR), false);
  passed++;

  // Reset
  cli('config set copilot.autoPrompt true');
  cli('config set copilot.confirmGates true');

  if (VERBOSE) console.log('  ✓ autoPrompt config (4)');
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  await testModesModule();
  await testSetMode();
  await testPauseResume();
  await testAutopilotPause();
  await testAutoPromptConfig();

  console.log(`\nResults: ${passed} pass, ${failed} fail\n`);

  try { rmSync(TMP, { recursive: true }); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main();

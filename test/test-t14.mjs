#!/usr/bin/env node
/**
 * T14 — Sprint Contract Template + Validation Test Battery
 *
 * Tests the `dev-harness contract` command and contract.mjs library:
 * - propose, review, status, escalate subcommands
 * - Round tracking and auto-escalation after 5 rounds
 * - Gate integration (contract-agreed check)
 * - Edge cases (missing file, corrupt content, re-propose preservation)
 * - JSON output contract on all subcommands
 * - HTML comment parsing in template status
 *
 * Usage: node test-t14.mjs
 *        node test-t14.mjs --verbose
 */
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import * as url from 'node:url';

const __filename = url.fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");

// ── Test framework ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];
const verbose = process.argv.includes('--verbose');

async function run(name, fn) {
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
    throw new Error(`${msg || 'Not equal'}\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
  }
}

function assertMatch(str, regex, msg) {
  if (!regex.test(str)) throw new Error(`${msg || 'No match'}\n    string: ${JSON.stringify(str)}\n    regex:  ${regex}`);
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg || 'Not equal'}\n    actual:   ${a}\n    expected: ${e}`);
}

function assertNotEqual(actual, expected, msg) {
  if (actual === expected) throw new Error(`${msg || 'Should not equal'}\n    actual: ${JSON.stringify(actual)}`);
}

// ── Setup ────────────────────────────────────────────────────────────────────

const TEST_TMP = fs.mkdtempSync(path.join(tmpdir(), 't14-test-'));
const CLI_PATH = path.join(PROJECT_ROOT, 'cli/dev-harness.mjs');

function createProject(opts = {}) {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'proj-'));
  execSync(`node ${CLI_PATH} init --stack ${opts.stack || 'node'} --target "${dir}" --no-git 2>&1 | tail -1`, {
    stdio: 'pipe', encoding: 'utf-8', timeout: 10000,
  });
  return dir;
}

function cli(args, cwd) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args} --target "${cwd || process.cwd()}" 2>&1`, {
      encoding: 'utf-8', timeout: 10000,
    }).trim();
    return { stdout, exitCode: 0 };
  } catch (err) {
    const output = ((err.stdout || '') + (err.stderr || '')).toString().trim();
    return { stdout: output, exitCode: err.status || 1 };
  }
}

function cliNoTarget(args) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args}`, {
      encoding: 'utf-8', timeout: 10000,
    }).trim();
    return { stdout, exitCode: 0 };
  } catch (err) {
    const output = ((err.stdout || '') + (err.stderr || '')).toString().trim();
    return { stdout: output, exitCode: err.status || 1 };
  }
}

function parseJSON(text) {
  // Handle JSON output buried inside other text
  const match = text.match(/\{.*\}/s);
  if (!match) throw new Error(`No JSON found in: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

function readContract(dir) {
  return fs.readFileSync(path.join(dir, 'harness', 'sprint-contract.md'), 'utf-8');
}

// ──────────────────────────────────────────────────────────────────────────────
// A: Propose
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  A: contract propose');
console.log('═══════════════════════════════════════════════════════════════');

await run('A.1 — propose creates sprint-contract.md', () => {
  const dir = createProject();
  cli('contract propose --scope "Build login"', dir);
  assert(fs.existsSync(path.join(dir, 'harness', 'sprint-contract.md')), 'sprint-contract.md should exist');
});

await run('A.2 — propose without scope exits usage error', () => {
  const dir = createProject();
  const r = cli('contract propose', dir);
  assertEqual(r.exitCode, 2, 'exit code 2 for usage error');
  assert(r.stdout.includes('Usage:'), 'stderr should mention usage');
});

await run('A.3 — propose with scope/exclusions/criteria writes template', () => {
  const dir = createProject();
  cli('contract propose --scope "Auth" --exclusions "Admin" --criteria "test passes|lint clean"', dir);
  const content = readContract(dir);
  assert(content.includes('I will build:'), 'should have scope section');
  assert(content.includes('I will NOT build:'), 'should have exclusions section');
  assert(content.includes('test passes'), 'should have criteria');
  assert(content.includes('lint clean'), 'should have multi-criteria');
  assert(content.includes('## Evaluator Review'), 'should have review section');
  assert(content.includes('## Agreement Status'), 'should have status section');
});

await run('A.4 — propose JSON output contract', () => {
  const dir = createProject();
  const r = cli('contract propose --scope "Test" --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.command, 'contract', 'command is contract');
  assertEqual(j.subcommand, 'propose', 'subcommand is propose');
  assertEqual(j.status, 'ok', 'status is ok');
  assert(j.message.includes('proposed'), 'message mentions proposed');
});

await run('A.5 — propose without scope with --json exits error', () => {
  const dir = createProject();
  const r = cli('contract propose --json', dir);
  const j = JSON.parse(r.stdout);
  assertEqual(j.error, 'CliError', 'error type is CliError');
  assert(j.message.includes('Usage'), 'message is usage');
  assertEqual(r.exitCode, 2, 'exit code 2');
});

// ──────────────────────────────────────────────────────────────────────────────
// B: Review
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  B: contract review');
console.log('═══════════════════════════════════════════════════════════════');

await run('B.1 — review --agreed marks as agreed', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract review --agreed', dir);
  assert(r.stdout.includes('agreed'), 'output mentions agreed');
  const content = readContract(dir);
  assert(content.includes('Agreed'), 'file status is Agreed');
});

await run('B.2 — review --needs-revision marks as needs-revision', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract review --needs-revision', dir);
  assert(r.stdout.includes('needs-revision'), 'output mentions needs-revision');
  const content = readContract(dir);
  assert(content.includes('Needs Revision'), 'file status is Needs Revision');
});

await run('B.3 — review with --notes writes notes', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision --notes "Scope too vague"', dir);
  const content = readContract(dir);
  assert(content.includes('Scope too vague'), 'notes text in file');
});

await run('B.4 — review without --agreed or --needs-revision exits usage error', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract review', dir);
  assertEqual(r.exitCode, 2, 'exit code 2');
  assert(r.stdout.includes('Usage:'), 'stderr should mention usage');
});

await run('B.5 — review without contract file exits error', () => {
  const dir = createProject();
  // Remove template-created contract file
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  const r = cli('contract review --agreed', dir);
  assert(r.stdout.includes('No sprint-contract.md'), 'error about missing file');
});

await run('B.6 — review JSON output contract', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract review --agreed --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.command, 'contract');
  assertEqual(j.subcommand, 'review');
  assertEqual(j.status, 'ok');
  assertEqual(j.escalated, false);
  assert(j.message.includes('agreed'));
});

await run('B.7 — review JSON with escalated flag', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision --notes "R1"', dir);
  cli('contract review --needs-revision --notes "R2"', dir);
  cli('contract review --needs-revision --notes "R3"', dir);
  cli('contract review --needs-revision --notes "R4"', dir);
  const r = cli('contract review --needs-revision --notes "R5" --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.status, 'ok');
  assertEqual(j.escalated, true);
  assert(j.message.includes('escalated'));
});

// ──────────────────────────────────────────────────────────────────────────────
// C: Status
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  C: contract status');
console.log('═══════════════════════════════════════════════════════════════');

await run('C.1 — status before propose reports not found', () => {
  const dir = createProject();
  // Remove template-created contract file
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  const r = cli('contract status', dir);
  assert(r.stdout.includes('No sprint-contract.md'), 'no contract message');
});

await run('C.2 — status after propose reports pending', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract status', dir);
  assert(r.stdout.includes('pending'), 'status shows pending');
  assert(r.stdout.includes('0/5'), 'shows 0/5');
});

await run('C.3 — status after review --agreed reports agreed', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --agreed', dir);
  const r = cli('contract status', dir);
  assert(r.stdout.includes('agreed'), 'status shows agreed');
  // Agreement is not a negotiation round — rounds must NOT increment.
  assert(r.stdout.includes('0/5'), 'rounds unchanged on agreement');
});

await run('C.4 — status after escalate reports escalated', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate --reason "Stuck"', dir);
  const r = cli('contract status', dir);
  assert(r.stdout.includes('escalated'), 'status shows escalated');
});

await run('C.5 — status JSON output contract', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.command, 'contract');
  assertEqual(j.subcommand, 'status');
  assertEqual(j.status, 'ok');
  assertEqual(j.contractStatus, 'pending');
  assert(typeof j.rounds === 'number', 'rounds is number');
  assert(j.message.includes('pending'));
});

await run('C.6 — status JSON with escalated contract', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate --reason "Design disagreement"', dir);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'escalated');
  assert(j.message.includes('escalated'));
});

await run('C.7 — status with empty sprint-contract.md defaults to pending', () => {
  const dir = createProject();
  // Create an empty contract file
  fs.writeFileSync(path.join(dir, 'harness', 'sprint-contract.md'), '', 'utf-8');
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.status, 'ok', 'does not crash');
  assertEqual(j.contractStatus, 'pending', 'empty file defaults to pending');
});

await run('C.8 — status JSON without sprint-contract.md reports not_found', () => {
  const dir = createProject();
  // Delete the contract file entirely
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'not_found', 'not_found when file missing');
  assert(j.message.includes('No sprint-contract.md'), 'explains missing file');
});

// ──────────────────────────────────────────────────────────────────────────────
// D: Escalate
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  D: contract escalate');
console.log('═══════════════════════════════════════════════════════════════');

await run('D.1 — escalate sets status to escalated', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate --reason "Stuck"', dir);
  const content = readContract(dir);
  assert(content.includes('Escalated'), 'status line escalated');
  assert(content.includes('## Escalation'), 'escalation section added');
  assert(content.includes('Stuck'), 'reason in file');
});

await run('D.2 — escalate without reason still works', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate', dir);
  const content = readContract(dir);
  assert(content.includes('Escalated'), 'status escalated');
  assert(content.includes('## Escalation'), 'escalation section added');
});

await run('D.3 — escalate without contract exits error', () => {
  const dir = createProject();
  // Remove template-created contract file
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  const r = cli('contract escalate --reason "Nope"', dir);
  assert(r.stdout.includes('No sprint-contract.md'), 'error about missing file');
});

await run('D.4 — escalate JSON output contract', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const r = cli('contract escalate --reason "Stuck" --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.command, 'contract');
  assertEqual(j.subcommand, 'escalate');
  assertEqual(j.status, 'ok');
  assert(j.message.includes('escalated'));
});

await run('D.5 — re-propose after escalate preserves status', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate --reason "Stuck"', dir);
  cli('contract propose --scope "New approach"', dir);
  const r = cli('contract status', dir);
  assert(r.stdout.includes('escalated'), 're-propose preserves escalated status');
  assert(r.stdout.includes('0/5'), 're-propose preserves rounds');
});

// ──────────────────────────────────────────────────────────────────────────────
// E: Round tracking + Auto-escalation
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  E: Round tracking + auto-escalation');
console.log('═══════════════════════════════════════════════════════════════');

await run('E.1 — rounds increment from 0 to 1 after first review', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision', dir);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.rounds, 1, 'rounds should be 1');
});

await run('E.2 — rounds increment through 4 reviews', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision --notes "R1"', dir);
  cli('contract review --needs-revision --notes "R2"', dir);
  cli('contract review --needs-revision --notes "R3"', dir);
  cli('contract review --needs-revision --notes "R4"', dir);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.rounds, 4, 'rounds should be 4');
});

await run('E.3 — 5th needs-revision triggers auto-escalation', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  for (let i = 1; i <= 4; i++) {
    cli(`contract review --needs-revision --notes "R${i}"`, dir);
  }
  const r = cli('contract review --needs-revision --notes "R5"', dir);
  assert(r.stdout.includes('escalated'), 'auto-escalation message');
  assert(r.stdout.includes('Max'), 'mentions max rounds');
  const content = readContract(dir);
  assert(content.includes('Escalated'), 'status is Escalated in file');
  assert(content.includes('## Escalation'), 'escalation section in file');
});

await run('E.4 — agreed on round 5 does NOT escalate', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  for (let i = 1; i <= 4; i++) {
    cli(`contract review --needs-revision --notes "R${i}"`, dir);
  }
  const r = cli('contract review --agreed', dir);
  assert(r.stdout.includes('agreed'), 'agreed on round 5');
  assert(!r.stdout.includes('escalated'), 'no escalation');
  const content = readContract(dir);
  assert(content.includes('Agreed'), 'status is Agreed');
  assert(!content.includes('## Escalation'), 'no escalation section');
});

await run('E.5 — rounds preserved after re-propose', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision', dir);
  cli('contract review --needs-revision', dir);
  cli('contract propose --scope "New scope"', dir);
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.rounds, 2, 'rounds preserved after re-propose');
});

await run('E.6 — rounds display in human-readable output', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision', dir);
  const r = cli('contract status', dir);
  assertMatch(r.stdout, /round \d+\/5/, 'shows round count in human output');
});

// ──────────────────────────────────────────────────────────────────────────────
// F: HTML comment parsing
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  F: HTML comment parsing');
console.log('═══════════════════════════════════════════════════════════════');

await run('F.1 — pending detection with HTML comment status', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  // Template has: **Status:** <!-- Agreed / Needs Revision -->
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'pending', 'comment-only status → pending');
});

await run('F.2 — agreed with HTML comment still detected', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  // Manually set status with comment around it
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  let c = fs.readFileSync(sp, 'utf-8');
  c = c.replace(/\*\*Status:\*\*.*/, '**Status:** Agreed <!-- evaluator approved -->');
  fs.writeFileSync(sp, c, 'utf-8');
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'agreed', 'agreed with comment suffix');
});

await run('F.3 — needs-revision with HTML comment', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  let c = fs.readFileSync(sp, 'utf-8');
  c = c.replace(/\*\*Status:\*\*.*/, '**Status:** Needs Revision <!-- eval feedback -->');
  fs.writeFileSync(sp, c, 'utf-8');
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'needs-revision', 'needs-revision with comment');
});

await run('F.4 — escalated status with text after', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  let c = fs.readFileSync(sp, 'utf-8');
  c = c.replace(/\*\*Status:\*\*.*/, '**Status:** Escalated — awaiting human adjudication');
  fs.writeFileSync(sp, c, 'utf-8');
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'escalated', 'escalated status detected');
});

// ──────────────────────────────────────────────────────────────────────────────
// G: Gate integration
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  G: Gate integration (validate & contract-agreed)');
console.log('═══════════════════════════════════════════════════════════════');

await run('G.1 — contract-agreed fails when no contract (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  // Delete the template-created contract file so there's genuinely no contract
  const sp = path.join(dir, 'harness', 'sprint-contract.md');
  if (fs.existsSync(sp)) fs.unlinkSync(sp);
  const r = cli('validate --phase define --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'contract-agreed check present');
  assertEqual(cc.pass, false, 'fails with no contract');
  assert(cc.detail.includes('not yet proposed'), 'explains why');
});

await run('G.2 — contract-agreed fails when pending (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  cli('contract propose --scope "Login"', dir);
  const r = cli('validate --phase define --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'contract-agreed check present');
  assertEqual(cc.pass, false, 'fails when pending');
});

await run('G.3 — contract-agreed passes when agreed (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  cli('contract propose --scope "Login"', dir);
  cli('contract review --agreed', dir);
  const r = cli('validate --phase define --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'contract-agreed check present');
  assertEqual(cc.pass, true, 'passes when agreed');
});

await run('G.4 — contract-agreed fails when needs-revision (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision', dir);
  const r = cli('validate --phase define --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'contract-agreed check present');
  assertEqual(cc.pass, false, 'fails when needs-revision');
  assert(cc.detail.includes('revision'), 'detail mentions revision');
});

await run('G.5 — contract-agreed fails when escalated (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  cli('contract propose --scope "Login"', dir);
  cli('contract escalate --reason "Stuck"', dir);
  const r = cli('validate --phase define --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'contract-agreed check present');
  assertEqual(cc.pass, false, 'fails when escalated');
  assert(cc.detail.includes('escalated'), 'detail mentions escalated');
});

await run('G.6 — validate honors gates.enabled false (DEFINE phase)', () => {
  const dir = createProject();
  const r = cli('validate --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.message.includes('disabled'), true, 'gates disabled message');
});

await run('G.7 — build phase also checks contract-agreed (gates enabled)', () => {
  const dir = createProject();
  cli('config set gates.enabled true', dir);
  cli('contract propose --scope "Login"', dir);
  cli('contract review --agreed', dir);
  const r = cli('validate --phase build --json', dir);
  const j = parseJSON(r.stdout);
  const cc = j.checks.find(c => c.name === 'contract-agreed');
  assert(cc, 'build phase has contract-agreed check');
  assertEqual(cc.pass, true, 'passes when agreed');
});

// ──────────────────────────────────────────────────────────────────────────────
// H: Edge cases
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  H: Edge cases');
console.log('═══════════════════════════════════════════════════════════════');

await run('H.1 — no --target uses cwd (no project = graceful)', () => {
  // Run from a temp dir with no harness config
  const tmp = fs.mkdtempSync(path.join(TEST_TMP, 'no-proj-'));
  const r = cliNoTarget(`contract status --target "${tmp}"`);
  assert(r.stdout.includes('No sprint-contract.md'), 'graceful no-contract message');
});

await run('H.2 — bare --target falls back to cwd', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  // Contract command at bare --target should not crash
  const r = cli('contract status --target', dir);
  assert(!r.stdout.includes('TypeError'), 'no crash on bare --target');
});

await run('H.3 — re-propose preserves evaluator review section', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision --notes "Need more detail"', dir);
  // Re-propose with new scope
  cli('contract propose --scope "Login with OAuth"', dir);
  const content = readContract(dir);
  assert(content.includes('Need more detail'), 'review notes preserved from previous cycle');
  assert(content.includes('Login with OAuth'), 'new scope present');
});

await run('H.4 — corrupt sprint-contract.md returns error status', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  // Corrupt the file
  fs.writeFileSync(path.join(dir, 'harness', 'sprint-contract.md'), '{corrupt}', 'utf-8');
  // Should not crash
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.status, 'ok', 'does not crash on corrupt file');
  assert(typeof j.contractStatus === 'string', 'returns a status string');
});

await run('H.5 — empty sprint-contract.md defaults to pending', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  fs.writeFileSync(path.join(dir, 'harness', 'sprint-contract.md'), '', 'utf-8');
  const r = cli('contract status --json', dir);
  const j = parseJSON(r.stdout);
  assertEqual(j.contractStatus, 'pending', 'empty file → pending');
});

await run('H.6 — invalid subcommand exits error', () => {
  const dir = createProject();
  const r = cli('contract invalid', dir);
  assertEqual(r.exitCode, 2);
  assert(r.stdout.includes('Usage:'), 'shows usage');
});

await run('H.7 — no subcommand exits error', () => {
  const dir = createProject();
  const r = cli('contract', dir);
  assertEqual(r.exitCode, 2);
  assert(r.stdout.includes('Usage:'), 'shows usage');
});

// ──────────────────────────────────────────────────────────────────────────────
// I: Unit-level library tests (import contract.mjs directly)
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  I: Library unit tests (contract.mjs)');
console.log('═══════════════════════════════════════════════════════════════');

const contractPath = path.join(PROJECT_ROOT, 'cli/lib/contract.mjs');
const contractLib = await import(contractPath);

await run('I.1 — validateContract returns structured result', () => {
  const dir = createProject();
  const r = contractLib.validateContract(dir);
  assert(typeof r === 'object', 'returns object');
  assertEqual(r.name, 'contract-agreed');
  assert(typeof r.pass === 'boolean');
  assert(typeof r.detail === 'string');
});

await run('I.2 — isContractAgreed returns false without contract', () => {
  const dir = createProject();
  assertEqual(contractLib.isContractAgreed(dir), false);
});

await run('I.3 — isContractAgreed returns true when agreed', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --agreed', dir);
  assertEqual(contractLib.isContractAgreed(dir), true);
});

await run('I.4 — isContractAgreed returns false when needs-revision', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  cli('contract review --needs-revision', dir);
  assertEqual(contractLib.isContractAgreed(dir), false);
});

await run('I.5 — getContractStatus returns correct shape', () => {
  const dir = createProject();
  cli('contract propose --scope "Login"', dir);
  const s = contractLib.getContractStatus(dir);
  assert(typeof s.status === 'string', 'status is string');
  assert(typeof s.rounds === 'number', 'rounds is number');
  assert(typeof s.path === 'string', 'path is string');
  assert(s.path.includes('sprint-contract.md'), 'path ends with contract file');
});

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
const total = passed + failed;
const pct = total > 0 ? Math.round(passed / total * 100) : 0;
console.log(`  T14 SPRINT CONTRACT TESTS: ${passed}/${total} passed (${pct}%)`);
console.log('═══════════════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log(`\nFAILURES (${failures.length}):`);
  for (const f of failures) {
    console.log(`  ✗ ${f.name}`);
    console.log(`    ${f.message.split('\n').join('\n    ')}`);
  }
}

process.exit(failures.length > 0 ? 1 : 0);

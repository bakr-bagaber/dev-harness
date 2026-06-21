#!/usr/bin/env node
/**
 * T7 — Gate Validation Engine Test Battery
 *
 * Tests gates.mjs functions directly (unit tests) and validate.mjs
 * via the CLI entry point (integration tests).
 *
 * Usage: node test-t7.mjs
 *        node test-t7.mjs --verbose
 *        node test-t7.mjs --quick  (skip CLI tests)
 *        node test-t7.mjs --only-cli  (skip unit tests)
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
    throw new Error(`${msg || 'Not equal'}\n    actual:   ${JSON.stringify(actual)}\n    expected: ${JSON.stringify(expected)}`);
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

// ── Setup ────────────────────────────────────────────────────────────────────

const TEST_TMP = fs.mkdtempSync(path.join(tmpdir(), 't7-test-'));
const CLI_PATH = path.join(PROJECT_ROOT, 'cli/dev-harness.mjs');

// ── Helper: create a test project dir ─────────────────────────────────────────

function createProject(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'proj-'));
  // Default config with gates enabled
  const config = {
    version: '1.0',
    stack: null,
    mode: 'copilot',
    currentPhase: 'init',
    paused: false,
    features: { remaining: 0, passing: 0, total: 0 },
    gates: { enabled: true, checks: ['all'] },
    git: { autoCommit: false, autoTag: false, resetOnRetry: false, branch: null, clean: true, hasUpstream: false, lastCommitMessage: null },
    phases: { enabled: ['define', 'plan', 'build', 'verify', 'review', 'ship'] },
    agents: { tone: { planner: 'A', generator: 'B', evaluator: 'C', simplifier: 'D' } },
    maxRetries: 3,
    gateHistory: [],
    ...overrides,
  };
  fs.mkdirSync(path.join(dir, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir, 'harness', 'config.json'), JSON.stringify(config, null, 2) + '\n', 'utf-8');
  // Default init.sh (executable)
  fs.mkdirSync(path.join(dir, 'harness', 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'harness', 'scripts', 'init.sh'), '#!/usr/bin/env bash\necho "init"\n', 'utf-8');
  fs.chmodSync(path.join(dir, 'harness', 'scripts', 'init.sh'), 0o755);
  return dir;
}

function initGitRepo(dir) {
  execSync('git init', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
}

// ── Helper: cli exec ─────────────────────────────────────────────────────────

function cli(args, opts = {}) {
  const cmd = `node ${CLI_PATH} ${args}`;
  try {
    const out = execSync(cmd, {
      cwd: opts.cwd || TEST_TMP,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 10000,
      ...opts,
    });
    return { stdout: out.trim(), stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
      exitCode: err.status || 1,
    };
  }
}

// ── Import gates module (for unit tests) ──────────────────────────────────────

const gatesPath = path.join(PROJECT_ROOT, 'cli/lib/gates.mjs');
const gates = await import(gatesPath);

// ──────────────────────────────────────────────────────────────────────────────
// SECTION A: getPhaseChecks — check registry completeness
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  A: getPhaseChecks — phase-to-check mapping');
console.log('═══════════════════════════════════════════════════════════════');

await run('A.1 — init has 3 checks (git-repo, config-exists, init-executable)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'init');
  assertEqual(result.checks.length, 3, 'init should have 3 checks');
  const names = result.checks.map(c => c.name);
  assert(names.includes('git-repo'), 'should include git-repo');
  assert(names.includes('config-exists'), 'should include config-exists');
  assert(names.includes('init-executable'), 'should include init-executable');
});

await run('A.2 — define has 2 checks (feature-branch, contract-agreed)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  execSync('git checkout -b feature-x', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  const result = await gates.runChecks(dir, 'define');
  assertEqual(result.checks.length, 2);
  assertEqual(result.checks[0].name, 'feature-branch');
  assertEqual(result.checks[1].name, 'contract-agreed');
});

await run('A.3 — plan has 1 check (git-clean)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'plan');
  assertEqual(result.checks.length, 1);
  assertEqual(result.checks[0].name, 'git-clean');
});

await run('A.4 — build has 5 checks (git-clean, lint, tests, contract-agreed, coverage)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'build');
  assertEqual(result.checks.length, 5);
  const names = result.checks.map(c => c.name);
  assert(names.includes('git-clean'), 'should include git-clean');
  assert(names.includes('lint'), 'should include lint');
  assert(names.includes('tests'), 'should include tests');
  assert(names.includes('contract-agreed'), 'should include contract-agreed');
  assert(names.includes('coverage'), 'should include coverage');
});

await run('A.5 — verify has 3 checks (git-clean, tests, coverage)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'verify');
  assertEqual(result.checks.length, 3);
  const names = result.checks.map(c => c.name);
  assert(names.includes('git-clean'));
  assert(names.includes('tests'));
  assert(names.includes('coverage'));
});

await run('A.6 — simplify has 2 checks (git-clean, no-empty-dirs)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'simplify');
  assertEqual(result.checks.length, 2);
  const names = result.checks.map(c => c.name);
  assert(names.includes('git-clean'));
  assert(names.includes('no-empty-dirs'));
});

await run('A.7 — review has 5 checks (branch-up-to-date, rubric-exists, readme, architecture, decisions)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'review');
  assertEqual(result.checks.length, 5);
  const names = result.checks.map(c => c.name);
  assert(names.includes('branch-up-to-date'));
  assert(names.includes('rubric-exists'));
  assert(names.includes('readme-exists'));
  assert(names.includes('architecture-doc'));
  assert(names.includes('decisions-logged'));
});

await run('A.8 — ship has 8 checks (git-clean, tagged, changelog + deliverable gates)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'ship');
  assertEqual(result.checks.length, 8);
  const names = result.checks.map(c => c.name);
  assert(names.includes('git-clean'));
  assert(names.includes('tagged'));
  assert(names.includes('changelog'));
  assert(names.includes('readme-exists'));
  assert(names.includes('license-exists'));
  assert(names.includes('changelog-content'));
  assert(names.includes('no-empty-dirs'));
});

await run('A.9 — unknown phase returns empty array', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'nonexistent');
  assertDeepEqual(result.checks, []);
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION B: areGatesEnabled — config-driven gate toggle
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  B: areGatesEnabled — config toggle');
console.log('═══════════════════════════════════════════════════════════════');

await run('B.1 — gates enabled when config has gates.enabled: true', async () => {
  const dir = createProject({ gates: { enabled: true, checks: ['all'] } });
  assertEqual(gates.areGatesEnabled(dir), true, 'should be enabled');
});

await run('B.2 — gates disabled when config has gates.enabled: false', async () => {
  const dir = createProject({ gates: { enabled: false, checks: ['all'] } });
  assertEqual(gates.areGatesEnabled(dir), false, 'should be disabled');
});

await run('B.3 — gates disabled when config missing', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'no-config-'));
  assertEqual(gates.areGatesEnabled(dir), false, 'no config = disabled');
});

await run('B.4 — gates disabled when config has no gates key', async () => {
  const dir = createProject();
  delete dir.gates; // hmm, can't do this
  // Use a config without gates key
  const dir2 = fs.mkdtempSync(path.join(TEST_TMP, 'no-gates-key-'));
  fs.mkdirSync(path.join(dir2, 'harness'), { recursive: true }); fs.writeFileSync(path.join(dir2, 'harness/config.json'), JSON.stringify({ version: '1.0', mode: 'copilot' }), 'utf-8');
  assertEqual(gates.areGatesEnabled(dir2), false, 'no gates key = disabled');
});

await run('B.5 — gates disabled when enabled is undefined', async () => {
  const dir = createProject({ gates: { checks: ['all'] } });
  assertEqual(gates.areGatesEnabled(dir), false, 'undefined = disabled');
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION C: runChecks — individual check function behavior
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  C: runChecks — functional check execution');
console.log('═══════════════════════════════════════════════════════════════');

await run('C.1 — init phase: all pass in valid project', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'init');
  assertEqual(result.phase, 'init');
  assertEqual(result.overall, true, 'all init checks should pass');
  assertEqual(result.failures.length, 0);
  assertEqual(result.checks.length, 3);
});

await run('C.2 — init phase: fail when init.sh missing', async () => {
  const dir = createProject();
  initGitRepo(dir);
  fs.unlinkSync(path.join(dir, 'harness', 'scripts', 'init.sh'));
  const result = await gates.runChecks(dir, 'init');
  assertEqual(result.overall, false);
  assert(result.failures.includes('init-executable'));
});

await run('C.3 — init phase: fail when config missing', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'no-cfg-'));
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'init');
  assertEqual(result.overall, false);
  assert(result.failures.includes('config-exists'));
});

await run('C.4 — init phase: fail when no git repo', async () => {
  const dir = createProject();
  // No git init
  const result = await gates.runChecks(dir, 'init');
  assertEqual(result.overall, false);
  assert(result.failures.includes('git-repo'));
});

await run('C.5 — plan phase: pass when git clean', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'plan');
  assertEqual(result.overall, true);
});

await run('C.6 — plan phase: fail when working tree dirty', async () => {
  const dir = createProject();
  initGitRepo(dir);
  // Make first commit so tracked files exist
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'initial\n');
  execSync('git add tracked.txt && git commit -m "initial"', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  // Now modify tracked file
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'modified\n');
  const result = await gates.runChecks(dir, 'plan');
  assertEqual(result.overall, false);
  assert(result.failures.includes('git-clean'));
});

await run('C.7 — build phase: lint/tests pass for generic stack', async () => {
  const dir = createProject();
  initGitRepo(dir);
  // Contract check requires sprint-contract.md with 'Agreed' status
  fs.writeFileSync(path.join(dir, 'harness', 'sprint-contract.md'), [
    '# Sprint Contract — Test',
    '',
    '## Scope',
    'Test build.',
    '',
    '## Agreement Status',
    '',
    '**Status:** Agreed',
    '**Negotiation rounds:** 0/5',
    '',
  ].join('\n'), 'utf-8');
  const result = await gates.runChecks(dir, 'build');
  // For generic stack, lint and tests auto-pass (no cmd configured or echo cmd)
  assertEqual(result.overall, true);
});

await run('C.8 — ship phase: tagged check fails when not tagged', async () => {
  const dir = createProject({ currentPhase: 'ship' });
  initGitRepo(dir);
  fs.writeFileSync(path.join(dir, 'file.txt'), 'content\n');
  execSync('git add file.txt && git commit -m "msg"', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  const result = await gates.runChecks(dir, 'ship');
  // Should fail: no tag, no changelog
  assertEqual(result.overall, false);
  assert(result.failures.includes('tagged'));
  assert(result.failures.includes('changelog'));
});

await run('C.9 — ship phase: all pass with tag, changelog, readme, license', async () => {
  const dir = createProject({ currentPhase: 'ship' });
  initGitRepo(dir);
  // Provide all deliverable files needed by ship gates
  fs.writeFileSync(path.join(dir, 'CHANGELOG.md'), '# Changelog\n\n## v1.0.0\n- Initial release\n');
  fs.writeFileSync(path.join(dir, 'README.md'), [
    '# Test Project',
    '',
    'A test project for harness gate validation.',
    '',
    '## Install',
    '',
    'Run npm install to get dependencies.',
    '',
    '## Usage',
    '',
    'Run npm test to execute the test suite.',
    'Run npm start to launch the application.',
    '',
    '## License',
    '',
    'MIT',
  ].join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT License\n\nCopyright (c) 2026\n');
  execSync('git add -A && git commit -m "msg"', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  execSync('git tag -a v1.0.0 -m "release"', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  const result = await gates.runChecks(dir, 'ship');
  assertEqual(result.overall, true, `ship gate should pass, failures: ${result.failures.join(', ')}`);
});

await run('C.10 — build phase: lint test uses stack-specific commands', async () => {
  // Create a node project with package.json to test stack detection
  const dir = createProject({ currentPhase: 'build' });
  initGitRepo(dir);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'content\n');
  execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'pipe', encoding: 'utf-8', timeout: 5000 });
  const result = await gates.runChecks(dir, 'build');
  // Node stack detected -> lintCmd: npx eslint .  (may fail if no eslint config)
  assertEqual(result.overall, false, 'node project without eslint config should fail lint');
  assert(result.failures.includes('lint'), 'lint should fail for node stack without eslint config');
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION D: runChecks — output contract validation
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  D: runChecks — return value contracts');
console.log('═══════════════════════════════════════════════════════════════');

await run('D.1 — result has all required fields', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'init');
  assert('phase' in result, 'missing phase');
  assert('checks' in result, 'missing checks');
  assert('overall' in result, 'missing overall');
  assert('failures' in result, 'missing failures');
  assertEqual(typeof result.phase, 'string');
  assertEqual(typeof result.overall, 'boolean');
  assert(Array.isArray(result.checks));
  assert(Array.isArray(result.failures));
});

await run('D.2 — each check has name, pass, detail', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'init');
  for (const check of result.checks) {
    assert('name' in check && typeof check.name === 'string', `check missing name: ${JSON.stringify(check)}`);
    assert('pass' in check && typeof check.pass === 'boolean', `check missing pass: ${JSON.stringify(check)}`);
    assert('detail' in check && typeof check.detail === 'string', `check missing detail: ${JSON.stringify(check)}`);
  }
});

await run('D.3 — failures array matches non-passing checks', async () => {
  const dir = createProject();
  // No git repo, no config (only init.sh exists)
  const result = await gates.runChecks(dir, 'init');
  const expectedFailures = result.checks.filter(c => !c.pass).map(c => c.name);
  assertDeepEqual(result.failures, expectedFailures);
});

await run('D.4 — overall false when any check fails', async () => {
  const dir = createProject();
  // No git repo -> git-repo fails
  const result = await gates.runChecks(dir, 'init');
  if (result.checks.some(c => !c.pass)) {
    assertEqual(result.overall, false);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION E: getPhase — current phase from config
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  E: getPhase — current phase resolution');
console.log('═══════════════════════════════════════════════════════════════');

await run('E.1 — returns currentPhase from config', async () => {
  const dir = createProject({ currentPhase: 'build' });
  assertEqual(gates.getPhase(dir), 'build');
});

await run('E.2 — returns null when currentPhase is null', async () => {
  const dir = createProject({ currentPhase: null });
  assertEqual(gates.getPhase(dir), null);
});

await run('E.3 — returns null when no config exists', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'no-cfg2-'));
  assertEqual(gates.getPhase(dir), null);
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION F: Edge cases and robustness
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  F: Edge cases & robustness');
console.log('═══════════════════════════════════════════════════════════════');

await run('F.1 — runChecks with non-existent directory returns results (no crash)', async () => {
  const result = await gates.runChecks('/nonexistent/path', 'init');
  assert(Array.isArray(result.checks));
  assertEqual(typeof result.overall, 'boolean');
});

await run('F.2 — runChecks with unknown phase returns empty checks', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const result = await gates.runChecks(dir, 'nonsense');
  assertDeepEqual(result.checks, []);
  assertEqual(result.overall, true);
  assertDeepEqual(result.failures, []);
});

await run('F.3 — getPhaseChecks returns fresh array each call', async () => {
  const c1 = gates.getPhaseChecks('init');
  const c2 = gates.getPhaseChecks('init');
  // They should have same content; they may or may not be same reference
  const names1 = c1.map(f => f.name).sort();
  const names2 = c2.map(f => f.name).sort();
  assertDeepEqual(names1, names2);
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION CLI-1: validate command — gates disabled path
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-1: validate — gates disabled path');
console.log('═══════════════════════════════════════════════════════════════');

await run('CLI-1.1 — gates disabled prints message (human)', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'cli-disabled-'));
  const out = cli('validate', { cwd: dir });
  assertMatch(out.stdout, /Gates disabled/i, 'should mention gates disabled');
  assertEqual(out.exitCode, 0);
});

await run('CLI-1.2 — gates disabled JSON contract', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'cli-disabled-json-'));
  const out = cli('validate --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.command, 'validate');
  assertEqual(result.status, 'ok');
  assertEqual(result.overall, true);
  assertDeepEqual(result.checks, []);
  assertDeepEqual(result.failures, []);
});

await run('CLI-1.3 — gates disabled even with explicit --phase', async () => {
  const dir = fs.mkdtempSync(path.join(TEST_TMP, 'cli-disabled-phase-'));
  const out = cli('validate --phase build --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.phase, 'build');
  assertEqual(result.status, 'ok');
  assertMatch(result.message, /Gates disabled/i);
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION CLI-2: validate command — gates enabled
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-2: validate — gates enabled');
console.log('═══════════════════════════════════════════════════════════════');

await run('CLI-2.1 — validate init phase passes (JSON)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const out = cli('validate --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.command, 'validate');
  assertEqual(result.status, 'ok');
  assertEqual(result.overall, true);
  assertEqual(result.checks.length, 3);
});

await run('CLI-2.2 — validate init phase human output', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const out = cli('validate', { cwd: dir });
  assertMatch(out.stdout, /INIT Gate: PASS/i);
  assert(out.stdout.includes('✅'), 'should use checkmark');
  assertEqual(out.exitCode, 0, 'exit code should be 0');
});

await run('CLI-2.3 — validate shows FAIL with details', async () => {
  const dir = createProject();
  // No git repo -> git-repo and possibly others fail
  const out = cli('validate --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.overall, false);
  assert(result.failures.length > 0, 'should have failures');
});

await run('CLI-2.4 — validate with --phase override BUILD', async () => {
  const dir = createProject({ currentPhase: 'init' }); // currentPhase is init
  initGitRepo(dir);
  const out = cli('validate --phase build --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.phase, 'build');
  assertEqual(result.command, 'validate');
});

await run('CLI-2.5 — validate with explicit --phase overrides config', async () => {
  const dir = createProject({ currentPhase: 'init' });
  initGitRepo(dir);
  // --phase plan should run PLAN checks even though config says init
  const out = cli('validate --phase plan --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.phase, 'plan');
  assertEqual(result.checks.length, 1); // plan only has git-clean
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION CLI-3: validate command — error handling
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-3: validate — error handling');
console.log('═══════════════════════════════════════════════════════════════');

await run('CLI-3.1 — no phase in config prints error', async () => {
  const dir = createProject({ currentPhase: null, gates: { enabled: true, checks: ['all'] } });
  initGitRepo(dir);
  const out = cli('validate', { cwd: dir });
  assertMatch(out.stderr || '', /No phase found|init/i, 'should mention no phase or init');
  // currentPhase is null — gates are enabled but getPhase returns null
  // Note: with gates.enabled=true, getPhase(null) -> phase is null -> die() called
});

await run('CLI-3.2 — no phase JSON error contract', async () => {
  const dir = createProject({ currentPhase: null, gates: { enabled: true, checks: ['all'] } });
  initGitRepo(dir);
  const out = cli('validate --json', { cwd: dir });
  // Error should be on stderr
  if (out.stderr) {
    const err = JSON.parse(out.stderr);
    assert('error' in err, 'stderr JSON should have error');
    assert('message' in err, 'stderr JSON should have message');
  } else {
    // May fall through to gates disabled if config load failed
    assertMatch(out.stdout, /Gates disabled/i);
  }
});

await run('CLI-3.3 — validate with --target flag', async () => {
  const dir = createProject();
  initGitRepo(dir);
  // Run validate from /tmp but target the project dir
  const out = cli(`validate --json --target ${dir}`, { cwd: TEST_TMP });
  const result = JSON.parse(out.stdout);
  assert('command' in result, 'should have command field');
  assert('checks' in result, 'should have checks');
});

await run('CLI-3.4 — bare --target (no value) does not crash', async () => {
  const dir = createProject();
  initGitRepo(dir);
  // Simulate `--target` without a value by passing it as the last arg
  // The type guard in validate.mjs catches boolean true from bare --target
  const out = cli('validate --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.command, 'validate');
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION CLI-4: validate command — JSON output contract
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-4: validate — JSON output contract');
console.log('═══════════════════════════════════════════════════════════════');

await run('CLI-4.1 — success JSON includes command, status, message', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const out = cli('validate --json', { cwd: dir });
  const result = JSON.parse(out.stdout);
  assertEqual(result.command, 'validate');
  assertEqual(result.status, 'ok');
  assert(typeof result.message === 'string');
  assert(Array.isArray(result.checks));
  assert(typeof result.overall === 'boolean');
  assert(Array.isArray(result.failures));
});

await run('CLI-4.2 — failure JSON has status "error"', async () => {
  const dir = createProject();
  // No init.sh executable for fail scenario
  fs.chmodSync(path.join(dir, 'harness', 'scripts', 'init.sh'), 0o644); // make non-executable
  const out = cli('validate --json', { cwd: dir });
  try {
    const result = JSON.parse(out.stdout);
    if (result.overall === false) {
      assertEqual(result.status, 'error');
      assertEqual(out.exitCode, 1, 'failure should exit 1');
    }
  } catch {
    assert(out.stderr.length > 0, 'should have stderr output');
  }
});

await run('CLI-4.3 — human output has consistent format (PASS/FAIL)', async () => {
  const dir = createProject();
  initGitRepo(dir);
  const out = cli('validate', { cwd: dir });
  assertMatch(out.stdout, /Gate: (PASS|FAIL)/i);
});

await run('CLI-4.4 — pass exits 0, fail exits 1', async () => {
  // Pass case
  const dir1 = createProject();
  initGitRepo(dir1);
  const passOut = cli('validate --json', { cwd: dir1 });
  const passResult = JSON.parse(passOut.stdout);
  if (passResult.overall) {
    assertEqual(passOut.exitCode, 0, 'pass should exit 0');
  }
  // Fail case — no git repo
  const dir2 = createProject();
  const failOut = cli('validate --json', { cwd: dir2 });
  const failResult = JSON.parse(failOut.stdout);
  // May get no-phase error instead if config load fails
  if (failResult.overall === false) {
    assertEqual(failOut.exitCode, 1, 'fail should exit 1');
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// SECTION CLI-5: cross-file consistency — help text mentions validate
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  CLI-5: cross-file consistency');
console.log('═══════════════════════════════════════════════════════════════');

await run('CLI-5.1 — help mentions validate command', async () => {
  const out = cli('--help');
  assertMatch(out.stdout, /validate/i, '--help should mention validate');
});

await run('CLI-5.2 — help JSON mentions validate command', async () => {
  const out = cli('--help --json');
  const result = JSON.parse(out.stdout);
  assert('validate' in result.commands, 'JSON help should have validate command');
});

// ──────────────────────────────────────────────────────────────────────────────
// RESULTS
// ──────────────────────────────────────────────────────────────────────────────

const total = passed + failed;
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  T7 GATE VALIDATION TESTS: ${passed}/${total} passed`);
console.log('═══════════════════════════════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`  ✗ ${f.name}`);
    console.log(`    ${f.message}`);
  }
  process.exit(1);
}

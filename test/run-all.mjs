#!/usr/bin/env node
/**
 * run-all — Consolidated test runner for all harness test suites.
 *
 * Usage:
 *   node test/run-all.mjs              # Run all suites
 *   node test/run-all.mjs --verbose    # Verbose output
 *   node test/run-all.mjs --quick      # Skip slow integration suites
 */
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');

// Ordered by dependency — unit tests before integration.
// All suite files live alongside this runner in test/.
// Tasks T1-T25: some have dedicated tests; others (T1,T3,T4,T8,T22,T25) are
// documentation markers explaining why they're covered by other suites.
// T21 (docs-site) and T23 (cross-platform) removed — tested orphaned code.
const SUITES = [
  { file: 'test-t1.mjs',      name: 'T1 CLI Skeleton (infra)' },
  { file: 'test-t2.mjs',      name: 'T2 Stack Detection' },
  { file: 'test-t3.mjs',      name: 'T3 Template System (covered by T15)' },
  { file: 'test-t4.mjs',      name: 'T4 Scaffold Command (covered by T15)' },
  { file: 'test-t5.mjs',      name: 'T5 State Machine' },
  { file: 'test-t5-cli.mjs',  name: 'T5 CLI Integration' },
  { file: 'test-t6.mjs',      name: 'T6 Progress Writer' },
  { file: 'test-t7.mjs',      name: 'T7 Gate Validation' },
  { file: 'test-t8.mjs',      name: 'T8 Task Ralph Loop (covered by T10)' },
  { file: 'test-t9.mjs',      name: 'T9 Outer Loop' },
  { file: 'test-t10.mjs',     name: 'T10 Phase Orchestrator' },
  { file: 'test-t11.mjs',     name: 'T11 Copilot Mode' },
  { file: 'test-t12.mjs',     name: 'T12 Autopilot Mode' },
  { file: 'test-t13.mjs',     name: 'T13 Status Command' },
  { file: 'test-t14.mjs',     name: 'T14 Sprint Contract' },
  { file: 'test-t15.mjs',     name: 'T15 Agent Templates' },
  { file: 'test-t16.mjs',     name: 'T16 Evaluator Rubric' },
  { file: 'test-t17.mjs',     name: 'T17 Worktree Management' },
  { file: 'test-t18.mjs',     name: 'T18 Rollback & Checkpoint' },
  { file: 'test-t19.mjs',     name: 'T19 Skill Wrapper' },
  { file: 'test-t20.mjs',     name: 'T20 Packaging & Distribution' },
  { file: 'test-t22.mjs',     name: 'T22 Coverage Gates (covered by T7)' },
  { file: 'test-t24.mjs',     name: 'T24 CI/CD Integration' },
  { file: 'test-t25.mjs',     name: 'T25 Cleanup & Refactor (verified by all)' },
  { file: 'test-t42.mjs',     name: 'T42 3-Level Retry Toggle Matrix (v3.1.0+)' },
  { file: 'e2e-full-workflow.mjs', name: 'E2E Full Workflow (copilot+autopilot+matrix)', slow: true },
];

let passed = 0;
let failed = 0;
const failures = [];

for (const suite of SUITES) {
  const suitePath = resolve(HERE, suite.file);
  if (VERBOSE) console.log(`\n── ${suite.name} ──`);
  if (QUICK && suite.slow) continue; // skip slow e2e suites in --quick mode
  try {
    const args = [suitePath];
    if (VERBOSE) args.push('--verbose');
    if (QUICK && suite.file.includes('t9')) continue; // skip slow phase loop
    execSync(`node ${args.join(' ')}`, { cwd: HERE, stdio: VERBOSE ? 'inherit' : 'pipe', timeout: 120000 });
    passed++;
    if (!VERBOSE) process.stdout.write(`  ✓ ${suite.name}\n`);
  } catch (err) {
    failed++;
    failures.push(suite.name);
    process.stderr.write(`  ✗ ${suite.name}\n`);
    if (err.stderr) process.stderr.write(err.stderr.toString().split('\n').slice(-3).join('\n') + '\n');
  }
}

console.log(`\n${passed} pass, ${failed} fail, ${passed + failed} total`);
if (failures.length > 0) {
  console.log(`Failures: ${failures.join(', ')}`);
  process.exit(1);
}

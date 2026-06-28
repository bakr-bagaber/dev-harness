#!/usr/bin/env node
/**
 * test-t16.mjs — T16 Evaluator Rubric Template test battery.
 *
 * Verifies:
 *   - evaluator-rubric.md exists with spec-compliant content
 *   - All 6 dimensions present (Correctness, Test Coverage, Code Quality,
 *     Security, Performance, Handoff Readiness)
 *   - 0-2 scoring scale with 3 thresholds (10-12, 5-9, 0-4)
 *   - discoverTemplates() finds evaluator-rubric.md
 *   - No unresolved {{VAR}} markers (static file)
 *   - dev-harness init creates evaluator-rubric.md in target
 *   - Cross-references: evaluator.md, AGENTS.md, ralph-tasks.mjs
 *   - Edge cases: conflict detection, forced re-init
 *
 * Usage: node test-t16.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJ_DIR = resolve(__dirname, "..");
const CLI = 'node ' + resolve(PROJ_DIR, 'cli/dev-harness.mjs');
const TMP = '/tmp/t16-test-' + Date.now();

let passed = 0;
let failed = 0;
const failures = [];

function assertP(condition, message) {
  try {
    assert.ok(condition, message);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message.split('\n')[0], message: e.message });
    console.error(`  \u2717 ${message}`);
  }
}

function assertEq(actual, expected, message) {
  try {
    assert.equal(actual, expected, message);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message, message: e.message });
    console.error(`  \u2717 ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expectedStr, message) {
  try {
    assert.ok(actual.includes(expectedStr), `${message} — expected to include ${JSON.stringify(expectedStr)}`);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message, message: e.message });
    console.error(`  \u2717 ${message}`);
  }
}

function assertNotIncludes(actual, unexpectedStr, message) {
  try {
    assert.ok(!actual.includes(unexpectedStr), `${message} — should NOT include ${JSON.stringify(unexpectedStr)}`);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message, message: e.message });
    console.error(`  \u2717 ${message}`);
  }
}

function cli(args, cwd) {
  return execSync(`${CLI} ${args} 2>/dev/null`, { cwd: cwd || TMP, encoding: 'utf-8' }).trim();
}

function cliJson(args, cwd) {
  const out = cli(args + ' --json', cwd);
  return JSON.parse(out);
}

// ── Test groups ──────────────────────────────────────────────────────────────

// A. Template file existence
function testTemplateExists() {
  const tplPath = resolve(PROJ_DIR, 'templates/evaluator-rubric.md');
  assertP(existsSync(tplPath), 'A.1 evaluator-rubric.md template exists');
  assertP(existsSync(resolve(PROJ_DIR, 'templates')), 'A.2 templates directory exists');

  if (verbose) console.log('  \u2713 Template existence (2)');
}

// B. Template content spec compliance
function testSpecCompliance() {
  const content = readFileSync(resolve(PROJ_DIR, 'templates/evaluator-rubric.md'), 'utf-8');
  const lines = content.split('\n');

  // Header
  assertIncludes(content, '# Evaluator Rubric', 'B.1 Has Evaluator Rubric heading');

  // Score legend
  assertIncludes(content, '| Score | Meaning |', 'B.2 Has Score/Meaning table');
  assertIncludes(content, '0 | Unacceptable', 'B.3 Score 0 = Unacceptable');
  assertIncludes(content, '1 | Acceptable', 'B.4 Score 1 = Acceptable with minor issues');
  assertIncludes(content, '2 | Excellent', 'B.5 Score 2 = Excellent');

  // 6 dimensions
  const dimensions = [
    'Correctness',
    'Test Coverage',
    'Code Quality',
    'Security',
    'Performance',
    'Handoff Readiness',
  ];
  for (const dim of dimensions) {
    assertIncludes(content, `**${dim}**`, `B.6 Dimension: ${dim}`);
  }

  // Evidence/Notes columns
  assertIncludes(content, 'Evidence', 'B.7 Has Evidence column');
  assertIncludes(content, 'Notes', 'B.8 Has Notes column');

  // Thresholds
  assertIncludes(content, '## Thresholds', 'B.9 Has Thresholds section');
  assertIncludes(content, '10-12', 'B.10 Threshold 10-12 = Accept');
  assertIncludes(content, 'Accept', 'B.11 Threshold Accept label');
  assertIncludes(content, '5-9', 'B.12 Threshold 5-9 = Revise');
  assertIncludes(content, 'Revise', 'B.13 Threshold Revise label');
  assertIncludes(content, '0-4', 'B.14 Threshold 0-4 = Block');
  assertIncludes(content, 'Block', 'B.15 Threshold Block label');

  // Compact file size
  assertP(lines.length < 40, `B.16 evaluator-rubric.md has ${lines.length} lines, expected < 40`);

  if (verbose) console.log('  \u2713 Spec compliance (16)');
}

// C. No template variables (static file)
function testNoTemplateVariables() {
  const content = readFileSync(resolve(PROJ_DIR, 'templates/evaluator-rubric.md'), 'utf-8');
  const unresolved = content.match(/\{\{\w+\}\}/g);
  assertP(!unresolved || unresolved.length === 0, `C.1 No unresolved template vars (found: ${unresolved?.join(', ') || 'none'})`);

  if (verbose) console.log('  \u2713 Template variables (1)');
}

// D. Template engine discovery
async function testTemplateDiscovery() {
  const mod = await import(`${PROJ_DIR}/cli/lib/templates.mjs`);
  const files = mod.discoverTemplates();
  const templateNames = files.map(f => f.replace(/.*\/templates\//, ''));
  assertP(templateNames.includes('evaluator-rubric.md'), 'D.1 discoverTemplates finds evaluator-rubric.md');

  if (verbose) console.log('  \u2713 Template discovery (1)');
}

// E. Init command integration
function testInitIntegration() {
  const testDir = resolve(TMP, 'init-test');
  mkdirSync(testDir, { recursive: true });

  // Run init
  const result = cliJson(`init --stack node --target ${testDir} --no-git`);
  assertEq(result.command, 'init', 'E.1 init command in JSON output');
  assertEq(result.status, 'ok', 'E.2 init status is ok');

  // Check evaluator-rubric.md is in created files
  assertP(result.files.some(f => f.endsWith('evaluator-rubric.md')), 'E.3 init creates evaluator-rubric.md');

  // Verify the file exists on disk
  const rubricPath = resolve(testDir, 'harness', 'evaluator-rubric.md');
  assertP(existsSync(rubricPath), 'E.4 evaluator-rubric.md exists on disk after init');

  // Verify content in generated file
  const content = readFileSync(rubricPath, 'utf-8');
  assertIncludes(content, '# Evaluator Rubric', 'E.5 Generated file has correct heading');
  assertIncludes(content, 'Correctness', 'E.6 Generated file has Correctness dimension');
  assertIncludes(content, 'Test Coverage', 'E.7 Generated file has Test Coverage dimension');
  assertIncludes(content, 'Handoff Readiness', 'E.8 Generated file has Handoff Readiness dimension');
  assertIncludes(content, '10-12', 'E.9 Generated file has Accept threshold');
  assertIncludes(content, '5-9', 'E.10 Generated file has Revise threshold');
  assertIncludes(content, '0-4', 'E.11 Generated file has Block threshold');

  // No unresolved vars in generated output
  const unresolved = content.match(/\{\{\w+\}\}/g);
  assertP(!unresolved || unresolved.length === 0, `E.12 No unresolved vars in generated file (found: ${unresolved?.join(', ') || 'none'})`);

  if (verbose) console.log('  \u2713 Init integration (12)');
}

// F. Cross-references
function testCrossReferences() {
  // F1: Evaluator role guide should reference rubric
  const evaluatorMd = readFileSync(resolve(PROJ_DIR, 'templates/docs/agents/evaluator.md'), 'utf-8');
  assertIncludes(evaluatorMd, 'evaluator-rubric.md', 'F.1 Evaluator role guide references evaluator-rubric.md');

  // F2: AGENTS.md Key Files table should reference rubric
  const agentsMd = readFileSync(resolve(PROJ_DIR, 'templates/AGENTS.md'), 'utf-8');
  assertIncludes(agentsMd, 'evaluator-rubric.md', 'F.2 AGENTS.md Key Files references evaluator-rubric.md');

  // F3: ralph-shared.mjs (centralized output builders) should have buildDeliverableRetryOutput
  const ralphShared = readFileSync(resolve(PROJ_DIR, 'cli/lib/ralph-shared.mjs'), 'utf-8');
  // REVIEW phase instructions are built dynamically; check buildDeliverableRetryOutput exists
  assertIncludes(ralphShared, 'buildDeliverableRetryOutput', 'F.3 ralph-shared.mjs has buildDeliverableRetryOutput (centralized output builders)');

  // F4: gates.mjs should have rubric check in REVIEW phase
  const gates = readFileSync(resolve(PROJ_DIR, 'cli/lib/gates.mjs'), 'utf-8');
  assertIncludes(gates, 'rubric-content', 'F.4 gates.mjs has rubric-content check (G9: was rubric-exists)');

  // F5: init.mjs conflict detection should include rubric
  const initMjs = readFileSync(resolve(PROJ_DIR, 'cli/commands/init.mjs'), 'utf-8');
  assertIncludes(initMjs, 'evaluator-rubric.md', 'F.5 init.mjs has evaluator-rubric.md in template names');

  if (verbose) console.log('  \u2713 Cross-references (5)');
}

// G. Edge cases
function testEdgeCases() {
  // G1: Conflict detection — init should block on existing evaluator-rubric.md
  const testDir = resolve(TMP, 'conflict-test');
  mkdirSync(testDir, { recursive: true });
  cliJson(`init --stack python --target ${testDir} --no-git`); // first init creates file

  try {
    execSync(`${CLI} init --stack python --target ${testDir} --no-git 2>&1`, { cwd: TMP, encoding: 'utf-8' });
    assert.fail('G.1 Should reject duplicate init without --force');
  } catch (e) {
    const errMsg = e.stdout?.toString() || '';
    assertP(
      errMsg.includes('already exist') ||
      errMsg.includes('already exists') ||
      errMsg.includes('conflict') ||
      errMsg.includes('evaluator-rubric'),
      'G.2 Duplicate init rejection mentions existing file'
    );
  }

  // G2: --force re-init works (overwrites)
  const forceResult = cliJson(`init --stack python --target ${testDir} --no-git --force`);
  assertEq(forceResult.status, 'ok', 'G.3 --force re-init succeeds');
  assertP(forceResult.files.some(f => f.endsWith('evaluator-rubric.md')), 'G.4 --force re-init creates evaluator-rubric.md');

  // G3: All 9 stacks produce evaluator-rubric.md
  const stacks = ['python', 'node', 'go', 'rust', 'c', 'cpp', 'vhdl', 'verilog', 'generic'];
  for (const stack of stacks) {
    const dir = resolve(TMP, `stack-${stack}`);
    const r = cliJson(`init --stack ${stack} --target ${dir} --no-git`);
    assertEq(r.status, 'ok', `G.5.${stack} init succeeds for ${stack}`);
    assertP(existsSync(resolve(dir, 'harness', 'evaluator-rubric.md')), `G.6 ${stack}: evaluator-rubric.md created`);
  }

  // G4: JSON output contract (verify structure)
  const jsonTestDir = resolve(TMP, 'json-contract');
  const r = cliJson(`init --stack go --target ${jsonTestDir} --no-git`);
  assertEq(r.command, 'init', 'G.7 JSON output has command field');
  assertP(r.status !== undefined, 'G.8 JSON output has status field');
  assertP(r.message !== undefined, 'G.9 JSON output has message field');
  assertP(r.stack !== undefined, 'G.10 JSON output has stack field');
  assertP(r.target !== undefined, 'G.11 JSON output has target field');
  assertP(r.filesCreated !== undefined, 'G.12 JSON output has filesCreated field');

  if (verbose) console.log('  \u2713 Edge cases (12)');
}

// H. REVIEW gate rubric check
function testReviewGateCheck() {
  // H1: With rubric file — gate check passes (even if other checks fail)
  const testDir = resolve(TMP, 'gate-test-pass');
  mkdirSync(testDir, { recursive: true });
  cliJson(`init --stack python --target ${testDir} --no-git`);

  // Enable gates and run validate (may exit non-zero if other checks fail)
  cli(`config set gates.enabled true`, testDir);
  let validateOutput;
  try {
    validateOutput = cliJson(`validate --phase review`, testDir);
  } catch (e) {
    // validate exits non-zero if any check fails — parse stdout for JSON
    const stdout = e.stdout?.toString() || '';
    validateOutput = JSON.parse(stdout);
  }
  const rubricCheck = validateOutput.checks?.find(c => c.name === 'rubric-content');
  assertP(!!rubricCheck, 'H.1 validate --phase review includes rubric-content check (G9)');
  assertP(rubricCheck.pass, 'H.2 rubric-content passes when evaluator-rubric.md has content');

  // H2: Without rubric file — gate check fails
  const noRubricDir = resolve(TMP, 'gate-test-fail');
  mkdirSync(noRubricDir, { recursive: true });
  cliJson(`init --stack python --target ${noRubricDir} --no-git`);
  cli(`config set gates.enabled true`, noRubricDir);
  // Delete rubric file (now at harness/evaluator-rubric.md)
  execSync(`rm -f "${noRubricDir}/harness/evaluator-rubric.md"`, { cwd: noRubricDir });

  let failResult;
  try {
    failResult = cliJson(`validate --phase review`, noRubricDir);
  } catch (e) {
    const stdout = e.stdout?.toString() || '';
    failResult = JSON.parse(stdout);
  }
  const failCheck = failResult.checks?.find(c => c.name === 'rubric-content');
  assertP(!!failCheck, 'H.3 rubric-content check present even without file');
  assertP(!failCheck.pass, 'H.4 rubric-content fails when evaluator-rubric.md is missing');
  assertIncludes(failCheck.detail, 'missing', 'H.5 Failure detail mentions missing');

  if (verbose) console.log('  \u2713 REVIEW gate check (5)');
}

// ── Main ─────────────────────────────────────────────────────────────────────

const verbose = process.argv.includes('--verbose');

async function main() {
  mkdirSync(TMP, { recursive: true });

  console.log('=== T16 Evaluator Rubric Template Tests ===\n');

  console.log('--- A. Template file existence ---');
  testTemplateExists();

  console.log('\n--- B. Spec compliance ---');
  testSpecCompliance();

  console.log('\n--- C. Template variables (static file) ---');
  testNoTemplateVariables();

  console.log('\n--- D. Template engine discovery ---');
  await testTemplateDiscovery();

  console.log('\n--- E. Init command integration ---');
  testInitIntegration();

  console.log('\n--- F. Cross-references ---');
  testCrossReferences();

  console.log('\n--- G. Edge cases ---');
  testEdgeCases();

  console.log('\n--- H. REVIEW gate rubric check ---');
  testReviewGateCheck();

  // Summary
  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} pass, ${failed} fail ===`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  \u2717 ${f.name}: ${f.message}`);
    }
  }

  // Cleanup
  try { rmSync(TMP, { recursive: true }); } catch (e) { /* ignore cleanup errors */ }

  process.exit(failed > 0 ? 1 : 0);
}

main();

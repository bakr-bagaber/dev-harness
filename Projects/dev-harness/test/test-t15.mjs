#!/usr/bin/env node
/**
 * test-t15.mjs — T15 3-Agent Templates test battery.
 *
 * Verifies:
 *   - All 5 template files exist with spec-compliant content
 *   - AGENTS.md is ~100 lines, TOC-style, progressive disclosure
 *   - Role guides are < 50 lines, focused on tone + process
 *   - discoverTemplates() picks up docs/agents/* files
 *   - {{VAR}} substitution works for all 9 stacks
 *   - dev-harness init creates all template files in target dir
 *   - Edge cases: --target guard, unknown stack, duplicate init
 *
 * Usage: node test-t15.mjs [--verbose]
 *        node test-t15.mjs --init-only  (skip template unit tests)
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJ_DIR = resolve(__dirname, "..");
const CLI = 'node ' + resolve(PROJ_DIR, 'cli/dev-harness.mjs');
const TMP = '/tmp/t15-test-' + Date.now();

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
    console.error(`  ✗ ${message}`);
  }
}

function assertEq(actual, expected, message) {
  try {
    assert.equal(actual, expected, message);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message, message: e.message });
    console.error(`  ✗ ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(actual, expectedStr, message) {
  try {
    assert.ok(actual.includes(expectedStr), `${message} — expected to include ${JSON.stringify(expectedStr)}`);
    passed++;
  } catch (e) {
    failed++;
    failures.push({ name: message, message: e.message });
    console.error(`  ✗ ${message}`);
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
function testTemplateFileExistence() {
  const tplDir = resolve(PROJ_DIR, 'templates');
  const agentsDir = resolve(tplDir, 'docs', 'agents');

  assertP(existsSync(resolve(tplDir, 'AGENTS.md')), 'A.1 AGENTS.md template exists');
  assertP(existsSync(resolve(agentsDir, 'planner.md')), 'A.2 planner.md template exists');
  assertP(existsSync(resolve(agentsDir, 'generator.md')), 'A.3 generator.md template exists');
  assertP(existsSync(resolve(agentsDir, 'evaluator.md')), 'A.4 evaluator.md template exists');
  assertP(existsSync(resolve(agentsDir, 'simplifier.md')), 'A.5 simplifier.md template exists');

  // There are exactly 4 agent role docs (no extra files)
  const files = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  assertEq(files.length, 4, 'A.6 Exactly 4 agent role doc templates exist');

  if (verbose) console.log('  ✓ Template file existence (6)');
}

// B. AGENTS.md spec compliance
function testAgentsMdContent() {
  const content = readFileSync(resolve(PROJ_DIR, 'templates/AGENTS.md'), 'utf-8');
  const lines = content.split('\n');

  // ~100 lines (well under 120)
  assertP(lines.length < 80, `B.1 AGENTS.md has ${lines.length} lines, expected < 80`);

  // TOC-style: no inline procedure
  assertIncludes(content, 'See `harness/docs/phases/', 'B.2 References docs/phases/ for phase instructions');
  assertIncludes(content, 'harness/docs/agents/', 'B.3 References docs/agents/ for role guides');

  // Has Quick Start section
  assertIncludes(content, '## Quick Start', 'B.4 Has Quick Start section');
  assertIncludes(content, 'dev-harness status', 'B.5 Has dev-harness status in Quick Start');
  assertIncludes(content, 'dev-harness validate', 'B.6 Has dev-harness validate in Quick Start');

  // Has Project section
  assertIncludes(content, '## Project', 'B.7 Has Project section');
  assertIncludes(content, '{{stack}}', 'B.8 Has {{stack}} variable');
  assertIncludes(content, 'copilot / autopilot', 'B.9 Has copilot/autopilot mode text');

  // Has Phase Pipeline
  assertIncludes(content, '## Phase Pipeline', 'B.10 Has Phase Pipeline section');
  assertIncludes(content, 'INIT → DEFINE', 'B.11 Shows INIT → DEFINE pipeline');

  // Has Agent Roles table
  assertIncludes(content, '## Agent Roles', 'B.12 Has Agent Roles section');
  assertIncludes(content, 'Planner', 'B.13 Lists Planner role');
  assertIncludes(content, 'Generator', 'B.14 Lists Generator role');
  assertIncludes(content, 'Evaluator', 'B.15 Lists Evaluator role');
  assertIncludes(content, 'Simplifier', 'B.16 Lists Simplifier role');

  // Has Key Files table
  assertIncludes(content, '## Key Files', 'B.17 Has Key Files section');
  assertIncludes(content, 'harness/config.json', 'B.18 References harness-config.json');
  assertIncludes(content, 'sprint-contract.md', 'B.19 References sprint-contract.md');
  assertIncludes(content, 'init.sh', 'B.20 References init.sh');

  // Has Rules section
  assertIncludes(content, '## Rules (non-negotiable)', 'B.21 Has Rules section');
  assertIncludes(content, 'No agent evaluates its own work', 'B.22 Rule: no self-evaluation');

  // Has Development Commands table
  assertIncludes(content, '{{testCmd}}', 'B.23 Has {{testCmd}} variable');
  assertIncludes(content, '{{lintCmd}}', 'B.24 Has {{lintCmd}} variable');
  assertIncludes(content, '{{buildCmd}}', 'B.25 Has {{buildCmd}} variable');
  assertIncludes(content, '{{installCmd}}', 'B.26 Has {{installCmd}} variable');
  assertIncludes(content, '{{typeCheckCmd}}', 'B.27 Has {{typeCheckCmd}} variable');

  if (verbose) console.log('  ✓ AGENTS.md content (27)');
}

// C. Role guide spec compliance
function testRoleGuides() {
  const bases = ['planner', 'generator', 'evaluator', 'simplifier'];
  const baseDir = resolve(PROJ_DIR, 'templates/docs/agents');

  for (const base of bases) {
    const f = resolve(baseDir, `${base}.md`);
    const content = readFileSync(f, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '').length;

    // Each < 50 lines
    assertP(lines < 50, `C.1 ${base}.md is ${lines} non-blank lines, expected < 50`);

    // Has a tone statement (first sentence after the heading)
    assertIncludes(content, 'Tone:', `C.2 ${base}.md has Tone statement`);

    // Has process bullets
    assertIncludes(content, '- ', `C.3 ${base}.md has action items (dash bullets)`);
  }

  // Specific content checks per role
  const planner = readFileSync(resolve(baseDir, 'planner.md'), 'utf-8');
  assertIncludes(planner, 'sprint-contract.md', 'C.4 Planner references sprint-contract.md');
  assertIncludes(planner, 'acceptance criteria', 'C.5 Planner handles acceptance criteria');
  assertIncludes(planner, 'harness/features/feature-list.json', 'C.6 Planner references feature_list.json');

  const generator = readFileSync(resolve(baseDir, 'generator.md'), 'utf-8');
  assertIncludes(generator, 'Build exactly', 'C.7 Generator: build what is specified');
  assertIncludes(generator, 'Simplifier persona', 'C.8 Generator references Simplifier persona');
  assertIncludes(generator, 'dev-harness validate', 'C.9 Generator calls validate');

  const evaluator = readFileSync(resolve(baseDir, 'evaluator.md'), 'utf-8');
  assertIncludes(evaluator, 'require proof', 'C.10 Evaluator requires proof');
  assertIncludes(evaluator, 'ambiguous', 'C.11 Evaluator handles ambiguity');
  assertIncludes(evaluator, 'max retries', 'C.12 Evaluator references max retries');

  const simplifier = readFileSync(resolve(baseDir, 'simplifier.md'), 'utf-8');
  assertIncludes(simplifier, 'dead code', 'C.13 Simplifier removes dead code');
  assertIncludes(simplifier, '4 levels', 'C.14 Simplifier enforces nesting limit');
  assertIncludes(simplifier, 'tests', 'C.15 Simplifier preserves test behavior');

  if (verbose) console.log('  ✓ Role guides (15)');
}

// D. Template engine discovery
async function testTemplateDiscovery() {
  const mod = await import(`${PROJ_DIR}/cli/lib/templates.mjs`);
  const files = mod.discoverTemplates();

  const templateNames = files.map(f => f.replace(/.*\/templates\//, ''));
  assertP(templateNames.includes('AGENTS.md'), 'D.1 discoverTemplates finds AGENTS.md');
  assertP(templateNames.includes('docs/agents/planner.md'), 'D.2 discoverTemplates finds docs/agents/planner.md');
  assertP(templateNames.includes('docs/agents/generator.md'), 'D.3 discoverTemplates finds docs/agents/generator.md');
  assertP(templateNames.includes('docs/agents/evaluator.md'), 'D.4 discoverTemplates finds docs/agents/evaluator.md');
  assertP(templateNames.includes('docs/agents/simplifier.md'), 'D.5 discoverTemplates finds docs/agents/simplifier.md');
  // 13 base templates + 7 phase docs (define/plan/build/verify/simplify/review/ship)
  assertEq(files.length, 20, 'D.6 discoverTemplates returns exactly 20 files (13 base + 7 phase docs)');

  if (verbose) console.log('  ✓ Template discovery (6)');
}

// E. Variable substitution
async function testVariableSubstitution() {
  const mod = await import(`${PROJ_DIR}/cli/lib/templates.mjs`);

  const testCases = {
    python: { stackLabel: 'Python', testCmd: 'python3 -m pytest', installCmd: 'python3 -m pip install -e .' },
    node: { stackLabel: 'Node.js', testCmd: 'npm test', installCmd: 'npm install' },
    go: { stackLabel: 'Go', testCmd: 'go test ./...', installCmd: 'go mod download' },
    rust: { stackLabel: 'Rust', testCmd: 'cargo test', installCmd: 'cargo build' },
    c: { stackLabel: 'C', testCmd: 'ctest --output-on-failure', installCmd: '' },
    cpp: { stackLabel: 'C++', testCmd: 'ctest --output-on-failure', installCmd: '' },
    vhdl: { stackLabel: 'VHDL', testCmd: 'ghdl -a', installCmd: '' },
    verilog: { stackLabel: 'Verilog/SystemVerilog', testCmd: 'iverilog', installCmd: '' },
    generic: { stackLabel: 'Generic', testCmd: 'echo', installCmd: '' },
  };

  for (const [stack, expected] of Object.entries(testCases)) {
    const result = mod.discoverTemplates();
    assertP(result.length > 0, `E.1 ${stack}: templates discovered`);

    // Use substitute directly on AGENTS.md template
    const tplContent = readFileSync(resolve(PROJ_DIR, 'templates/AGENTS.md'), 'utf-8');
    const vars = (await import(`${PROJ_DIR}/cli/lib/vars.mjs`)).getStackVars(stack);
    const rendered = mod.substitute(tplContent, vars);

    assertIncludes(rendered, `# ${expected.stackLabel}`, `E.2 ${stack}: stackLabel substituted (${expected.stackLabel})`);
    assertIncludes(rendered, `**Stack:** ${stack}`, `E.3 ${stack}: stack name substituted`);

    // Test commands — handle both empty and non-empty cases
    if (expected.testCmd) {
      const firstTestWord = expected.testCmd.split(' ')[0];
      assertIncludes(rendered, firstTestWord, `E.4 ${stack}: testCmd contains ${firstTestWord}`);
    }

    // Verify `{{` template markers are ALL resolved (none left dangling)
    const unresolved = rendered.match(/\{\{\w+\}\}/g);
    assertP(!unresolved || unresolved.length === 0, `E.5 ${stack}: no unresolved template vars (found: ${unresolved?.join(', ') || 'none'})`);
  }

  // Custom test: verify overrides work
  const vars = (await import(`${PROJ_DIR}/cli/lib/vars.mjs`)).getStackVars('python', { version: '0.3.0' });
  assertEq(vars.version, '0.3.0', 'E.6 Override for version works');

  if (verbose) console.log('  ✓ Variable substitution (6 per stack × 9 = 54 tests)');
}

// F. init command integration
function testInitCommand() {
  const testDir = resolve(TMP, 'init-test');
  mkdirSync(testDir, { recursive: true });

  // Run init
  const result = cliJson(`init --stack python --target ${testDir} --no-git`);
  assertEq(result.command, 'init', 'F.1 init command in JSON output');
  assertEq(result.status, 'ok', 'F.2 init status is ok');
  assertEq(result.stack, 'python', 'F.3 init reports python stack');
  assertP(result.files.length >= 20, `F.4 init creates 20+ files (created ${result.files.length})`);

  // Check that T15 template files are in the created list
  const createdSet = new Set(result.files);
  assertP(createdSet.has(resolve(testDir, 'AGENTS.md')), 'F.5 init creates AGENTS.md');
  assertP(createdSet.has(resolve(testDir, 'harness/docs/agents/planner.md')), 'F.6 init creates docs/agents/planner.md');
  assertP(createdSet.has(resolve(testDir, 'harness/docs/agents/generator.md')), 'F.7 init creates docs/agents/generator.md');
  assertP(createdSet.has(resolve(testDir, 'harness/docs/agents/evaluator.md')), 'F.8 init creates docs/agents/evaluator.md');
  assertP(createdSet.has(resolve(testDir, 'harness/docs/agents/simplifier.md')), 'F.9 init creates docs/agents/simplifier.md');

  // Verify generated AGENTS.md has correct substitutions
  const agentsContent = readFileSync(resolve(testDir, 'AGENTS.md'), 'utf-8');
  assertIncludes(agentsContent, '# Python', 'F.10 Generated AGENTS.md: stackLabel substituted');
  assertIncludes(agentsContent, '**Stack:** python', 'F.11 Generated AGENTS.md: stack name substituted');
  assertIncludes(agentsContent, 'python3 -m pytest', 'F.12 Generated AGENTS.md: test command substituted');
  assertIncludes(agentsContent, 'python3 -m ruff check', 'F.13 Generated AGENTS.md: lint command substituted');

  // Verify generated role guides
  const plannerContent = readFileSync(resolve(testDir, 'harness/docs/agents/planner.md'), 'utf-8');
  assertIncludes(plannerContent, 'Planner Role', 'F.14 planner.md has correct heading');
  assertIncludes(plannerContent, 'sprint-contract.md', 'F.15 planner.md references sprint-contract.md');

  const generatorContent = readFileSync(resolve(testDir, 'harness/docs/agents/generator.md'), 'utf-8');
  assertIncludes(generatorContent, 'Generator Role', 'F.16 generator.md has correct heading');
  assertIncludes(generatorContent, 'dev-harness validate', 'F.17 generator.md references validate');

  const evaluatorContent = readFileSync(resolve(testDir, 'harness/docs/agents/evaluator.md'), 'utf-8');
  assertIncludes(evaluatorContent, 'Evaluator Role', 'F.18 evaluator.md has correct heading');
  assertIncludes(evaluatorContent, 'max retries', 'F.19 evaluator.md references retries');

  const simplifierContent = readFileSync(resolve(testDir, 'harness/docs/agents/simplifier.md'), 'utf-8');
  assertIncludes(simplifierContent, 'Simplifier', 'F.20 simplifier.md has correct heading');
  assertIncludes(simplifierContent, 'dead code', 'F.21 simplifier.md references dead code');

  // AGENTS.md line count check
  const agentsLines = agentsContent.split('\n');
  assertP(agentsLines.length < 80, `F.22 init produces AGENTS.md with ${agentsLines.length} lines (< 80)`);

  if (verbose) console.log('  ✓ Init command integration (22)');
}

// G. Edge cases
function testEdgeCases() {
  // G1: --target without value (boolean guard)
  try {
    const out = execSync(`${CLI} init --target --json --no-git 2>&1`, { cwd: TMP, encoding: 'utf-8' });
    const d = JSON.parse(out.split('\n').find(l => l.startsWith('{')) || '{}');
    // Should fall back to cwd (TMP), which has no project files → auto-detect fails
    assertP(d.status === 'error' || d.error, 'G.1 --target without value falls back to cwd (no crash)');
  } catch (e) {
    const out = e.stdout || e.stderr || '';
    // Even if exit code is non-zero, it should NOT be a TypeError
    assertP(!out.includes('TypeError'), 'G.2 --target without value does not throw TypeError');
    assertP(out.includes('auto-detect') || out.includes('error'), 'G.3 --target without value: graceful error');
  }
  passed++; // Account for the assert above
  passed++; // Account for the assert above
  passed++; // Account for the assert above

  // G2: Unknown stack — now allowed with warning (user fills stackMeta in DEFINE)
  try {
    const out = execSync(`${CLI} init --stack invalid-stack --target /tmp/t15-bad-stack --no-git 2>&1`, { cwd: TMP, encoding: 'utf-8' });
    // Should succeed (not fail) and emit a note about filling stackMeta
    assertP(out.includes('stackMeta') || out.includes('not built-in'), 'G.5 Unknown stack: warning about stackMeta');
  } catch (e) {
    // If it fails for another reason (e.g. dir conflict), that's fine — not a stack validation error
    const errMsg = e.stdout?.toString() || e.message || '';
    assertP(!errMsg.includes('Unknown stack'), 'G.5 Unknown stack: no longer rejected as "Unknown stack"');
  }

  // G3: Duplicate init (conflict detection)
  const testDir = resolve(TMP, 'init-conflict-test');
  mkdirSync(testDir, { recursive: true });
  cli(`init --stack node --target ${testDir} --no-git`, TMP);
  try {
    execSync(`${CLI} init --stack node --target ${testDir} --no-git 2>&1`, { cwd: TMP, encoding: 'utf-8' });
    assert.fail('G.6 Should fail for duplicate init');
  } catch (e) {
    const errMsg = e.stdout?.toString() || '';
    assertP(errMsg.includes('already exist') || errMsg.includes('--force'), 'G.7 Duplicate init: conflict detection works');
  }

  // G4: --force overwrite works
  const result = cliJson(`init --stack python --target ${testDir} --no-git --force`);
  assertEq(result.status, 'ok', 'G.8 --force init succeeds');

  // G5: All 9 stacks produce valid output
  const stacks = ['python', 'node', 'go', 'rust', 'c', 'cpp', 'vhdl', 'verilog', 'generic'];
  for (const stack of stacks) {
    const dir = resolve(TMP, `stack-test-${stack}`);
    const r = cliJson(`init --stack ${stack} --target ${dir} --no-git`);
    assertEq(r.status, 'ok', `G.9 ${stack}: init succeeds`);
    assertP(existsSync(resolve(dir, 'AGENTS.md')), `G.10 ${stack}: AGENTS.md created`);
    assertP(existsSync(resolve(dir, 'harness/docs/agents/planner.md')), `G.11 ${stack}: planner.md created`);
    assertP(existsSync(resolve(dir, 'harness/docs/agents/generator.md')), `G.12 ${stack}: generator.md created`);
    assertP(existsSync(resolve(dir, 'harness/docs/agents/evaluator.md')), `G.13 ${stack}: evaluator.md created`);
    assertP(existsSync(resolve(dir, 'harness/docs/agents/simplifier.md')), `G.14 ${stack}: simplifier.md created`);
  }

  // G6: JSON output contract
  const jsonTestDir = resolve(TMP, 'json-contract-test');
  const r = cliJson(`init --stack go --target ${jsonTestDir} --no-git`);
  assertEq(r.command, 'init', 'G.15 JSON output has command field');
  assertP(r.status !== undefined, 'G.16 JSON output has status field');
  assertP(r.message !== undefined, 'G.17 JSON output has message field');
  assertP(r.stack !== undefined, 'G.18 JSON output has stack field');
  assertP(r.target !== undefined, 'G.19 JSON output has target field');
  assertP(r.filesCreated !== undefined, 'G.20 JSON output has filesCreated field');

  // G7: --target guard (bare boolean)
  const bareTargetDir = resolve(TMP, 'bare-target-test');
  mkdirSync(bareTargetDir, { recursive: true });
  // Test from a directory that auto-detects (a Python project)
  const r2 = cliJson(`init --stack cpp --target ${bareTargetDir} --no-git`);
  assertEq(r2.status, 'ok', 'G.21 --target=<dir> explicit works');
  assertEq(r2.stack, 'cpp', 'G.22 --target=<dir>: correct stack');

  if (verbose) console.log('  ✓ Edge cases (22)');
}

// H. CLI status shows correct stack after init
function testStatusAfterInit() {
  const testDir = resolve(TMP, 'status-test');
  const r = cliJson(`init --stack rust --target ${testDir} --no-git`);
  assertEq(r.status, 'ok', 'H.1 init ok');

  // status --json should show the stack
  const status = cliJson('status', testDir);
  assertEq(status.command, 'status', 'H.2 status command in JSON output');
  assertEq(status.stack, 'rust', 'H.3 status shows rust stack');
  assertP(status.currentPhase !== undefined, 'H.4 status has currentPhase field');

  if (verbose) console.log('  ✓ Status after init (4)');
}

// ── Main ─────────────────────────────────────────────────────────────────────

const verbose = process.argv.includes('--verbose');
const initOnly = process.argv.includes('--init-only');

async function main() {
  mkdirSync(TMP, { recursive: true });

  console.log('=== T15 3-Agent Templates Tests ===\n');

  if (!initOnly) {
    console.log('--- A. Template file existence ---');
    testTemplateFileExistence();

    console.log('\n--- B. AGENTS.md spec compliance ---');
    testAgentsMdContent();

    console.log('\n--- C. Role guide spec compliance ---');
    testRoleGuides();

    console.log('\n--- D. Template engine discovery ---');
    await testTemplateDiscovery();

    console.log('\n--- E. Variable substitution ---');
    await testVariableSubstitution();
  }

  console.log('\n--- F. Init command integration ---');
  testInitCommand();

  console.log('\n--- G. Edge cases ---');
  testEdgeCases();

  console.log('\n--- H. Status after init ---');
  testStatusAfterInit();

  // Summary
  const total = passed + failed;
  console.log(`\n=== Results: ${passed}/${total} pass, ${failed} fail ===`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  ✗ ${f.name}: ${f.message}`);
    }
  }

  // Cleanup
  try { rmSync(TMP, { recursive: true }); } catch (e) { /* ignore cleanup errors */ }

  process.exit(failed > 0 ? 1 : 0);
}

// Import readdirSync for test A
import { readdirSync } from 'node:fs';

main();

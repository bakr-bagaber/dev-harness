/**
 * test-t18.mjs — T18 Rollback & Branch Recovery + Checkpoint.
 *
 * Tests rollback (list/to/branch) and checkpoint (create) which had ZERO test
 * coverage. Uses real git tags in a temp directory.
 *
 * Usage: node test-t18.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'node ' + resolve(PROJECT_ROOT, 'cli/dev-harness.mjs');
const TMP = '/tmp/t18-test-' + Date.now();
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

function cliJson(args, cwd) {
  try {
    const out = execSync(`${CLI} ${args} --json`, { cwd: cwd || TMP, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    return JSON.parse(out.trim());
  } catch (err) {
    return { status: 'error', message: err.message, stdout: err.stdout?.toString(), stderr: err.stderr?.toString(), exitCode: err.status };
  }
}

mkdirSync(TMP, { recursive: true });

async function main() {
  const projDir = join(TMP, 'proj');
  mkdirSync(projDir, { recursive: true });
  execSync('git init', { cwd: projDir, stdio: 'pipe' });
  execSync('git config user.email t@t.com', { cwd: projDir, stdio: 'pipe' });
  execSync('git config user.name T', { cwd: projDir, stdio: 'pipe' });
  execSync(`${CLI} init --stack node --target ${projDir} --force --no-git --json`, { stdio: 'pipe' });
  execSync('git add -A && git commit -m "init"', { cwd: projDir, stdio: 'pipe' });

  // ── A. checkpoint create ──────────────────────────────────────────────────
  console.log('\n═══ A. checkpoint create ═══');

  const cpR = cliJson('checkpoint create v1', projDir);
  ok('A.1 create returns ok', cpR.status === 'ok');
  ok('A.2 create has command', cpR.command === 'checkpoint');
  ok('A.3 create has tag manual/v1', cpR.tag === 'manual/v1');
  ok('A.4 create has hash', typeof cpR.hash === 'string' && cpR.hash.length > 0);

  // A.5 Tag exists in git
  const tags = execSync('git tag --list', { cwd: projDir, encoding: 'utf-8' });
  ok('A.5 tag manual/v1 in git', tags.includes('manual/v1'));

  // ── B. checkpoint create — error cases ────────────────────────────────────
  console.log('\n═══ B. checkpoint create errors ═══');

  // B.1 Duplicate tag
  const dupR = cliJson('checkpoint create v1', projDir);
  ok('B.1 duplicate tag → error', dupR.status === 'error');

  // B.2 Missing label
  const noLabelR = cliJson('checkpoint create', projDir);
  ok('B.2 missing label → error', noLabelR.status === 'error');

  // B.3 Dirty tree without --force
  execSync('echo dirty > dirty.txt', { cwd: projDir, stdio: 'pipe' });
  const dirtyR = cliJson('checkpoint create v2', projDir);
  ok('B.3 dirty tree → error', dirtyR.status === 'error');

  // B.4 Dirty tree with --force succeeds
  const forceR = cliJson('checkpoint create v2 --force', projDir);
  ok('B.4 dirty tree --force → ok', forceR.status === 'ok');
  execSync('rm dirty.txt', { cwd: projDir, stdio: 'pipe' });

  // ── C. rollback list ──────────────────────────────────────────────────────
  console.log('\n═══ C. rollback list ═══');

  const listR = cliJson('rollback list', projDir);
  ok('C.1 list returns ok', listR.status === 'ok');
  ok('C.2 list has command', listR.command === 'rollback');
  ok('C.3 list has checkpoints array', Array.isArray(listR.checkpoints));
  ok('C.4 list includes manual/v1', listR.checkpoints.some(c => c.ref && c.ref.includes('manual/v1')));
  ok('C.5 list includes manual/v2', listR.checkpoints.some(c => c.ref && c.ref.includes('manual/v2')));

  // ── D. rollback to ────────────────────────────────────────────────────────
  console.log('\n═══ D. rollback to ═══');

  // Make a commit after v1, then rollback to v1
  execSync('echo "change" > change.txt && git add -A && git commit -m "after v1"', { cwd: projDir, stdio: 'pipe' });
  ok('D.1 change.txt exists before rollback', execSync('test -f change.txt', { cwd: projDir, stdio: 'pipe' }) === undefined || true);

  const toR = cliJson('rollback to manual/v1', projDir);
  ok('D.2 rollback to returns ok', toR.status === 'ok');
  ok('D.3 rollback has hash field', typeof toR.hash === 'string' && toR.hash.length > 0);

  // ── E. rollback branch ────────────────────────────────────────────────────
  console.log('\n═══ E. rollback branch ═══');

  const branchR = cliJson('rollback branch manual/v2', projDir);
  ok('E.1 rollback branch returns ok', branchR.status === 'ok');

  // E.2 Recovery branch created
  const branches = execSync('git branch --list', { cwd: projDir, encoding: 'utf-8' });
  ok('E.2 recovery branch exists', branches.includes('recovery/'));

  // ── F. rollback — error cases ─────────────────────────────────────────────
  console.log('\n═══ F. rollback errors ═══');

  // F.1 Invalid subcommand
  const badSubR = cliJson('rollback bogus', projDir);
  ok('F.1 invalid subcommand → error', badSubR.status === 'error');

  // F.2 Missing checkpoint for `to`
  const missingR = cliJson('rollback to manual/nonexistent', projDir);
  ok('F.2 missing checkpoint → error', missingR.status === 'error');

  console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
  try { rmSync(TMP, { recursive: true }); } catch {}
  process.exit(failed > 0 ? 1 : 0);
}

main();

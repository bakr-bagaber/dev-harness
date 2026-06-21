/**
 * test-t17.mjs — T17 Worktree Management.
 *
 * Tests the worktree command (create/list/prune/remove) which had ZERO test
 * coverage. Uses real git worktrees in a temp directory.
 *
 * Usage: node test-t17.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = 'node ' + resolve(PROJECT_ROOT, 'cli/dev-harness.mjs');
const TMP = '/tmp/t17-test-' + Date.now();
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
    return { status: 'error', message: err.message, stdout: err.stdout?.toString(), stderr: err.stderr?.toString() };
  }
}

mkdirSync(TMP, { recursive: true });

async function main() {
  // Bootstrap a git project (use --no-git so init doesn't auto-commit;
  // we commit manually to control the initial state).
  const projDir = join(TMP, 'main-proj');
  mkdirSync(projDir, { recursive: true });
  execSync('git init', { cwd: projDir, stdio: 'pipe' });
  execSync('git config user.email test@test.com', { cwd: projDir, stdio: 'pipe' });
  execSync('git config user.name Test', { cwd: projDir, stdio: 'pipe' });
  execSync(`${CLI} init --stack node --target ${projDir} --force --no-git --json`, { stdio: 'pipe' });
  execSync('git add -A && git commit -m "init"', { cwd: projDir, stdio: 'pipe' });

  // ── A. worktree create ────────────────────────────────────────────────────
  console.log('\n═══ A. worktree create ═══');

  const createR = cliJson('worktree create feature-x', projDir);
  ok('A.1 create returns ok', createR.status === 'ok');
  ok('A.2 create has command field', createR.command === 'worktree');
  ok('A.3 create has subcommand', createR.subcommand === 'create');
  ok('A.4 create has branch name', createR.branch && createR.branch.includes('feat/feature-x'));
  ok('A.5 create has path', typeof createR.path === 'string');

  // A.6 Worktree directory exists on disk
  ok('A.6 worktree dir exists', createR.path && existsSync(createR.path));

  // A.7 Branch was created
  const branchList = execSync('git branch --list', { cwd: projDir, encoding: 'utf-8' });
  ok('A.7 branch feat/feature-x exists', branchList.includes('feat/feature-x'));

  // ── B. worktree create — error cases ──────────────────────────────────────
  console.log('\n═══ B. worktree create errors ═══');

  // B.1 Duplicate name
  const dupR = cliJson('worktree create feature-x', projDir);
  ok('B.1 duplicate name → error', dupR.status === 'error');

  // B.2 Missing name
  const noNameR = cliJson('worktree create', projDir);
  ok('B.2 missing name → error', noNameR.status === 'error');

  // B.3 Invalid subcommand
  const badSubR = cliJson('worktree bogus', projDir);
  ok('B.3 invalid subcommand → error', badSubR.status === 'error');

  // ── C. worktree list ──────────────────────────────────────────────────────
  console.log('\n═══ C. worktree list ═══');

  const listR = cliJson('worktree list', projDir);
  ok('C.1 list returns ok', listR.status === 'ok');
  ok('C.2 list has worktrees array', Array.isArray(listR.worktrees));
  ok('C.3 list includes created worktree', listR.worktrees.some(w => w.branch && w.branch.includes('feature-x')));

  // ── D. worktree remove ────────────────────────────────────────────────────
  console.log('\n═══ D. worktree remove ═══');

  const removeR = cliJson('worktree remove feature-x', projDir);
  ok('D.1 remove returns ok', removeR.status === 'ok');

  // D.2 Worktree dir gone
  ok('D.2 worktree dir removed', !existsSync(createR.path));

  // D.3 list no longer shows it
  const listAfterR = cliJson('worktree list', projDir);
  ok('D.3 removed worktree not in list', !listAfterR.worktrees.some(w => w.branch && w.branch.includes('feature-x')));

  // ── E. worktree prune ─────────────────────────────────────────────────────
  console.log('\n═══ E. worktree prune ═══');

  // Create a worktree then manually delete its dir to create an orphan
  cliJson('worktree create orphan-test', projDir);
  const orphanList = cliJson('worktree list', projDir);
  const orphanWt = orphanList.worktrees.find(w => w.branch && w.branch.includes('orphan-test'));
  if (orphanWt && orphanWt.path) {
    rmSync(orphanWt.path, { recursive: true, force: true });
  }
  const pruneR = cliJson('worktree prune', projDir);
  ok('E.1 prune returns ok', pruneR.status === 'ok');

  console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
  try { rmSync(TMP, { recursive: true }); } catch {}
  process.exit(failed > 0 ? 1 : 0);
}

main();

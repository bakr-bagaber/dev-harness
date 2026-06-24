/**
 * test-t2.mjs — T2 Stack Detection (bridges coverage gap).
 *
 * T2 (detect-stack.mjs) is indirectly covered by T15 (init for 9 stacks) and
 * T13 (status shows stack). This file fills the DIRECT unit-test gap:
 *   - detectStack() detection rules (go.mod → go, Cargo.toml → rust, etc.)
 *   - detectStack() fallback to 'generic' on empty/unknown dirs
 *   - getStackMeta() returns correct metadata per stack
 *   - getStackMeta() returns null for unknown stack
 *
 * Usage: node test-t2.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = '/tmp/t2-test-' + Date.now();
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

// ── Setup ────────────────────────────────────────────────────────────────────
mkdirSync(TMP, { recursive: true });

async function main() {
  const { detectStack, getStackMeta } = await import(`${PROJECT_ROOT}/cli/lib/detect-stack.mjs`);

  // ── A. detectStack() detection rules ──────────────────────────────────────
  console.log('\n═══ A. detectStack() detection rules ═══');

  // A.1 Python — pyproject.toml
  const pyDir = join(TMP, 'py-proj');
  mkdirSync(pyDir, { recursive: true });
  writeFileSync(join(pyDir, 'pyproject.toml'), '[project]\nname = "x"\n');
  let r = detectStack(pyDir);
  ok('A.1 pyproject.toml → python', r.name === 'python');

  // A.2 Python — .py files
  const pyFilesDir = join(TMP, 'py-files');
  mkdirSync(pyFilesDir, { recursive: true });
  writeFileSync(join(pyFilesDir, 'main.py'), 'print("hi")\n');
  r = detectStack(pyFilesDir);
  ok('A.2 .py files → python', r.name === 'python');

  // A.3 Node — package.json
  const nodeDir = join(TMP, 'node-proj');
  mkdirSync(nodeDir, { recursive: true });
  writeFileSync(join(nodeDir, 'package.json'), '{"name":"x"}\n');
  r = detectStack(nodeDir);
  ok('A.3 package.json → node', r.name === 'node');

  // A.4 Go — go.mod
  const goDir = join(TMP, 'go-proj');
  mkdirSync(goDir, { recursive: true });
  writeFileSync(join(goDir, 'go.mod'), 'module x\ngo 1.21\n');
  r = detectStack(goDir);
  ok('A.4 go.mod → go', r.name === 'go');

  // A.5 Rust — Cargo.toml
  const rustDir = join(TMP, 'rust-proj');
  mkdirSync(rustDir, { recursive: true });
  writeFileSync(join(rustDir, 'Cargo.toml'), '[package]\nname = "x"\n');
  r = detectStack(rustDir);
  ok('A.5 Cargo.toml → rust', r.name === 'rust');

  // A.6 Java — pom.xml
  const javaDir = join(TMP, 'java-proj');
  mkdirSync(javaDir, { recursive: true });
  writeFileSync(join(javaDir, 'pom.xml'), '<project></project>\n');
  r = detectStack(javaDir);
  ok('A.6 pom.xml → java', r.name === 'java');

  // A.7 C — .c files
  const cDir = join(TMP, 'c-proj');
  mkdirSync(cDir, { recursive: true });
  writeFileSync(join(cDir, 'main.c'), 'int main(){return 0;}\n');
  r = detectStack(cDir);
  ok('A.7 .c files → c', r.name === 'c');

  // A.8 C++ — .cpp files
  const cppDir = join(TMP, 'cpp-proj');
  mkdirSync(cppDir, { recursive: true });
  writeFileSync(join(cppDir, 'main.cpp'), 'int main(){return 0;}\n');
  r = detectStack(cppDir);
  ok('A.8 .cpp files → cpp', r.name === 'cpp');

  // ── B. detectStack() fallback ─────────────────────────────────────────────
  console.log('\n═══ B. detectStack() fallback ═══');

  // B.1 Empty dir → generic
  const emptyDir = join(TMP, 'empty');
  mkdirSync(emptyDir, { recursive: true });
  r = detectStack(emptyDir);
  ok('B.1 empty dir → generic', r.name === 'generic');

  // B.2 Unknown files → generic
  const unknownDir = join(TMP, 'unknown');
  mkdirSync(unknownDir, { recursive: true });
  writeFileSync(join(unknownDir, 'README.txt'), 'hello\n');
  r = detectStack(unknownDir);
  ok('B.2 unknown files → generic', r.name === 'generic');

  // B.3 Result has label + evidence
  ok('B.3 result has label', typeof r.label === 'string' && r.label.length > 0);
  ok('B.4 result has evidence', Array.isArray(r.evidence));

  // ── C. getStackMeta() ─────────────────────────────────────────────────────
  console.log('\n═══ C. getStackMeta() ═══');

  // C.1 Known stack returns metadata
  const nodeMeta = getStackMeta('node');
  ok('C.1 node meta exists', nodeMeta !== null);
  ok('C.2 node meta has installCmd', typeof nodeMeta.installCmd === 'string');
  ok('C.3 node meta has testCmd', typeof nodeMeta.testCmd === 'string');
  ok('C.4 node meta has label', nodeMeta.label === 'Node.js');

  // C.5 Python meta
  const pyMeta = getStackMeta('python');
  ok('C.5 python meta exists', pyMeta !== null);
  ok('C.6 python meta has label', pyMeta.label === 'Python');

  // C.7 Unknown stack falls back to generic (not null — enables custom stacks)
  const unknownMeta = getStackMeta('nonexistent-stack');
  ok('C.7 unknown stack → generic fallback', unknownMeta !== null && unknownMeta.label === 'Generic');

  // ── D. All 9 published stacks have metadata ───────────────────────────────
  console.log('\n═══ D. All stacks have metadata ═══');
  const stacks = ['node', 'python', 'go', 'rust', 'java', 'c', 'cpp', 'dotnet', 'matlab'];
  for (const s of stacks) {
    const m = getStackMeta(s);
    ok(`D.${s} meta exists`, m !== null && typeof m.label === 'string');
  }

  console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
  try { rmSync(TMP, { recursive: true }); } catch {}
  process.exit(failed > 0 ? 1 : 0);
}

main();

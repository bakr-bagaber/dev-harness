/**
 * test-t20.mjs — T20 CLI Packaging & Distribution.
 *
 * Tests packaging configuration and the install script:
 *   - package.json has correct fields (bin, files, engines, type)
 *   - dist/install.sh exists and is a valid shell script
 *   - README has install instructions
 *   - LICENSE exists
 *   - bin entry points to the CLI entry
 *
 * Usage: node test-t20.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

// ── A. package.json ──────────────────────────────────────────────────────────
console.log('\n═══ A. package.json ═══');

const pkgPath = resolve(PROJECT_ROOT, 'package.json');
ok('A.1 package.json exists', existsSync(pkgPath));

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
ok('A.2 has name', typeof pkg.name === 'string');
ok('A.3 has version', typeof pkg.version === 'string');
ok('A.4 type is module (ESM)', pkg.type === 'module');
ok('A.5 has bin entry', typeof pkg.bin === 'object' && pkg.bin['dev-harness']);
ok('A.6 bin points to cli/dev-harness.mjs', pkg.bin['dev-harness'].includes('dev-harness.mjs'));
ok('A.7 has engines.node', typeof pkg.engines?.node === 'string');
ok('A.8 has files array', Array.isArray(pkg.files));
ok('A.9 files includes cli/', pkg.files.includes('cli/'));
ok('A.10 files includes templates/', pkg.files.includes('templates/'));
ok('A.11 files includes schema/', pkg.files.includes('schema/'));
ok('A.12 files includes README.md', pkg.files.includes('README.md'));
ok('A.13 files includes LICENSE', pkg.files.includes('LICENSE'));
ok('A.14 has test script', typeof pkg.scripts?.test === 'string');
ok('A.15 has lint script', typeof pkg.scripts?.lint === 'string');
ok('A.16 license is MIT', pkg.license === 'MIT');
ok('A.17 has publishConfig', typeof pkg.publishConfig === 'object');

// ── B. dist/install.sh ───────────────────────────────────────────────────────
console.log('\n═══ B. dist/install.sh ═══');

const installPath = resolve(PROJECT_ROOT, 'dist/install.sh');
ok('B.1 install.sh exists', existsSync(installPath));

const installStat = statSync(installPath);
ok('B.2 install.sh is non-empty', installStat.size > 100);

const installSrc = readFileSync(installPath, 'utf-8');
ok('B.3 has shebang', installSrc.startsWith('#!'));
ok('B.4 references npm or npx', installSrc.includes('npm') || installSrc.includes('npx'));
ok('B.5 references dev-harness', installSrc.includes('dev-harness'));

// ── C. README install instructions ───────────────────────────────────────────
console.log('\n═══ C. README ═══');

const readmePath = resolve(PROJECT_ROOT, 'README.md');
ok('C.1 README.md exists', existsSync(readmePath));

const readme = readFileSync(readmePath, 'utf-8');
ok('C.2 has Install section', readme.includes('## Install') || readme.includes('# Install') || readme.includes('## 🚀 Quick Start'));
ok('C.3 mentions npx', readme.includes('npx'));
ok('C.4 mentions npm install', readme.includes('npm install'));

// ── D. LICENSE ───────────────────────────────────────────────────────────────
console.log('\n═══ D. LICENSE ═══');

const licensePath = resolve(PROJECT_ROOT, 'LICENSE');
ok('D.1 LICENSE exists', existsSync(licensePath));
const license = readFileSync(licensePath, 'utf-8');
ok('D.2 is MIT license', license.includes('MIT License') || license.includes('Permission is hereby granted'));

// ── E. ESLint config ─────────────────────────────────────────────────────────
console.log('\n═══ E. ESLint config ═══');

const eslintPath = resolve(PROJECT_ROOT, 'eslint.config.mjs');
ok('E.1 eslint.config.mjs exists', existsSync(eslintPath));

console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
process.exit(failed > 0 ? 1 : 0);

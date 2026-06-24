/**
 * test-t21.mjs — T21 Documentation Site Scaffolding.
 *
 * Tests the docs-site-templates/ directory (Docusaurus + Sphinx scaffolds).
 * Per PROJECT_PLAN T25 notes, the --docs CLI flag is not yet wired — these
 * templates are available for manual deployment. This test verifies they
 * exist and are structurally valid.
 *
 * Usage: node test-t21.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = resolve(PROJECT_ROOT, 'docs-site-templates');
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

// ── A. Docusaurus template ───────────────────────────────────────────────────
console.log('\n═══ A. Docusaurus template ═══');

const docusaurusDir = resolve(DOCS_DIR, 'docusaurus');
ok('A.1 docusaurus/ exists', existsSync(docusaurusDir));

const docusaurusConfig = resolve(docusaurusDir, 'docusaurus.config.js');
ok('A.2 docusaurus.config.js exists', existsSync(docusaurusConfig));
const dcConfig = readFileSync(docusaurusConfig, 'utf-8');
ok('A.3 config has title', dcConfig.includes('title'));
ok('A.4 config exports function or object', dcConfig.includes('module.exports') || dcConfig.includes('export'));

const sidebars = resolve(docusaurusDir, 'sidebars.js');
ok('A.5 sidebars.js exists', existsSync(sidebars));

const indexPage = resolve(docusaurusDir, 'src/pages/index.js');
ok('A.6 src/pages/index.js exists', existsSync(indexPage));
const indexSrc = readFileSync(indexPage, 'utf-8');
ok('A.7 index.js is a React component', indexSrc.includes('export default') || indexSrc.includes('React'));

// ── B. Sphinx template ───────────────────────────────────────────────────────
console.log('\n═══ B. Sphinx template ═══');

const sphinxDir = resolve(DOCS_DIR, 'sphinx');
ok('B.1 sphinx/ exists', existsSync(sphinxDir));

const makefile = resolve(sphinxDir, 'Makefile');
ok('B.2 Makefile exists', existsSync(makefile));
const makefileSrc = readFileSync(makefile, 'utf-8');
ok('B.3 Makefile has sphinx target', makefileSrc.includes('sphinx') || makefileSrc.includes('SPHINX'));

const confPy = resolve(sphinxDir, 'source/conf.py');
ok('B.4 source/conf.py exists', existsSync(confPy));
const confSrc = readFileSync(confPy, 'utf-8');
ok('B.5 conf.py has project var', confSrc.includes('project') || confSrc.includes("'project'"));

const indexRst = resolve(sphinxDir, 'source/index.rst');
ok('B.6 source/index.rst exists', existsSync(indexRst));
const indexRstSrc = readFileSync(indexRst, 'utf-8');
ok('B.7 index.rst has title directive', indexRstSrc.includes('===') || indexRstSrc.includes('---'));

// ── C. Templates are not wired to CLI (documented gap) ───────────────────────
console.log('\n═══ C. CLI wiring status ═══');

// Per T25 notes, --docs flag is not yet implemented. Verify the scaffold
// module does NOT reference docs-site-templates (confirming it's manual-only).
const scaffoldSrc = readFileSync(resolve(PROJECT_ROOT, 'cli/lib/scaffold.mjs'), 'utf-8');
ok('C.1 scaffold does not auto-include docs-site-templates', !scaffoldSrc.includes('docs-site-templates'));

console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
process.exit(failed > 0 ? 1 : 0);

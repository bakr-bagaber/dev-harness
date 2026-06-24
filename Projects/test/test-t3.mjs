/**
 * test-t3.mjs — T3 Template System (intentionally no dedicated tests).
 *
 * WHY THIS FILE HAS NO TESTS:
 * T3 created the template engine: cli/lib/templates.mjs (generateTemplates,
 * discoverTemplates, substitute), cli/lib/vars.mjs (getStackVars, listStacks),
 * and the initial templates/*.md files.
 *
 * T15 (Agent Templates) IS the T3 test suite. It covers:
 *   - discoverTemplates() returns all template files (D.6)
 *   - substitute() resolves {{VAR}} placeholders for all 9 stacks (C.1)
 *   - getStackVars() produces correct install/build/test/lint commands (G.5)
 *   - generateTemplates() writes files to target with correct content (F.4)
 *   - init command integration creates all template files (F.1-F.22)
 *
 * A separate T3 file would duplicate T15's assertions. T15 was written
 * against T3's deliverables and is the canonical template-engine test.
 *
 * Usage: node test-t3.mjs   (always passes — documentation marker)
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;

const templateFiles = [
  'cli/lib/templates.mjs',
  'cli/lib/vars.mjs',
  'templates/AGENTS.md',
  'templates/init.sh',
  'templates/harness-config.json',
];

for (const rel of templateFiles) {
  if (!existsSync(resolve(PROJECT_ROOT, rel))) {
    console.error(`  ✗ T3 template file missing: ${rel}`);
    process.exit(1);
  }
  passed++;
}

console.log('=== T3 Template System (covered by T15) ===');
console.log(`\nResults: ${passed} pass, 0 fail`);
console.log('  (T3 has no dedicated tests; template engine is tested in T15.)');
process.exit(0);

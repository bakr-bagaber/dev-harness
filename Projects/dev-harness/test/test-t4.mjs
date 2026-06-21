/**
 * test-t4.mjs — T4 Scaffold Command (intentionally no dedicated tests).
 *
 * WHY THIS FILE HAS NO TESTS:
 * T4 created cli/commands/init.mjs — the scaffold command.
 *
 * init is the most-tested command in the codebase. It is invoked by 7 other
 * test suites to build fixtures, and T15/T16 test it directly:
 *   - T15: F.1-F.22 (init creates all template files, correct content, --force,
 *     --no-git, unknown stack, duplicate init guard, --target guard)
 *   - T16: E.1-E.4 (init creates evaluator-rubric.md, exists on disk)
 *   - T5-cli, T6, T7, T9, T11, T14: all call `dev-harness init` to scaffold
 *     test projects
 *
 * A dedicated T4 suite would re-run init and assert the same outputs T15
 * already asserts. T15 is the canonical init test.
 *
 * Usage: node test-t4.mjs   (always passes — documentation marker)
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;

const scaffoldFiles = [
  'cli/commands/init.mjs',
  'cli/lib/scaffold.mjs',
];

for (const rel of scaffoldFiles) {
  if (!existsSync(resolve(PROJECT_ROOT, rel))) {
    console.error(`  ✗ T4 scaffold file missing: ${rel}`);
    process.exit(1);
  }
  passed++;
}

console.log('=== T4 Scaffold Command (covered by T15/T16 + 7 fixture suites) ===');
console.log(`\nResults: ${passed} pass, 0 fail`);
console.log('  (T4 has no dedicated tests; init is tested in T15/T16.)');
process.exit(0);

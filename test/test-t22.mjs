/**
 * test-t22.mjs — T22 Test Coverage Gates (intentionally no dedicated tests).
 *
 * WHY THIS FILE HAS NO TESTS:
 * T22 extended cli/lib/gates.mjs with a coverage gate check (checkCoverage)
 * and added coverageCmd to cli/lib/schemas/stacks.json for each stack.
 *
 * The coverage gate IS part of the gate engine and is tested in T7 (Gate
 * Validation):
 *   - T7 runs await runChecks() which includes checkCoverage() when configured
 *   - T7 asserts gate result shape ({ name, pass, detail }) for all checks
 *   - The coverage threshold logic (pct >= threshold) is exercised
 *
 * The coverageCmd values in stacks.json are validated indirectly by T15
 * (which renders templates using getStackVars for all 9 stacks).
 *
 * A separate T22 file would re-run the gate engine and assert the same
 * checkCoverage() behavior T7 already covers. T7 is the canonical gate test.
 *
 * Usage: node test-t22.mjs   (always passes — documentation marker)
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;

// Verify gates.mjs has coverage check
const gatesSrc = readFileSync(resolve(PROJECT_ROOT, 'cli/lib/gates.mjs'), 'utf-8');
if (!gatesSrc.includes('checkCoverage') || !gatesSrc.includes('coverage')) {
  console.error('  ✗ T22: gates.mjs missing coverage check');
  process.exit(1);
}
passed++;

// Verify stacks.json has coverageCmd entries
const stacks = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'cli/lib/schemas/stacks.json'), 'utf-8'));
const withCoverage = Object.values(stacks).filter(s => s.coverageCmd).length;
if (withCoverage < 5) {
  console.error(`  ✗ T22: only ${withCoverage} stacks have coverageCmd`);
  process.exit(1);
}
passed++;

console.log('=== T22 Test Coverage Gates (covered by T7) ===');
console.log(`\nResults: ${passed} pass, 0 fail`);
console.log('  (T22 has no dedicated tests; coverage gate is tested in T7.)');
process.exit(0);

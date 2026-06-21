/**
 * test-t8.mjs — T8 Inner Ralph Loop Engine (intentionally no dedicated tests).
 *
 * WHY THIS FILE HAS NO TESTS:
 * T8 created cli/lib/ralph-inner.mjs — the inner loop (work → validate →
 * retry with fresh context). It exports await runPhase(), getPhaseType(),
 * loadFeatureList(), getNextFeature(), getNextTask().
 *
 * T10 (Phase Command Orchestrator) superseded T8 as the test suite. T10's
 * suite covers the inner loop comprehensively:
 *   - await runPhase() feature-iterate mode (BUILD/VERIFY/SIMPLIFY)
 *   - await runPhase() deliverable-retry mode (DEFINE/PLAN/REVIEW/SHIP)
 *   - getPhaseType() classification for all 8 phases
 *   - Retry counting + escalation on exhaustion
 *   - Git reset / fresh context on retry (--git-ops)
 *   - loadFeatureList() + getNextFeature() + getNextTask()
 *   - All-features-pass → phase gate passes
 *
 * Additionally T9 (outer loop) and T12 (autopilot) exercise await runPhase()
 * through the outer-loop auto-advance path.
 *
 * A separate T8 file would duplicate T10's 71 assertions. T10 is the
 * canonical inner-loop test.
 *
 * Usage: node test-t8.mjs   (always passes — documentation marker)
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;

const innerLoopFiles = [
  'cli/lib/ralph-inner.mjs',
  'cli/lib/ralph-output.mjs',
];

for (const rel of innerLoopFiles) {
  if (!existsSync(resolve(PROJECT_ROOT, rel))) {
    console.error(`  ✗ T8 inner loop file missing: ${rel}`);
    process.exit(1);
  }
  passed++;
}

console.log('=== T8 Inner Ralph Loop (covered by T10) ===');
console.log(`\nResults: ${passed} pass, 0 fail`);
console.log('  (T8 has no dedicated tests; inner loop is tested in T10.)');
process.exit(0);

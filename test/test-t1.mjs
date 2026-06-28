/**
 * test-t1.mjs — T1 CLI Skeleton (intentionally no dedicated tests).
 *
 * WHY THIS FILE HAS NO TESTS:
 * T1 created the CLI infrastructure: cli/dev-harness.mjs (entry/router),
 * cli/lib/args.mjs (parseArgs), cli/lib/errors.mjs (CliError, EXIT, die),
 * and package.json.
 *
 * This infrastructure is exercised by EVERY other test suite:
 *   - parseArgs() runs in every CLI invocation across all 12 suites
 *   - die() / CliError / EXIT codes are asserted in T5-cli, T7, T10, T13, T14
 *   - The command router (COMMANDS map) is hit by every `dev-harness <cmd>` call
 *   - package.json scripts (test, lint, check) are validated by npm test itself
 *
 * A dedicated T1 suite would duplicate assertions already spread across
 * T5-cli (CLI integration), T7 (error contract), T10 (router), T13 (JSON
 * output contract). The value of a separate file would be near-zero.
 *
 * This file exists to document that decision and prevent future contributors
 * from thinking T1 was forgotten.
 *
 * Usage: node test-t1.mjs   (always passes — documentation marker)
 */

let passed = 0;

// ── Documentation assertions (verify infrastructure files exist) ─────────────
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const infraFiles = [
  'cli/dev-harness.mjs',
  'cli/lib/args.mjs',
  'cli/lib/errors.mjs',
  'cli/lib/help.mjs',
  'package.json',
];

for (const rel of infraFiles) {
  const exists = existsSync(resolve(PROJECT_ROOT, rel));
  if (!exists) {
    console.error(`  ✗ T1 infrastructure missing: ${rel}`);
    process.exit(1);
  }
  passed++;
}

console.log('=== T1 CLI Skeleton (infrastructure — covered by all other suites) ===');
console.log(`\nResults: ${passed} pass, 0 fail`);
console.log('  (T1 has no dedicated tests; infrastructure is exercised by every suite.)');
process.exit(0);

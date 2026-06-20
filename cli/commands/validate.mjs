/**
 * validate — Run gate checks for current phase.
 *
 * If gates.enabled is false, prints "Gates disabled" and exits 0.
 * Otherwise runs phase-specific checks and reports results.
 *
 * Usage:
 *   dev-harness validate              — check current phase
 *   dev-harness validate --json       — machine-readable output
 *   dev-harness validate --phase X    — check specific phase
 *
 * Examples:
 *   dev-harness validate
 *   # → BUILD Gate: PASS — 3/3 checks pass
 *
 *   dev-harness validate --json
 *   # → {"phase":"build","checks":[...],"overall":false,"failures":["lint"]}
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { runChecks, getPhase, areGatesEnabled } from '../lib/gates.mjs';
import { phaseLabel } from '../lib/command-helpers.mjs';

export default async function validateCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();

  // Allow explicit --phase override
  const explicitPhase = args.flags?.phase;
  const phase = explicitPhase || getPhase(targetDir);

  // Feature/task scoping for inner-loop per-task validation
  // NOTE: gates.mjs currently runs full phase-level checks.
  // Per-feature/task filtering should be implemented when the
  // gate engine grows feature-aware check functions (T8 follow-up).
  const feature = typeof args.flags?.feature === 'string' ? args.flags.feature : null;
  const task = typeof args.flags?.task === 'string' ? args.flags.task : null;

  // Gates disabled check
  if (!areGatesEnabled(targetDir)) {
    if (json) {
      const out = {
        command: 'validate',
        phase,
        status: 'ok',
        message: 'Gates disabled — enable with: config set gates.enabled true',
        checks: [],
        overall: true,
        failures: [],
      };
      if (feature) { out.feature = feature; }
      if (task) { out.task = task; }
      process.stdout.write(JSON.stringify(out) + '\n');
    } else {
      process.stdout.write('Gates disabled. Enable with: dev-harness config set gates.enabled true\n');
    }
    return;
  }

  // No phase determined
  if (!phase) {
    die(
      new CliError(
        'No phase found in config. Run: dev-harness init or dev-harness phase <name>',
        EXIT.VALIDATION_FAILURE,
      ),
      json,
    );
    return;
  }

  // Run checks
  const result = runChecks(targetDir, phase, { feature, task });

  if (json) {
    const out = {
      command: 'validate',
      phase: result.phase,
      status: result.overall ? 'ok' : 'error',
      message: result.overall
        ? `${phaseLabel(result.phase)} Gate: PASS — ${result.checks.length}/${result.checks.length} checks pass`
        : `${phaseLabel(result.phase)} Gate: FAIL — ${result.checks.length - result.failures.length}/${result.checks.length} checks pass`,
      checks: result.checks,
      overall: result.overall,
      failures: result.failures,
    };
    if (feature) { out.feature = feature; }
    if (task) { out.task = task; }
    process.stdout.write(JSON.stringify(out) + '\n');
    if (!result.overall) {
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    return;
  }

  // Human output
  const label = phaseLabel(result.phase);
  if (result.overall) {
    process.stdout.write(`${label} Gate: PASS — ${result.checks.length}/${result.checks.length} checks pass\n`);
  } else {
    process.stdout.write(`${label} Gate: FAIL — ${result.checks.length - result.failures.length}/${result.checks.length} checks pass\n`);
  }

  for (const check of result.checks) {
    const icon = check.pass ? '  ✅' : '  ❌';
    process.stdout.write(`${icon} ${check.name}: ${check.detail}\n`);
  }

  if (!result.overall) {
    process.stdout.write(`\nFailed: ${result.failures.join(', ')}\n`);
  }

  // Exit with failure code when checks fail
  if (!result.overall) {
    process.exit(EXIT.VALIDATION_FAILURE);
  }
}

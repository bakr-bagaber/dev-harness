/**
 * contract — Sprint Contract negotiation (propose/review/status/escalate).
 *
 * Manages the generator-evaluator agreement loop.
 *
 * Usage:
 *   harness-dev contract propose [--scope "msg"] [--exclusions "msg"]
 *   harness-dev contract review [--agreed|--needs-revision]
 *   harness-dev contract status
 *   harness-dev contract escalate [--reason "msg"]
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { proposeContract, reviewContract, getContractStatus, escalateContract } from '../lib/contract.mjs';

const SUBCOMMANDS = ['propose', 'review', 'status', 'escalate'];

export default async function contractCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
  const sub = args.subcommand;

  if (!sub || !SUBCOMMANDS.includes(sub)) {
    die(new CliError(`Usage: harness-dev contract ${SUBCOMMANDS.join('|')}`, EXIT.USAGE_ERROR), json);
    return;
  }

  // ── propose ──────────────────────────────────────────────────────────────
  if (sub === 'propose') {
    const scope = args.flags?.scope || args.positionals.join(' ');
    const exclusions = args.flags?.exclusions || null;
    const criteria = args.flags?.criteria ? args.flags.criteria.split('|') : null;

    if (!scope) {
      die(new CliError(
        'Usage: harness-dev contract propose --scope "I will build X" [--exclusions "W"] [--criteria "test1|test2"]',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const result = proposeContract(targetDir, { scope, exclusions, criteria });

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'contract',
        subcommand: 'propose',
        status: result.ok ? 'ok' : 'error',
        message: result.ok ? 'Contract proposed. Evaluator review needed.' : result.error,
      }) + '\n');
      return;
    }

    if (result.ok) {
      process.stdout.write('✓ Contract proposed. Run: harness-dev contract review\n');
    } else {
      process.stderr.write(`✗ ${result.error}\n`);
    }
    return;
  }

  // ── review ───────────────────────────────────────────────────────────────
  if (sub === 'review') {
    const agreed = args.flags?.agreed === true || args.flags?.agreed === 'true';
    const needsRevision = args.flags?.['needs-revision'] === true || args.flags?.['needs-revision'] === 'true';
    const notes = args.flags?.notes || null;

    if (!agreed && !needsRevision) {
      die(new CliError(
        'Usage: harness-dev contract review --agreed [--notes "msg"]  OR  --needs-revision [--notes "msg"]',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const decision = agreed ? 'agreed' : 'needs-revision';
    const result = reviewContract(targetDir, decision, notes);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'contract',
        subcommand: 'review',
        status: result.ok ? 'ok' : 'error',
        message: result.ok
          ? result.escalated
            ? 'Max negotiation rounds reached. Contract escalated to human.'
            : `Contract ${decision}.`
          : result.error,
        escalated: result.escalated,
      }) + '\n');
      return;
    }

    if (result.ok) {
      const msg = result.escalated
        ? '✓ Max negotiation rounds reached. Contract escalated to human.'
        : `✓ Contract marked as "${decision}"`;
      process.stdout.write(msg + '\n');
    } else {
      process.stderr.write(`✗ ${result.error}\n`);
    }
    return;
  }

  // ── status ───────────────────────────────────────────────────────────────
  if (sub === 'status') {
    const { status, rounds } = getContractStatus(targetDir);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'contract',
        subcommand: 'status',
        status: status ? 'ok' : 'error',
        contractStatus: status || 'not_found',
        rounds,
        message: status
          ? `Contract ${status} (round ${rounds}/5)`
          : 'No sprint-contract.md found. Run: harness-dev contract propose',
      }) + '\n');
      return;
    }

    if (status) {
      process.stdout.write(`Contract status: ${status} (round ${rounds}/5)\n`);
    } else {
      process.stdout.write('No sprint-contract.md found. Run: harness-dev contract propose\n');
    }
    return;
  }

  // ── escalate ─────────────────────────────────────────────────────────────
  if (sub === 'escalate') {
    const reason = args.flags?.reason || args.positionals.join(' ') || null;

    const result = escalateContract(targetDir, reason);

    if (json) {
      process.stdout.write(JSON.stringify({
        command: 'contract',
        subcommand: 'escalate',
        status: result.ok ? 'ok' : 'error',
        message: result.ok ? 'Contract escalated to human.' : result.error,
      }) + '\n');
      return;
    }

    if (result.ok) {
      process.stdout.write('✓ Contract escalated to human.\n');
    } else {
      process.stderr.write(`✗ ${result.error}\n`);
    }
    return;
  }
}

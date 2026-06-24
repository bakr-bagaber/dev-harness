/**
 * contract — Sprint Contract negotiation (propose/review/status/escalate).
 *
 * Manages the generator-evaluator agreement loop.
 *
 * Usage:
 *   dev-harness contract propose [--scope "msg"] [--exclusions "msg"]
 *   dev-harness contract review [--agreed|--needs-revision]
 *   dev-harness contract status
 *   dev-harness contract escalate [--reason "msg"]
 */
import { resolve } from 'node:path';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { proposeContract, reviewContract, getContractStatus, escalateContract } from '../lib/contract.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';

const SUBCOMMANDS = ['propose', 'review', 'status', 'escalate'];

export default async function contractCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
  const sub = args.subcommand;

  if (!sub || !SUBCOMMANDS.includes(sub)) {
    die(new CliError(`Usage: dev-harness contract ${SUBCOMMANDS.join('|')}`, EXIT.USAGE_ERROR), json);
    return;
  }

  // ── propose ──────────────────────────────────────────────────────────────
  if (sub === 'propose') {
    const scope = args.flags?.scope || args.positionals.join(' ');
    const exclusions = args.flags?.exclusions || null;
    const criteria = args.flags?.criteria ? args.flags.criteria.split('|') : null;

    if (!scope) {
      die(new CliError(
        'Usage: dev-harness contract propose --scope "I will build X" [--exclusions "W"] [--criteria "test1|test2"]',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const result = proposeContract(targetDir, { scope, exclusions, criteria });

    if (json) {
      emitJson({
        command: 'contract',
        subcommand: 'propose',
        status: result.ok ? 'ok' : 'error',
        message: result.ok ? 'Contract proposed. Evaluator review needed.' : result.error,
      });
      return;
    }

    if (result.ok) {
      emitHuman('✓ Contract proposed. Run: dev-harness contract review\n');
    } else {
      emitCmdError({ command: 'contract', subcommand: 'propose', json, message: result.error });
      process.exit(EXIT.VALIDATION_FAILURE);
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
        'Usage: dev-harness contract review --agreed [--notes "msg"]  OR  --needs-revision [--notes "msg"]',
        EXIT.USAGE_ERROR,
      ), json);
      return;
    }

    const decision = agreed ? 'agreed' : 'needs-revision';
    const result = reviewContract(targetDir, decision, notes);

    if (json) {
      emitJson({
        command: 'contract',
        subcommand: 'review',
        status: result.ok ? 'ok' : 'error',
        message: result.ok
          ? result.escalated
            ? 'Max negotiation rounds reached. Contract escalated to human.'
            : `Contract ${decision}.`
          : result.error,
        escalated: result.escalated,
      });
      return;
    }

    if (result.ok) {
      const msg = result.escalated
        ? '✓ Max negotiation rounds reached. Contract escalated to human.'
        : `✓ Contract marked as "${decision}"`;
      emitHuman(msg + '\n');
    } else {
      emitCmdError({ command: 'contract', subcommand: 'review', json, message: result.error });
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    return;
  }

  // ── status ───────────────────────────────────────────────────────────────
  if (sub === 'status') {
    const { status, rounds } = getContractStatus(targetDir);

    if (json) {
      emitJson({
        command: 'contract',
        subcommand: 'status',
        status: status ? 'ok' : 'error',
        contractStatus: status || 'not_found',
        rounds,
        message: status
          ? `Contract ${status} (round ${rounds}/5)`
          : 'No sprint-contract.md found. Run: dev-harness contract propose',
      });
      return;
    }

    if (status) {
      emitHuman(`Contract status: ${status} (round ${rounds}/5)\n`);
    } else {
      emitHuman('No sprint-contract.md found. Run: dev-harness contract propose\n');
    }
    return;
  }

  // ── escalate ─────────────────────────────────────────────────────────────
  if (sub === 'escalate') {
    const reason = args.flags?.reason || args.positionals.join(' ') || null;

    const result = escalateContract(targetDir, reason);

    if (json) {
      emitJson({
        command: 'contract',
        subcommand: 'escalate',
        status: result.ok ? 'ok' : 'error',
        message: result.ok ? 'Contract escalated to human.' : result.error,
      });
      return;
    }

    if (result.ok) {
      emitHuman('✓ Contract escalated to human.\n');
    } else {
      emitCmdError({ command: 'contract', subcommand: 'escalate', json, message: result.error });
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    return;
  }
}

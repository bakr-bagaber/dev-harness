/**
 * role — Set current agent role and fire handoff (G20).
 *
 * Sets config.currentRole, fires clean-state + writeHandoff (trigger #7:
 * agent-to-agent role handoff), prints role-specific skill instructions.
 *
 * Each role = a separate external agent session. The harness enforces the
 * *what* (role separation, clean handoff, role gates); the external tool
 * provides the *who* (separate sessions).
 *
 * Usage:
 *   dev-harness role <planner|generator|evaluator|simplifier>
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { die, CliError, EXIT } from '../lib/errors.mjs';
import { loadConfig, saveConfig } from '../lib/state.mjs';
import { fireSessionBoundary } from '../lib/session-boundary.mjs';
import { AGENTS_DOCS_DIR } from '../lib/paths.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';

const VALID_ROLES = ['planner', 'generator', 'evaluator', 'simplifier'];

export default async function roleCommand(args) {
  const { json, targetDir, subcommand } = parseCommandArgs(args);

  const role = subcommand || args.positionals?.[0];

  if (!role) {
    die(new CliError(
      'Usage: dev-harness role <planner|generator|evaluator|simplifier>\n' +
      '  Sets currentRole, fires handoff (trigger #7), prints role skill.\n' +
      '  Each role = a separate external agent session (G22).',
      EXIT.USAGE_ERROR,
    ), json);
    return;
  }

  if (!VALID_ROLES.includes(role)) {
    die(new CliError(
      `Invalid role: "${role}". Valid: ${VALID_ROLES.join(', ')}`,
      EXIT.USAGE_ERROR,
    ), json);
    return;
  }

  // Load config, set currentRole
  const { config, ok, error } = loadConfig(targetDir);
  if (!ok) {
    emitCmdError({ command: 'role', json, message: error || 'Cannot load config' });
    process.exit(EXIT.VALIDATION_FAILURE);
    return;
  }

  const previousRole = config.currentRole || null;
  config.currentRole = role;
  const saveResult = saveConfig(targetDir, config);
  if (!saveResult.ok) {
    emitCmdError({ command: 'role', json, message: saveResult.error });
    process.exit(EXIT.VALIDATION_FAILURE);
    return;
  }

  // G20: fire session boundary (trigger #7: role handoff).
  // fireSessionBoundary writes the handoff snapshot, runs the clean-state
  // gate (advisory by default), and appends a progress.md history line.
  const boundary = await fireSessionBoundary(targetDir, 'role-handoff', {
    progressAction: `role handoff: ${previousRole || 'none'} → ${role}`,
  });
  const cleanState = boundary.cleanState;

  // Read role-specific skill
  const roleSkillPath = resolve(AGENTS_DOCS_DIR(targetDir), `${role}.md`);
  let roleSkill = null;
  if (existsSync(roleSkillPath)) {
    try {
      roleSkill = readFileSync(roleSkillPath, 'utf-8');
    } catch {
      // Non-fatal
    }
  }

  if (json) {
    emitJson({
      command: 'role',
      status: 'ok',
      message: `currentRole set to "${role}"${previousRole ? ` (was: ${previousRole})` : ''}. Handoff written. ${roleSkill ? 'Read harness/docs/agents/' + role + '.md for role instructions.' : 'Role skill not found.'}`,
      currentRole: role,
      previousRole,
      handoffWritten: true,
      roleSkillPath: roleSkill ? roleSkillPath : null,
      cleanState: cleanState.pass ? null : cleanState,
    });
    return;
  }

  emitHuman(`✓ Role: ${role}${previousRole ? ` (was: ${previousRole})` : ''}\n`);
  emitHuman(`  Handoff written to harness/session-handoff.md\n`);
  if (roleSkill) {
    emitHuman(`  Role skill: harness/docs/agents/${role}.md\n`);
  } else {
    emitHuman(`  (Role skill not found at harness/docs/agents/${role}.md)\n`);
  }
  if (!cleanState.pass) {
    emitHuman(`  ⚠ Clean-state: ${cleanState.detail}\n`);
  }
}

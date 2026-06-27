/**
 * audit — Report active gates/retry/phases and suggest removals (G24d).
 *
 * walkinglabs L12: periodically disable a harness component, benchmark,
 * remove if no degradation. This command reports what's active so the
 * agent/human can decide what to simplify.
 *
 * Usage:
 *   dev-harness audit [--json]
 */
import { loadConfig } from '../lib/state.mjs';
import { getPhaseOrder } from '../lib/phases.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { EXIT } from '../lib/errors.mjs';

export default async function auditCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);

  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    emitCmdError({ command: 'audit', json, message: 'No harness/config.json found — run dev-harness init' });
    process.exit(EXIT.VALIDATION_FAILURE);
    return;
  }

  // Collect active components
  const activeGates = [];
  if (config.gates?.enabled) { activeGates.push('gates.enabled'); }
  if (config.gates?.coverage?.enabled) { activeGates.push('gates.coverage'); }
  if (config.gates?.cleanState?.enabled) { activeGates.push('gates.cleanState'); }
  if (config.gates?.antiPlaceholder?.enabled !== false) { activeGates.push('gates.antiPlaceholder'); }

  const activeRetry = [];
  if (config.retry?.tasks?.enabled) { activeRetry.push(`tasks (max=${config.retry.tasks.maxRetries ?? config.maxRetries ?? 10})`); }
  if (config.retry?.features?.enabled) { activeRetry.push(`features (max=${config.retry.features.maxRetries ?? 2})`); }
  if (config.retry?.phases?.enabled) { activeRetry.push(`phases (max=${config.retry.phases.maxRetries ?? 2})`); }

  const enabledPhases = getPhaseOrder(config.phases?.enabled);

  // Suggestions for simplification
  const suggestions = [];

  // If all retry levels are on, suggest lowering task maxRetries
  if (config.retry?.tasks?.enabled && config.retry?.features?.enabled && config.retry?.phases?.enabled) {
    const taskMax = config.retry.tasks.maxRetries ?? config.maxRetries ?? 10;
    if (taskMax > 3) {
      suggestions.push(`retry.tasks.maxRetries=${taskMax} is high with full cascade on — consider lowering to 3 (3×2×2=12 total attempts)`);
    }
  }

  // If gates are off, suggest enabling
  if (!config.gates?.enabled) {
    suggestions.push('gates.enabled=false — consider enabling for enforcement by default');
  }

  // If clean-state gate is off, suggest enabling
  if (!config.gates?.cleanState?.enabled) {
    suggestions.push('gates.cleanState.enabled=false — consider enabling for session-boundary enforcement');
  }

  // If simplify phase is enabled, suggest evaluating if it's needed
  if (enabledPhases.includes('simplify')) {
    suggestions.push('simplify phase is enabled — if the agent produces clean code, consider disabling to reduce pipeline length');
  }

  if (json) {
    emitJson({
      command: 'audit',
      status: 'ok',
      message: `${activeGates.length} active gate(s), ${activeRetry.length} active retry level(s), ${enabledPhases.length} enabled phase(s), ${suggestions.length} suggestion(s)`,
      activeGates,
      activeRetry,
      enabledPhases,
      suggestions,
      mode: config.mode,
      currentPhase: config.currentPhase,
      currentRole: config.currentRole || null,
    });
    return;
  }

  emitHuman('═══ Harness Audit ═══\n\n');
  emitHuman(`Mode: ${config.mode}\n`);
  emitHuman(`Current phase: ${config.currentPhase || 'not started'}\n`);
  emitHuman(`Current role: ${config.currentRole || '—'}\n\n`);

  emitHuman(`Active gates (${activeGates.length}):\n`);
  for (const g of activeGates) { emitHuman(`  ✓ ${g}\n`); }
  if (activeGates.length === 0) { emitHuman('  (none)\n'); }

  emitHuman(`\nActive retry levels (${activeRetry.length}):\n`);
  for (const r of activeRetry) { emitHuman(`  ✓ ${r}\n`); }
  if (activeRetry.length === 0) { emitHuman('  (none)\n'); }

  emitHuman(`\nEnabled phases (${enabledPhases.length}):\n`);
  emitHuman(`  ${enabledPhases.join(' → ')}\n`);

  emitHuman(`\nSuggestions (${suggestions.length}):\n`);
  for (const s of suggestions) { emitHuman(`  → ${s}\n`); }
  if (suggestions.length === 0) { emitHuman('  (none — harness is well-tuned)\n'); }
}

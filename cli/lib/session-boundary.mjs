/**
 * session-boundary — fire handoff + clean-state gate at session boundaries.
 *
 * A session boundary is any point where control passes between agents, phases,
 * tasks, or human/agent. The walkinglabs L05/L12 spec calls for an explicit
 * clock-out snapshot (handoff) + a clean-state check at every boundary.
 *
 * 7 boundary triggers (G13/G14/G17):
 *   1. Task complete        — validate --feature --task (success)
 *   2. Feature complete     — validate --feature --task (last task of feature)
 *   3. Phase transition     — phase next → transitionPhase
 *   4. Pause / escalate     — pause
 *   5. Context budget low    — advisory (agent self-reports; not CLI-wired)
 *   6. Human-requested end   — advisory (human-driven; not CLI-wired)
 *   7. Role handoff          — role <name>
 *
 * This module wires triggers #1, #2, #3, #4, #7 (the CLI-driven ones).
 * Triggers #5/#6 are advisory — documented in AGENTS.md, not enforced here.
 *
 * Clean-state is ADVISORY at boundaries by default (result written into the
 * handoff snapshot as a `Clean State` field, never fatal). Callers that want
 * fatal enforcement use `validate --session-exit` (see validate.mjs) or set
 * `gates.cleanState.enabled=true` in a ship-phase validate.
 *
 * Kept in its own module to avoid a circular import between progress.mjs
 * (which gates.mjs does not import) and gates.mjs (which imports state.mjs,
 * which imports progress.mjs). This module imports both safely.
 */
import { writeHandoff, appendProgress } from './progress.mjs';
import { checkCleanState } from './gates.mjs';

/**
 * Fire the session-boundary routine: write handoff + run clean-state gate.
 *
 * @param {string} targetDir — project root containing harness/
 * @param {string} trigger — human-readable trigger label (e.g. 'role-handoff',
 *   'phase-transition', 'task-complete', 'feature-complete', 'pause'). Used
 *   only for the progress.md history line; the handoff snapshot is built from
 *   live config state by writeHandoff().
 * @param {object} [options]
 * @param {string} [options.progressAction] — override the progress.md history
 *   line. Defaults to `session boundary: <trigger>`.
 * @returns {Promise<{ handoff: { ok: boolean, error: string|null }, cleanState: { name: string, pass: boolean, detail: string } }>}
 */
export async function fireSessionBoundary(targetDir, trigger, options = {}) {
  // 1. Write the handoff snapshot (overwrite). buildHandoffSnapshot reads live
  //    config (currentPhase, currentRole, retryCounters, gateHistory, git).
  const handoff = writeHandoff(targetDir);

  // 2. Run the clean-state gate (5 conditions). Returns pass=true with a
  //    "disabled" detail when gates.cleanState.enabled is false (default) —
  //    so callers always get a well-formed result object.
  const cleanState = await checkCleanState(targetDir);

  // 3. Append a history line to progress.md (append-only). The clean-state
  //    pass/fail is recorded here so a human reading progress.md can see the
  //    boundary trail + whether the project was clean at each handoff.
  const action = options.progressAction
    || `session boundary: ${trigger} (clean-state: ${cleanState.pass ? 'pass' : 'fail'})`;
  try {
    appendProgress(targetDir, action);
  } catch {
    // Non-fatal: progress.md is best-effort, never break the boundary.
  }

  return { handoff, cleanState };
}

/**
 * phases — Phase pipeline definitions and pure transition logic.
 *
 * Extracted from state.mjs to separate the phase state machine (pure logic,
 * no I/O) from config file I/O. state.mjs re-exports these for backward
 * compatibility.
 *
 * Usage:
 *   import { PHASE_ORDER, getPhaseOrder, isValidTransition } from './phases.mjs';
 */

/** Canonical phase pipeline order. */
export const PHASE_ORDER = [
  'init',
  'define',
  'plan',
  'build',
  'verify',
  'simplify',
  'review',
  'ship',
];

/**
 * Get the ordered list of enabled phases.
 * Filters out SIMPLIFY unless explicitly enabled.
 * @param {string[]} [enabled]
 * @returns {string[]}
 */
export function getPhaseOrder(enabled) {
  if (enabled === undefined || enabled === null) {
    // Default: all phases except simplify
    return PHASE_ORDER.filter(p => p !== 'simplify');
  }
  if (Array.isArray(enabled)) {
    return PHASE_ORDER.filter(p => enabled.includes(p));
  }
  // Fallback: default
  return PHASE_ORDER.filter(p => p !== 'simplify');
}

/**
 * Check if a phase transition is valid.
 * @param {string|null} fromPhase — current phase (null = start)
 * @param {string} toPhase — target phase
 * @param {string[]} [enabled]
 * @returns {boolean}
 */
export function isValidTransition(fromPhase, toPhase, enabled) {
  const order = getPhaseOrder(enabled);
  if (!order.includes(toPhase)) {return false;}
  if (fromPhase === null) {return order[0] === toPhase;}
  // Re-running the same phase is always valid
  if (fromPhase === toPhase) {return true;}
  const fromIdx = order.indexOf(fromPhase);
  const toIdx = order.indexOf(toPhase);
  return toIdx === fromIdx + 1;
}

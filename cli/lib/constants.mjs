/**
 * constants — Centralized magic numbers and strings.
 *
 * Single source of truth for tunable values scattered across modules.
 * Keeping them here makes intent clear and changes auditable.
 *
 * Usage:
 *   import { GATE_TIMEOUT, COVERAGE_TIMEOUT, MAX_NEGOTIATION_ROUNDS } from './constants.mjs';
 */

/** Default max retries per phase before escalating to human. */
export const DEFAULT_MAX_RETRIES = 3;

/** Timeout (ms) for standard git/shell commands. */
export const COMMAND_TIMEOUT = 30000;

/** Timeout (ms) for coverage checks (longer — coverage runs the full test suite). */
export const COVERAGE_TIMEOUT = 120000;

/** Default coverage threshold percentage. */
export const COVERAGE_THRESHOLD_DEFAULT = 80;

/** Max sprint-contract negotiation rounds before auto-escalation. */
export const MAX_NEGOTIATION_ROUNDS = 5;

/** Directory scan depth for stack detection. */
export const STACK_SCAN_DEPTH = 2;

/** File mode for executable scripts (init.sh). */
export const EXECUTABLE_MODE = 0o755;

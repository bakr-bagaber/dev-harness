/**
 * constants — Centralized magic numbers and strings.
 *
 * Single source of truth for tunable values scattered across modules.
 * Keeping them here makes intent clear and changes auditable.
 *
 * Usage:
 *   import { GATE_TIMEOUT, COVERAGE_TIMEOUT, MAX_NEGOTIATION_ROUNDS } from './constants.mjs';
 */

/** Default max retries per task before escalating to human.
 *  Retry scope is per-task (not per-phase) — each task gets its own retry budget.
 *  Configurable via: dev-harness config set maxRetries <N>
 */
export const DEFAULT_MAX_RETRIES = 10;

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

// ── Supervisor / Orchestrator constants ─────────────────────────────────────

/** Default max API retry attempts before pausing pipeline. */
export const API_MAX_RETRIES = 5;

/** Base backoff delay in ms for API retries (exponential: 60s, 120s, 240s, ...). */
export const API_BACKOFF_MS = 60000;

/** Supervisor heartbeat interval in ms. */
export const SUPERVISOR_INTERVAL_MS = 60000;

/** Max heartbeat staleness before stall detection (5 min). */
export const SUPERVISOR_MAX_STALLS = 3;

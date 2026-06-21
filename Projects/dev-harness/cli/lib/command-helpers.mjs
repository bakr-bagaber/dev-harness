/**
 * command-helpers — Shared utilities for command handlers.
 *
 * Eliminates the repeated `const json = !!(args.json || args.flags?.json)`
 * and `const targetDir = ...` boilerplate duplicated across all 13 commands,
 * plus the phaseLabel helper duplicated in 3 files.
 *
 * Usage:
 *   import { parseCommandArgs, phaseLabel } from '../lib/command-helpers.mjs';
 *   const { json, targetDir, flags } = parseCommandArgs(args);
 */
import { resolve } from 'node:path';

/**
 * Extract common command options from parsed args.
 * @param {object} args — parsed args from args.mjs parseArgs()
 * @returns {{
 *   json: boolean,
 *   targetDir: string,
 *   flags: object,
 *   positionals: string[],
 *   subcommand: string|null,
 *   force: boolean,
 *   gitOps: boolean,
 * }}
 */
export function parseCommandArgs(args) {
  const json = !!(args.json || args.flags?.json);
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
  return {
    json,
    targetDir,
    flags: args.flags || {},
    positionals: args.positionals || [],
    subcommand: args.subcommand ?? null,
    force: !!(args.flags?.force),
    gitOps: !!(args.flags?.['git-ops'] || args.flags?.gitOps),
  };
}

/**
 * Format a phase name for display (uppercase, or UNKNOWN if null).
 * Centralized here to avoid 3× duplication across ralph-inner/validate/phase.
 * @param {string|null} phase
 * @returns {string}
 */
export function phaseLabel(phase) {
  return phase ? phase.toUpperCase() : 'UNKNOWN';
}

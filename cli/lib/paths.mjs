/**
 * paths — Centralized path resolution for the CLI.
 *
 * Single source of truth for the lib directory location and all
 * project-relative file paths (config, feature list, contract, progress,
 * schemas, templates). Eliminates 4× duplicated __dirname boilerplate and
 * scattered resolve(targetDir, '...') calls.
 *
 * Usage:
 *   import { LIB_DIR, TEMPLATES_DIR, SCHEMA_DIR, CONFIG_PATH, FEATURE_LIST_PATH } from './paths.mjs';
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory containing cli/lib/ (this module's directory). */
export const LIB_DIR = dirname(fileURLToPath(import.meta.url));

/** Project root (parent of cli/). */
export const PROJECT_ROOT = resolve(LIB_DIR, '..', '..');

/** Templates directory (project_root/templates). */
export const TEMPLATES_DIR = resolve(PROJECT_ROOT, 'templates');

/** Adapters directory (project_root/adapters) — tool-specific integration files. */
export const ADAPTERS_DIR = resolve(PROJECT_ROOT, 'adapters');

/** JSON schemas directory (project_root/schema). */
export const SCHEMA_DIR = resolve(PROJECT_ROOT, 'schema');

/** harness-config.json schema path. */
export const CONFIG_SCHEMA_PATH = resolve(SCHEMA_DIR, 'harness-config.schema.json');

/** feature_list.json schema path. */
export const FEATURE_LIST_SCHEMA_PATH = resolve(SCHEMA_DIR, 'feature-list.schema.json');

/** stacks.json metadata path (cli/lib/schemas/stacks.json). */
export const STACKS_SCHEMA_PATH = resolve(LIB_DIR, 'schemas', 'stacks.json');

// ── Project-relative paths (target project, not this CLI) ────────────────────

/**
 * Path to a project's harness-config.json.
 * @param {string} targetDir
 * @returns {string}
 */
export function CONFIG_PATH(targetDir) {
  return resolve(targetDir, 'harness-config.json');
}

/**
 * Path to a project's feature_list.json.
 * @param {string} targetDir
 * @returns {string}
 */
export function FEATURE_LIST_PATH(targetDir) {
  return resolve(targetDir, 'feature_list.json');
}

/**
 * Path to a project's sprint-contract.md.
 * @param {string} targetDir
 * @returns {string}
 */
export function CONTRACT_PATH(targetDir) {
  return resolve(targetDir, 'sprint-contract.md');
}

/**
 * Path to a project's progress.md.
 * @param {string} targetDir
 * @returns {string}
 */
export function PROGRESS_PATH(targetDir) {
  return resolve(targetDir, 'progress.md');
}

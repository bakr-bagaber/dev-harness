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
// All harness-managed files live under harness/ with subfolder grouping:
//   harness/              — config, progress, contract, rubric, handoff, checklist
//   harness/features/     — feature list + schema
//   harness/docs/         — architecture, constraints, decisions, agent docs, phase docs
//   harness/ci/           — CI/CD templates
//   harness/scripts/      — init scripts
// AGENTS.md stays in root (agent tools expect it there).

/**
 * Harness root directory within a target project.
 * @param {string} targetDir
 * @returns {string}
 */
export function HARNESS_DIR(targetDir) {
  return resolve(targetDir, 'harness');
}

/**
 * Path to a project's config.json (harness/config.json).
 * @param {string} targetDir
 * @returns {string}
 */
export function CONFIG_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'config.json');
}

/**
 * Path to a project's feature-list.json (harness/features/feature-list.json).
 * @param {string} targetDir
 * @returns {string}
 */
export function FEATURE_LIST_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'features', 'feature-list.json');
}

/**
 * Path to a project's sprint-contract.md (harness/sprint-contract.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function CONTRACT_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'sprint-contract.md');
}

/**
 * Path to a project's progress.md (harness/progress.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function PROGRESS_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'progress.md');
}

/**
 * Path to a project's evaluator-rubric.md (harness/evaluator-rubric.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function RUBRIC_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'evaluator-rubric.md');
}

/**
 * Path to a project's session-handoff.md (harness/session-handoff.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function HANDOFF_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'session-handoff.md');
}

/**
 * Path to a project's clean-state-checklist.md (harness/clean-state-checklist.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function CHECKLIST_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'clean-state-checklist.md');
}

/**
 * Path to a project's ARCHITECTURE.md (harness/docs/ARCHITECTURE.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function ARCHITECTURE_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'docs', 'ARCHITECTURE.md');
}

/**
 * Path to a project's CONSTRAINTS.md (harness/docs/CONSTRAINTS.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function CONSTRAINTS_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'docs', 'CONSTRAINTS.md');
}

/**
 * Path to a project's DECISIONS.md (harness/docs/DECISIONS.md).
 * @param {string} targetDir
 * @returns {string}
 */
export function DECISIONS_PATH(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'docs', 'DECISIONS.md');
}

/**
 * Path to a project's AGENTS.md (stays in root — agent tools expect it there).
 * @param {string} targetDir
 * @returns {string}
 */
export function AGENTS_PATH(targetDir) {
  return resolve(targetDir, 'AGENTS.md');
}

/**
 * Path to a project's agent role docs directory (harness/docs/agents/).
 * Contains planner.md, generator.md, evaluator.md, simplifier.md.
 * @param {string} targetDir
 * @returns {string}
 */
export function AGENTS_DOCS_DIR(targetDir) {
  return resolve(HARNESS_DIR(targetDir), 'docs', 'agents');
}

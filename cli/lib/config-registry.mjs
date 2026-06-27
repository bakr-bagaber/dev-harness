/**
 * config-registry — Metadata for all configurable harness parameters.
 *
 * Single source of truth for parameter descriptions, types, allowed values,
 * and defaults. Used by:
 *   - `dev-harness config list` — interactive parameter listing
 *   - docs/CONFIGURATION.md — generated documentation
 *   - config command — validation of set values
 *
 * Each entry: { key, group, label, type, description, default, options?, editable }
 *   - editable: false for runtime state (currentPhase, retryCount, etc.)
 *
 * Usage:
 *   import { CONFIG_PARAMS, getParamMeta, EDITABLE_PARAMS } from './config-registry.mjs';
 */
export const CONFIG_PARAMS = [
  // ── Execution Mode ────────────────────────────────────────────────────────
  {
    key: 'mode',
    group: 'Execution',
    label: 'Mode',
    type: 'enum',
    description: 'Execution mode. copilot = human runs each phase manually. autopilot = harness auto-advances through phases after each gate passes.',
    default: 'copilot',
    options: ['copilot', 'autopilot'],
    editable: true,
  },
  {
    key: 'paused',
    group: 'Execution',
    label: 'Paused',
    type: 'boolean',
    description: 'Autopilot pause state. When true, autopilot stops after current phase gate. Set by pause/resume commands.',
    default: false,
    editable: true,
  },
  {
    key: 'maxRetries',
    group: 'Execution',
    label: 'Max Retries',
    type: 'integer',
    description: 'Maximum retry attempts per phase before escalating to human. Each retry gets fresh context (git reset if --git-ops enabled).',
    default: 3,
    editable: true,
  },

  // ── Stack ──────────────────────────────────────────────────────────────────
  {
    key: 'stack',
    group: 'Stack',
    label: 'Stack',
    type: 'string',
    description: 'Project programming stack. 31 built-in stacks (python, node, go, rust, etc.) or any custom name (fill stackMeta).',
    default: null,
    editable: true,
  },
  {
    key: 'stackMeta',
    group: 'Stack',
    label: 'Stack Metadata',
    type: 'object',
    description: 'Custom stack metadata (overrides built-in stacks.json). Fill during DEFINE for unknown stacks. Keys: label, testCmd, lintCmd, typeCheckCmd, buildCmd, installCmd, coverageCmd, versionFile, configFile, extensions, detectFiles.',
    default: null,
    editable: true,
  },

  // ── Agent Tool ─────────────────────────────────────────────────────────────
  {
    key: 'agentTool',
    group: 'Agent Tool',
    label: 'Agent Tool',
    type: 'enum',
    description: 'Which agentic coding tool the project uses. Determines tool-specific file generated (CLAUDE.md, .cursorrules, etc.). null = unspecified.',
    default: null,
    options: [null, 'generic', 'claude-code', 'codex', 'cursor', 'opencode', 'antigravity', 'openclaw', 'skill'],
    editable: true,
  },

  // ── Gates ──────────────────────────────────────────────────────────────────
  {
    key: 'gates.enabled',
    group: 'Gates',
    label: 'Gates Enabled',
    type: 'boolean',
    description: 'Master switch for phase gate validation. When false, validate reports gates disabled. Enable to enforce lint/test/coverage checks.',
    default: false,
    editable: true,
  },
  {
    key: 'gates.checks',
    group: 'Gates',
    label: 'Gate Checks',
    type: 'array',
    description: 'Which checks to run. ["all"] runs every check for the phase. Or specify individual: git-repo, config-exists, git-clean, lint, tests, coverage, contract-agreed, etc.',
    default: ['all'],
    editable: true,
  },
  {
    key: 'gates.coverage.enabled',
    group: 'Gates',
    label: 'Coverage Gate',
    type: 'boolean',
    description: 'Enable coverage threshold check in BUILD/VERIFY phases.',
    default: false,
    editable: true,
  },
  {
    key: 'gates.coverage.threshold',
    group: 'Gates',
    label: 'Coverage Threshold',
    type: 'integer',
    description: 'Minimum coverage percentage (0-100) to pass coverage gate.',
    default: 80,
    editable: true,
  },

  // ── Git ────────────────────────────────────────────────────────────────────
  {
    key: 'git.autoCommit',
    group: 'Git',
    label: 'Auto-Commit',
    type: 'boolean',
    description: 'Automatically commit after each successful phase iteration. Recommended for autopilot.',
    default: false,
    editable: true,
  },
  {
    key: 'git.autoTag',
    group: 'Git',
    label: 'Auto-Tag',
    type: 'boolean',
    description: 'Create git tag when pipeline completes. Tags named pipeline-<date>-<timestamp>.',
    default: false,
    editable: true,
  },
  {
    key: 'git.resetOnRetry',
    group: 'Git',
    label: 'Reset on Retry',
    type: 'boolean',
    description: 'Reset git working tree on retry (fresh context). Also via --git-ops flag on phase command.',
    default: false,
    editable: true,
  },

  // ── Phases ─────────────────────────────────────────────────────────────────
  {
    key: 'phases.enabled',
    group: 'Phases',
    label: 'Enabled Phases',
    type: 'array',
    description: 'Phases in pipeline. Default excludes simplify. Add "simplify" to enable. Order: define, plan, build, verify, [simplify], review, ship.',
    default: ['define', 'plan', 'build', 'verify', 'review', 'ship'],
    editable: true,
  },

  // ── Agent Tones ────────────────────────────────────────────────────────────
  {
    key: 'agents.tone.planner',
    group: 'Agent Tones',
    label: 'Planner Tone',
    type: 'string',
    description: 'Personality/instructions for the Planner agent persona.',
    default: 'Analytical and precise. Define clear boundaries.',
    editable: true,
  },
  {
    key: 'agents.tone.generator',
    group: 'Agent Tones',
    label: 'Generator Tone',
    type: 'string',
    description: 'Personality/instructions for the Generator agent persona.',
    default: 'Focused and practical. Build what\'s specified, nothing more.',
    editable: true,
  },
  {
    key: 'agents.tone.evaluator',
    group: 'Agent Tones',
    label: 'Evaluator Tone',
    type: 'string',
    description: 'Personality/instructions for the Evaluator agent persona.',
    default: 'Skeptical and thorough. Accept only compelling evidence.',
    editable: true,
  },
  {
    key: 'agents.tone.simplifier',
    group: 'Agent Tones',
    label: 'Simplifier Tone',
    type: 'string',
    description: 'Personality/instructions for the Simplifier agent persona.',
    default: 'Relentless about clarity. Delete more than you add.',
    editable: true,
  },

  // ── Runtime State (read-only — managed by harness) ─────────────────────────
  {
    key: 'currentPhase',
    group: 'Runtime State',
    label: 'Current Phase',
    type: 'string',
    description: 'Current pipeline phase. Managed by dev-harness phase — do not edit.',
    default: null,
    editable: false,
  },
  {
    key: 'retryCount',
    group: 'Runtime State',
    label: 'Retry Count',
    type: 'integer',
    description: 'Retry count for active phase. Reset on transition. Managed by harness.',
    default: 0,
    editable: false,
  },
  {
    key: 'pipelineIteration',
    group: 'Runtime State',
    label: 'Pipeline Iteration',
    type: 'integer',
    description: 'Full pipeline completion count. Incremented on SHIP. Managed by harness.',
    default: 0,
    editable: false,
  },
  {
    key: 'gateHistory',
    group: 'Runtime State',
    label: 'Gate History',
    type: 'array',
    description: 'Record of gate pass/fail results. Managed by harness.',
    default: [],
    editable: false,
  },
  {
    key: 'features.remaining',
    group: 'Runtime State',
    label: 'Features Remaining',
    type: 'integer',
    description: 'Incomplete feature count. Managed by harness.',
    default: 0,
    editable: false,
  },
  {
    key: 'features.passing',
    group: 'Runtime State',
    label: 'Features Passing',
    type: 'integer',
    description: 'Completed feature count. Managed by harness.',
    default: 0,
    editable: false,
  },
  {
    key: 'features.total',
    group: 'Runtime State',
    label: 'Features Total',
    type: 'integer',
    description: 'Total feature count. Managed by harness.',
    default: 0,
    editable: false,
  },
  {
    key: 'git.branch',
    group: 'Runtime State',
    label: 'Git Branch',
    type: 'string',
    description: 'Current git branch. Auto-detected — do not edit.',
    default: null,
    editable: false,
  },
  {
    key: 'git.clean',
    group: 'Runtime State',
    label: 'Git Clean',
    type: 'boolean',
    description: 'Working tree clean state. Auto-detected — do not edit.',
    default: true,
    editable: false,
  },
  {
    key: 'git.hasUpstream',
    group: 'Runtime State',
    label: 'Has Upstream',
    type: 'boolean',
    description: 'Branch upstream tracking. Auto-detected — do not edit.',
    default: false,
    editable: false,
  },
  {
    key: 'git.lastCommitMessage',
    group: 'Runtime State',
    label: 'Last Commit',
    type: 'string',
    description: 'Last git commit message. Auto-detected — do not edit.',
    default: null,
    editable: false,
  },
];

/**
 * Get metadata for a specific parameter key.
 * @param {string} key
 * @returns {object|null}
 */
export function getParamMeta(key) {
  return CONFIG_PARAMS.find(p => p.key === key) || null;
}

/**
 * Get all parameters in a specific group.
 * @param {string} group
 * @returns {object[]}
 */
export function getParamsByGroup(group) {
  return CONFIG_PARAMS.filter(p => p.group === group);
}

/**
 * Get unique group names (preserving order).
 * @returns {string[]}
 */
export function getGroups() {
  const seen = new Set();
  const groups = [];
  for (const p of CONFIG_PARAMS) {
    if (!seen.has(p.group)) {
      seen.add(p.group);
      groups.push(p.group);
    }
  }
  return groups;
}

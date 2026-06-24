/**
 * actions — TUI action dispatcher.
 *
 * The single bridge between TUI screens and CLI library functions.
 * Screens call these actions instead of spawning CLI subcommands —
 * keeping the TUI responsive (no child processes) and giving every
 * action a uniform `{ ok, message, data? }` return shape.
 *
 * Canonical boundary:
 *   - TUI screens → call actions.* (this module)
 *   - actions.* → call cli/lib/*.mjs functions directly
 *   - cli/lib/*.mjs → return `{ ok, error, ... }` result objects
 *   - actions.* → translate to `{ ok, message, data? }` for TUI consumption
 *
 * Usage:
 *   import { advancePhase, runValidation, createFeatureBranch } from './actions.mjs';
 *   const result = await advancePhase(targetDir);
 *   if (result.ok) { showToast(result.message); }
 */

import { resolve } from 'node:path';

// ── State & Config ───────────────────────────────────────────────────────────

import {
  loadConfig, saveConfig, get as configGet, set as configSet,
  transitionPhase, getPhaseOrder, getDefaultConfig,
} from '../lib/state.mjs';
import { CONFIG_PARAMS, getParamMeta, getGroups, getParamsByGroup } from '../lib/config-registry.mjs';

// ── Pipeline ─────────────────────────────────────────────────────────────────

import { runPhase, getPhaseType, loadFeatureList, getNextFeature, getNextTask } from '../lib/ralph-inner.mjs';
import { continuePipeline } from '../lib/ralph-outer.mjs';
import { runChecks, getPhase, areGatesEnabled, getPhaseChecks } from '../lib/gates.mjs';

// ── Contract ─────────────────────────────────────────────────────────────────

import {
  proposeContract, reviewContract, escalateContract,
  getContractStatus, isContractAgreed,
} from '../lib/contract.mjs';

// ── Progress ─────────────────────────────────────────────────────────────────

import { readProgress, readLessons, appendLesson, readSessionState } from '../lib/progress.mjs';

// ── Git ──────────────────────────────────────────────────────────────────────

import {
  execGit, getGitRoot, getGitBranch, isGitClean,
  gitTagExists, createGitTag,
} from '../lib/git.mjs';

// ── Stack & Tool ─────────────────────────────────────────────────────────────

import { detectStack, getStackMeta } from '../lib/detect-stack.mjs';
import { listStacks } from '../lib/vars.mjs';
import { TOOL_REGISTRY, getAllDetectionSignatures, getToolEntry } from '../lib/tool-registry.mjs';
import { KNOWN_AGENT_TOOLS } from '../lib/scaffold.mjs';

// ── Paths ────────────────────────────────────────────────────────────────────

import { CONFIG_PATH, PROGRESS_PATH, RUBRIC_PATH, CONTRACT_PATH } from '../lib/paths.mjs';
import { existsSync, readFileSync } from 'node:fs';

// ── Scaffold (for setup wizard) ──────────────────────────────────────────────

import { generateTemplates } from '../lib/templates.mjs';
import {
  getExtraFiles, getConfigFileContent, getVersionFileContent, getGitignoreContent,
} from '../lib/scaffold.mjs';
import { join, dirname } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

// ════════════════════════════════════════════════════════════════════════════
// CONFIG ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get full config object.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getConfig(targetDir) {
  const { config, ok, error } = loadConfig(targetDir);
  if (!ok) return { ok: false, message: error || 'No config found' };
  return { ok: true, message: 'Config loaded', data: config };
}

/**
 * Get a specific config value by dot-notation key.
 * @param {string} targetDir
 * @param {string} key
 * @returns {{ ok: boolean, message: string, data?: any }}
 */
export function getConfigValue(targetDir, key) {
  const { value, ok, error } = configGet(targetDir, key);
  if (!ok) return { ok: false, message: error || 'Key not found' };
  return { ok: true, message: `Got ${key}`, data: value };
}

/**
 * Set a config value by dot-notation key.
 * @param {string} targetDir
 * @param {string} key
 * @param {any} value
 * @returns {{ ok: boolean, message: string }}
 */
export function setConfig(targetDir, key, value) {
  const result = configSet(targetDir, key, value);
  if (!result.ok) return { ok: false, message: result.error || 'Failed to set config' };
  return { ok: true, message: `Set ${key} = ${JSON.stringify(value)}` };
}

/**
 * Enable or disable gate validation.
 * @param {string} targetDir
 * @param {boolean} enabled
 * @returns {{ ok: boolean, message: string }}
 */
export function enableGates(targetDir, enabled) {
  return setConfig(targetDir, 'gates.enabled', enabled);
}

/**
 * Set execution mode (copilot or autopilot).
 * @param {string} targetDir
 * @param {'copilot'|'autopilot'} mode
 * @returns {{ ok: boolean, message: string }}
 */
export function setMode(targetDir, mode) {
  if (!['copilot', 'autopilot'].includes(mode)) {
    return { ok: false, message: 'Invalid mode. Use: copilot or autopilot' };
  }
  return setConfig(targetDir, 'mode', mode);
}

/**
 * Set the agent tool.
 * @param {string} targetDir
 * @param {string} tool
 * @returns {{ ok: boolean, message: string }}
 */
export function selectTool(targetDir, tool) {
  if (!KNOWN_AGENT_TOOLS.includes(tool)) {
    return { ok: false, message: `Unknown tool "${tool}". Valid: ${KNOWN_AGENT_TOOLS.join(', ')}` };
  }
  return setConfig(targetDir, 'agentTool', tool);
}

/**
 * Get all config parameter metadata (for config editor).
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export function getConfigParams() {
  return { ok: true, message: `${CONFIG_PARAMS.length} parameters`, data: CONFIG_PARAMS };
}

/**
 * Get config parameter groups (for config editor grouping).
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export function getConfigGroups() {
  return { ok: true, message: 'Groups loaded', data: getGroups() };
}

// ════════════════════════════════════════════════════════════════════════════
// PIPELINE ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get current pipeline status (phase, mode, gates, features).
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getPipelineStatus(targetDir) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) return { ok: false, message: 'No config found' };
  const phase = config.currentPhase;
  const mode = config.mode || 'copilot';
  const gatesEnabled = areGatesEnabled(targetDir);
  const stack = detectStack(targetDir);
  let feature = null;
  let task = null;
  if (phase) {
    try {
      const fl = loadFeatureList(targetDir);
      const nextFeat = getNextFeature(fl.features);
      if (nextFeat) {
        feature = { id: nextFeat.id, name: nextFeat.name };
        const nextTask = getNextTask(nextFeat);
        if (nextTask) {
          task = { id: nextTask.id, description: nextTask.description };
        }
      }
    } catch { /* feature list may not exist yet */ }
  }
  return {
    ok: true,
    message: `Phase: ${phase || 'not started'}`,
    data: {
      phase, mode, gatesEnabled, stack: stack.name, stackLabel: stack.label,
      feature, task, paused: config.paused, maxRetries: config.maxRetries,
      retryCount: config.retryCount, taskRetryCount: config.taskRetryCount,
      pipelineIteration: config.pipelineIteration,
    },
  };
}

/**
 * Advance to a specific phase (or next phase if omitted).
 * @param {string} targetDir
 * @param {string} [phase] — specific phase, or next phase if null
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export async function advancePhase(targetDir, phase) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) return { ok: false, message: 'No config found. Run setup first.' };
  const order = getPhaseOrder(config.phases?.enabled);
  if (!phase) {
    const currentIdx = config.currentPhase ? order.indexOf(config.currentPhase) : -1;
    if (currentIdx < 0) {
      phase = order[0];
    } else if (currentIdx < order.length - 1) {
      phase = order[currentIdx + 1];
    } else {
      return { ok: false, message: 'Pipeline already complete' };
    }
  }
  if (!order.includes(phase)) {
    return { ok: false, message: `Invalid phase "${phase}". Valid: ${order.join(', ')}` };
  }
  const transitionResult = await transitionPhase(targetDir, phase);
  if (!transitionResult.ok) {
    return { ok: false, message: transitionResult.error || 'Phase transition failed' };
  }
  const loopResult = await runPhase(targetDir, phase, { json: true });
  if (!loopResult.ok) {
    return { ok: false, message: loopResult.message || 'Phase execution failed' };
  }
  return {
    ok: true,
    message: `${phase.toUpperCase()} phase started`,
    data: { phase, status: loopResult.status, message: loopResult.message, details: loopResult.details },
  };
}

/**
 * Run gate validation for current (or specified) phase.
 * @param {string} targetDir
 * @param {string} [phase] — specific phase, or current if null
 * @param {{ feature?: string, task?: string }} [scope] — for per-task validation
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export async function runValidation(targetDir, phase, scope) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) return { ok: false, message: 'No config found' };
  if (!areGatesEnabled(targetDir)) {
    return { ok: false, message: 'Gates disabled. Enable with: config set gates.enabled true' };
  }
  const checkPhase = phase || config.currentPhase || getPhase(targetDir);
  if (!checkPhase) {
    return { ok: false, message: 'No current phase. Start a phase first.' };
  }
  const result = await runChecks(targetDir, checkPhase, scope);
  return {
    ok: result.overall,
    message: result.overall
      ? `${checkPhase.toUpperCase()} Gate: PASS — ${result.checks.length}/${result.checks.length} checks pass`
      : `${checkPhase.toUpperCase()} Gate: FAIL — ${result.checks.length - result.failures.length}/${result.checks.length} checks pass`,
    data: { phase: result.phase, checks: result.checks, failures: result.failures, overall: result.overall },
  };
}

/**
 * Pause the pipeline.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string }}
 */
export function pausePipeline(targetDir) {
  return setConfig(targetDir, 'paused', true);
}

/**
 * Resume the pipeline.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string }}
 */
export function resumePipeline(targetDir) {
  return setConfig(targetDir, 'paused', false);
}

// ════════════════════════════════════════════════════════════════════════════
// CONTRACT ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get current contract status.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getContract(targetDir) {
  const { status, rounds } = getContractStatus(targetDir);
  return {
    ok: !!status,
    message: status ? `Contract ${status} (round ${rounds}/5)` : 'No contract found',
    data: { status, rounds },
  };
}

/**
 * Read full sprint-contract.md text.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: string }}
 */
export function readContractText(targetDir) {
  const path = CONTRACT_PATH(targetDir);
  if (!existsSync(path)) {
    return { ok: false, message: 'No sprint-contract.md found' };
  }
  try {
    const text = readFileSync(path, 'utf-8');
    return { ok: true, message: 'Contract loaded', data: text };
  } catch (err) {
    return { ok: false, message: `Failed to read contract: ${err.message}` };
  }
}

/**
 * Propose a sprint contract.
 * @param {string} targetDir
 * @param {{ scope: string, exclusions?: string, criteria?: string[] }} proposal
 * @returns {{ ok: boolean, message: string }}
 */
export function proposeSprintContract(targetDir, proposal) {
  if (!proposal.scope) {
    return { ok: false, message: 'Scope is required' };
  }
  const result = proposeContract(targetDir, proposal);
  if (!result.ok) return { ok: false, message: result.error || 'Failed to propose contract' };
  return { ok: true, message: 'Contract proposed. Evaluator review needed.' };
}

/**
 * Review a contract (agree or needs-revision).
 * @param {string} targetDir
 * @param {'agreed'|'needs-revision'} decision
 * @param {string} [notes]
 * @returns {{ ok: boolean, message: string, data?: { escalated: boolean } }}
 */
export function reviewSprintContract(targetDir, decision, notes) {
  const result = reviewContract(targetDir, decision, notes);
  if (!result.ok) return { ok: false, message: result.error || 'Failed to review contract' };
  return {
    ok: true,
    message: result.escalated
      ? 'Max negotiation rounds reached. Contract escalated to human.'
      : `Contract ${decision}.`,
    data: { escalated: result.escalated },
  };
}

/**
 * Escalate contract to human.
 * @param {string} targetDir
 * @param {string} [reason]
 * @returns {{ ok: boolean, message: string }}
 */
export function escalateSprintContract(targetDir, reason) {
  const result = escalateContract(targetDir, reason);
  if (!result.ok) return { ok: false, message: result.error || 'Failed to escalate' };
  return { ok: true, message: 'Contract escalated to human.' };
}

// ════════════════════════════════════════════════════════════════════════════
// GIT ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Create a feature branch.
 * @param {string} targetDir
 * @param {string} name — branch name (e.g. "feat/define" or "define")
 * @returns {{ ok: boolean, message: string }}
 */
export async function createFeatureBranch(targetDir, name) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const branchName = name.includes('/') ? name : `feat/${name}`;
  const check = await execGit(`git show-ref --verify --quiet refs/heads/${branchName}`, gitRoot);
  if (check.ok) return { ok: false, message: `Branch "${branchName}" already exists` };
  const result = await execGit(`git checkout -b "${branchName}"`, gitRoot);
  if (!result.ok) return { ok: false, message: `Failed to create branch: ${result.stderr}` };
  return { ok: true, message: `Created and switched to branch "${branchName}"` };
}

/**
 * Get current git branch.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: string }}
 */
export async function getCurrentBranch(targetDir) {
  const branch = await getGitBranch(targetDir);
  if (!branch) return { ok: false, message: 'Not on a branch (detached HEAD)' };
  return { ok: true, message: `Branch: ${branch}`, data: branch };
}

/**
 * Check if working tree is clean.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: boolean }}
 */
export async function checkGitClean(targetDir) {
  const clean = await isGitClean(targetDir);
  return { ok: true, message: clean ? 'Working tree clean' : 'Working tree has uncommitted changes', data: clean };
}

/**
 * Create a git worktree.
 * @param {string} targetDir
 * @param {string} name
 * @returns {{ ok: boolean, message: string, data?: { path: string, branch: string } }}
 */
export async function createWorktree(targetDir, name) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const { resolve: resolvePath, dirname: dirnamePath } = await import('node:path');
  const branchName = `feat/${name}`;
  const worktreePath = resolvePath(dirnamePath(gitRoot), `feat-${name}`);
  const branchCheck = await execGit(`git show-ref --verify --quiet refs/heads/${branchName}`, gitRoot);
  if (branchCheck.ok) return { ok: false, message: `Branch "${branchName}" already exists` };
  if (existsSync(worktreePath)) return { ok: false, message: `Target directory exists: ${worktreePath}` };
  const addResult = await execGit(`git worktree add "${worktreePath}" -b "${branchName}"`, gitRoot);
  if (!addResult.ok) return { ok: false, message: `Failed: ${addResult.stderr || addResult.stdout}` };
  return { ok: true, message: `Worktree created at ${worktreePath}`, data: { path: worktreePath, branch: branchName } };
}

/**
 * List git worktrees.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export async function listWorktrees(targetDir) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const result = await execGit('git worktree list', gitRoot);
  if (!result.ok) return { ok: false, message: `Failed: ${result.stderr}` };
  const worktrees = result.stdout.split('\n').filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    return { path: parts[0], hash: parts[1], branch: parts.slice(2).join(' ').replace(/^\[|\]$/g, '') || '(detached)' };
  });
  return { ok: true, message: `${worktrees.length} worktree(s)`, data: worktrees };
}

/**
 * Prune orphaned worktrees.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string }}
 */
export async function pruneWorktrees(targetDir) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const result = await execGit('git worktree prune', gitRoot);
  if (!result.ok) return { ok: false, message: `Failed: ${result.stderr}` };
  return { ok: true, message: 'Orphaned worktree metadata pruned' };
}

/**
 * Remove a worktree.
 * @param {string} targetDir
 * @param {string} name
 * @param {boolean} [force]
 * @returns {{ ok: boolean, message: string }}
 */
export async function removeWorktree(targetDir, name, force) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const { resolve: resolvePath, dirname: dirnamePath } = await import('node:path');
  const worktreePath = resolvePath(dirnamePath(gitRoot), `feat-${name}`);
  if (!existsSync(worktreePath)) return { ok: false, message: `Worktree not found: ${worktreePath}` };
  const cmd = force ? `git worktree remove --force "${worktreePath}"` : `git worktree remove "${worktreePath}"`;
  const result = await execGit(cmd, gitRoot);
  if (!result.ok) return { ok: false, message: `Failed: ${result.stderr || result.stdout}` };
  return { ok: true, message: `Worktree removed from ${worktreePath}` };
}

/**
 * List available checkpoints (tags).
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export async function listCheckpoints(targetDir) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const r = await execGit(
    'git tag --list "phase/*" "iter/*" "manual/*" --sort=-taggerdate --format="%(refname:short)|%(taggerdate:iso)|%(objectname)"',
    gitRoot,
  );
  if (!r.ok || !r.stdout) return { ok: true, message: 'No checkpoints found', data: [] };
  const checkpoints = r.stdout.split('\n').filter(Boolean).map(line => {
    const [ref, date, hash] = line.split('|');
    const segments = ref.split('/');
    return { ref, type: segments[0], name: segments.slice(1).join('/'), date: date || 'unknown', hash: hash || '—' };
  });
  return { ok: true, message: `${checkpoints.length} checkpoint(s)`, data: checkpoints };
}

/**
 * Create a manual checkpoint tag.
 * @param {string} targetDir
 * @param {string} label
 * @param {boolean} [force] — skip clean check
 * @returns {{ ok: boolean, message: string }}
 */
export async function createCheckpoint(targetDir, label, force) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  if (!force) {
    const cleanCheck = await execGit('git status --porcelain', gitRoot);
    if (cleanCheck.ok && cleanCheck.stdout.length > 0) {
      return { ok: false, message: 'Working tree not clean. Use --force to checkpoint anyway.' };
    }
  }
  const tagName = `manual/${label}`;
  if (await gitTagExists(tagName, gitRoot)) {
    return { ok: false, message: `Tag "${tagName}" already exists` };
  }
  const created = await createGitTag(tagName, `checkpoint: ${label}`, gitRoot);
  if (!created) return { ok: false, message: `Failed to create tag: ${tagName}` };
  return { ok: true, message: `Checkpoint "${tagName}" created` };
}

/**
 * Rollback to a checkpoint (restore working tree).
 * @param {string} targetDir
 * @param {string} checkpoint
 * @returns {{ ok: boolean, message: string }}
 */
export async function rollbackTo(targetDir, checkpoint) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const tagCheck = await execGit(`git rev-parse --verify "${checkpoint}^{commit}"`, gitRoot);
  if (!tagCheck.ok) return { ok: false, message: `Checkpoint "${checkpoint}" not found` };
  await execGit('git stash push -m "rollback-auto-stash"', gitRoot);
  const restoreResult = await execGit(`git checkout "${checkpoint}" -- .`, gitRoot);
  if (!restoreResult.ok) return { ok: false, message: `Failed: ${restoreResult.stderr}` };
  return { ok: true, message: `Restored to checkpoint "${checkpoint}"` };
}

/**
 * Create a recovery branch from a checkpoint.
 * @param {string} targetDir
 * @param {string} checkpoint
 * @returns {{ ok: boolean, message: string, data?: string }}
 */
export async function rollbackBranch(targetDir, checkpoint) {
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) return { ok: false, message: 'Not inside a git repository' };
  const tagCheck = await execGit(`git rev-parse --verify "${checkpoint}^{commit}"`, gitRoot);
  if (!tagCheck.ok) return { ok: false, message: `Checkpoint "${checkpoint}" not found` };
  const safeName = checkpoint.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/\//g, '-');
  const branchName = `recovery/from-${safeName}`;
  const branchCheck = await execGit(`git show-ref --verify --quiet refs/heads/${branchName}`, gitRoot);
  if (branchCheck.ok) return { ok: false, message: `Branch "${branchName}" already exists` };
  const result = await execGit(`git checkout -b "${branchName}" "${checkpoint}"`, gitRoot);
  if (!result.ok) return { ok: false, message: `Failed: ${result.stderr}` };
  return { ok: true, message: `Recovery branch "${branchName}" created`, data: branchName };
}

// ════════════════════════════════════════════════════════════════════════════
// DATA VIEWER ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get feature list (features + tasks + status).
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getFeatureList(targetDir) {
  try {
    const fl = loadFeatureList(targetDir);
    return { ok: true, message: `${fl.features?.length || 0} feature(s)`, data: fl };
  } catch (err) {
    return { ok: false, message: `Failed to load feature list: ${err.message}` };
  }
}

/**
 * Get all lessons from progress.md.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export function getLessons(targetDir) {
  try {
    const lessons = readLessons(targetDir);
    return { ok: true, message: `${lessons.length} lesson(s)`, data: lessons };
  } catch (err) {
    return { ok: false, message: `Failed to load lessons: ${err.message}` };
  }
}

/**
 * Append a lesson to progress.md.
 * @param {string} targetDir
 * @param {string} text
 * @returns {{ ok: boolean, message: string }}
 */
export function addLesson(targetDir, text) {
  if (!text) return { ok: false, message: 'Lesson text required' };
  const result = appendLesson(targetDir, text);
  if (!result.ok) return { ok: false, message: result.error || 'Failed to save lesson' };
  return { ok: true, message: `Lesson saved: "${text}"` };
}

/**
 * Get session state from progress.md.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getSessionState(targetDir) {
  try {
    const state = readSessionState(targetDir);
    return { ok: true, message: 'Session state loaded', data: state };
  } catch (err) {
    return { ok: false, message: `Failed to load session state: ${err.message}` };
  }
}

/**
 * Get full progress.md content.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: string }}
 */
export function getProgressText(targetDir) {
  const path = PROGRESS_PATH(targetDir);
  if (!existsSync(path)) return { ok: false, message: 'No progress.md found' };
  try {
    const text = readFileSync(path, 'utf-8');
    return { ok: true, message: 'Progress loaded', data: text };
  } catch (err) {
    return { ok: false, message: `Failed to read progress: ${err.message}` };
  }
}

/**
 * Get gate history from config.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export function getGateHistory(targetDir) {
  const { value, ok } = configGet(targetDir, 'gateHistory');
  if (!ok) return { ok: true, message: 'No gate history', data: [] };
  return { ok: true, message: `${(value || []).length} gate result(s)`, data: value || [] };
}

/**
 * Get evaluator rubric text.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: string }}
 */
export function getRubric(targetDir) {
  const path = RUBRIC_PATH(targetDir);
  if (!existsSync(path)) return { ok: false, message: 'No evaluator-rubric.md found' };
  try {
    const text = readFileSync(path, 'utf-8');
    return { ok: true, message: 'Rubric loaded', data: text };
  } catch (err) {
    return { ok: false, message: `Failed to read rubric: ${err.message}` };
  }
}

// ════════════════════════════════════════════════════════════════════════════
// STACK & TOOL DETECTION ACTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Detect project stack.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function detectProjectStack(targetDir) {
  const stack = detectStack(targetDir);
  return { ok: true, message: `Detected: ${stack.label}`, data: stack };
}

/**
 * List all available stacks.
 * @returns {{ ok: boolean, message: string, data?: array }}
 */
export function getAvailableStacks() {
  const stacks = listStacks();
  return { ok: true, message: `${stacks.length} stacks available`, data: stacks };
}

/**
 * Detect configured agent tools.
 * @param {string} targetDir
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function detectAgentTools(targetDir) {
  const detected = [];
  for (const { tool, file } of getAllDetectionSignatures()) {
    if (existsSync(resolve(targetDir, file))) {
      if (!detected.includes(tool)) detected.push(tool);
    }
  }
  const { config, ok } = loadConfig(targetDir);
  const configured = ok && config.agentTool ? config.agentTool : null;
  return {
    ok: true,
    message: detected.length > 0 ? `Detected: ${detected.join(', ')}` : 'No tools detected',
    data: { detected, configured, tools: TOOL_REGISTRY },
  };
}

/**
 * Get all known agent tools with metadata.
 * @returns {{ ok: boolean, message: string, data?: object }}
 */
export function getAgentTools() {
  return { ok: true, message: 'Tools loaded', data: TOOL_REGISTRY };
}

// ════════════════════════════════════════════════════════════════════════════
// SCAFFOLD ACTION (for setup wizard)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Scaffold a new harness project (used by setup wizard).
 * @param {string} targetDir
 * @param {{ stack: string, agentTool?: string, mode?: string, enableGates?: boolean }} opts
 * @returns {{ ok: boolean, message: string, data?: { files: array, errors: array } }}
 */
export async function scaffoldProject(targetDir, opts) {
  const { stack, agentTool, mode = 'copilot', enableGates = false } = opts;
  if (!stack) return { ok: false, message: 'Stack is required' };

  mkdirSync(join(targetDir, 'harness'), { recursive: true });
  const created = [];
  const errors = [];

  // 1. Template files
  try {
    const tmplResult = generateTemplates({ stack, target: targetDir });
    created.push(...tmplResult.files);
    errors.push(...tmplResult.errors);
  } catch (err) {
    errors.push(`Template generation: ${err.message}`);
  }

  // 2. Extra files
  const extraFiles = getExtraFiles(stack);
  for (const [relPath, content] of Object.entries(extraFiles)) {
    const absPath = join(targetDir, relPath);
    mkdirSync(resolve(absPath, '..'), { recursive: true });
    try {
      writeFileSync(absPath, content, 'utf-8');
      created.push(absPath);
    } catch (err) {
      errors.push(`${relPath}: ${err.message}`);
    }
  }

  // 3. .gitignore
  try {
    writeFileSync(join(targetDir, '.gitignore'), getGitignoreContent(stack), 'utf-8');
    created.push(join(targetDir, '.gitignore'));
  } catch (err) {
    errors.push(`.gitignore: ${err.message}`);
  }

  // 4. Stack config + version files
  const meta = getStackMeta(stack, targetDir);
  if (meta?.configFile) {
    const cfPath = join(targetDir, meta.configFile);
    const cfContent = getConfigFileContent(stack);
    if (cfContent !== null && !existsSync(cfPath)) {
      try { writeFileSync(cfPath, cfContent, 'utf-8'); created.push(cfPath); }
      catch (err) { errors.push(`${meta.configFile}: ${err.message}`); }
    }
  }
  if (meta?.versionFile) {
    const vfPath = join(targetDir, meta.versionFile);
    const vfContent = getVersionFileContent(stack);
    if (vfContent !== null && vfContent !== '' && !existsSync(vfPath)) {
      try { writeFileSync(vfPath, vfContent, 'utf-8'); created.push(vfPath); }
      catch (err) { errors.push(`${meta.versionFile}: ${err.message}`); }
    }
  }

  // 5. Agent tool file (e.g. CLAUDE.md, .cursorrules)
  if (agentTool) {
    const toolEntry = getToolEntry(agentTool);
    if (toolEntry?.file) {
      const agentsMdPath = join(targetDir, 'AGENTS.md');
      if (existsSync(agentsMdPath)) {
        try {
          const agentsContent = readFileSync(agentsMdPath, 'utf-8');
          const header = toolEntry.header || '';
          const outPath = join(targetDir, toolEntry.file);
          mkdirSync(resolve(outPath, '..'), { recursive: true });
          writeFileSync(outPath, header + '\n' + agentsContent, 'utf-8');
          created.push(outPath);
        } catch (err) { errors.push(`${toolEntry.file}: ${err.message}`); }
      }
    }
  }

  // 6. Update config with wizard choices
  const configPath = CONFIG_PATH(targetDir);
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
      cfg.stack = stack;
      cfg.mode = mode;
      cfg.gates.enabled = enableGates;
      if (agentTool) cfg.agentTool = agentTool;
      writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
    } catch (err) { errors.push(`Config update: ${err.message}`); }
  }

  // 7. Git init
  const gitRoot = await getGitRoot(targetDir);
  if (!gitRoot) {
    try {
      await execGit('git init', targetDir);
      await execGit('git add -A', targetDir);
      await execGit('git commit -m "harness: initial scaffold" --allow-empty', targetDir);
    } catch (err) { errors.push(`Git init: ${err.message}`); }
  }

  return {
    ok: errors.length === 0,
    message: `Created ${created.length} file(s)${errors.length > 0 ? ` with ${errors.length} error(s)` : ''}`,
    data: { files: created, errors },
  };
}

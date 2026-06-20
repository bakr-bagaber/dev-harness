/**
 * ralph-output — Human-readable instruction builders for Ralph loop phases.
 *
 * Extracted from ralph-inner.mjs to separate instruction text generation
 * from loop orchestration logic. Each builder returns a string of agent
 * instructions for a phase/feature/task combination.
 *
 * Usage:
 *   import { buildFeatureIterateOutput, buildDeliverableRetryOutput } from "./ralph-output.mjs";
 */
import { phaseLabel } from './command-helpers.mjs';

// ── Output builders ──────────────────────────────────────────────────────────

/**
 * Build human-readable instructions for the SIMPLIFY phase.
 * Spec: PROJECT_PLAN.md lines 602-631.
 */
export function buildSimplifyOutput(feature, task, maxRetries, resetOnRetry, autoCommit) {
  let out = '';
  out += `═══ SIMPLIFY PHASE ═══\n`;
  out += `\n`;
  out += `This is a feature-iterate phase. Pick one feature at a time.\n`;
  out += `If validation fails (up to ${maxRetries} attempts), retry with fresh context.\n`;
  out += `\n`;
  out += `Current feature: "${feature.name}" (${feature.id})\n`;
  out += `\n`;
  out += `Planner: identify code smells, excessive nesting,\n`;
  out += `         DRY violations, premature optimization\n`;
  out += `         Set targets: "flatten nested loop X",\n`;
  out += `         "extract validation logic from controller Y"\n`;
  out += `\n`;
  out += `Simplifier (Generator persona): refactor code for clarity\n`;
  out += `  - Extract repeated logic into shared functions\n`;
  out += `  - Flatten nested conditionals (max 4 levels)\n`;
  out += `  - Remove dead code and commented-out blocks\n`;
  out += `  - Rename unclear variables\n`;
  out += `  - Break functions exceeding ~40 lines\n`;
  out += `  - ⚠ Never change behavior — tests must still pass\n`;
  out += `\n`;
  out += `Evaluator: verify against these criteria:\n`;
  out += `  - No dead code or unused imports\n`;
  out += `  - No commented-out code blocks\n`;
  out += `  - No nesting beyond 4 levels\n`;
  out += `  - No DRY violations (same logic repeated 3+ times)\n`;
  out += `  - All tests still pass after refactoring\n`;
  out += `\n`;
  out += `Iteration: validate --feature ${feature.id} --task ${task.id}\n`;
  out += `  → pass → next feature\n`;
  out += `  → fail (≤${maxRetries}x) → retry with fresh context\n`;
  out += `  → fail (>${maxRetries}x) → escalate to human\n`;
  if (resetOnRetry) { out += `\n  Git reset on retry: enabled\n`; }
  if (autoCommit) { out += `  Auto-commit: enabled\n`; }
  return out;
}

/**
 * Build human-readable instructions for a feature-iterate phase.
 */
export function buildFeatureIterateOutput(phase, feature, task, mode, maxRetries, resetOnRetry, autoCommit) {
  if (phase === 'simplify') {
    return buildSimplifyOutput(feature, task, maxRetries, resetOnRetry, autoCommit);
  }
  let out = '';
  out += `═══ ${phaseLabel(phase)} PHASE ═══\n`;
  out += `\n`;
  out += `This is a feature-iterate phase. You pick one incomplete\n`;
  out += `feature at a time. If validation fails (up to ${maxRetries}\n`;
  out += `attempts), retry that task with fresh context.\n`;
  out += `\n`;
  out += `Current feature: "${feature.name}" (${feature.id})\n`;
  out += `Current task: "${task.description}" (${task.id})\n`;
  out += `\n`;
  out += `Planner: pick next feature from feature_list.json where passes=false\n`;
  out += `         Select one uncompleted task from that feature's task list\n`;
  out += `\n`;
  out += `Generator: implement ONE task only. When done, call validate.\n`;
  out += `\n`;
  out += `Evaluator: verify against that task's acceptance criteria.\n`;
  out += `           Run the verification commands yourself.\n`;
  out += `\n`;
  out += `Iteration pattern:\n`;
  out += `  Pick task → implement → validate --feature ${feature.id} --task ${task.id}\n`;
  out += `  → Pass: mark task complete, pick next task\n`;
  out += `  → Fail (≤${maxRetries}x): git auto-commit, retry with fresh context\n`;
  out += `  → Fail (>${maxRetries}x): escalate to human\n`;
  if (resetOnRetry) {out += `\n  Git reset on retry: enabled\n`;}
  if (autoCommit) {out += `  Auto-commit: enabled\n`;}
  return out;
}

/**
 * Build human-readable instructions for a deliverable-retry phase.
 */
export function buildDeliverableRetryOutput(phase, mode, maxRetries, resetOnRetry, autoCommit) {
  let out = '';
  out += `═══ ${phaseLabel(phase)} PHASE ═══\n`;
  out += `\n`;
  out += `This is a deliverable-retry phase. You produce one deliverable.\n`;
  out += `If validation fails (up to ${maxRetries} attempts), retry with fresh context.\n`;
  out += `\n`;

  // Phase-specific planner/generator/evaluator instructions
  switch (phase) {
    case 'define':
      out += `Planner: interview the user, write PRD in specs/*.md,\n`;
      out += `         define acceptance criteria per feature\n`;
      if (mode === 'autopilot') {
        out += `\n`;
        out += `         Write plans/outer-loop-plan.md with:\n`;
        out += `         - Feature delivery order\n`;
        out += `         - Estimated iterations per feature\n`;
        out += `         - Risk factors and escalation thresholds\n`;
      }
      out += `\n`;
      out += `Generator: produce spec documents (specs/*.md,\n`;
      out += `           sprint-contract.md) following the PRD\n`;
      if (mode === 'autopilot') {
        out += `           Create plans/outer-loop-plan.md\n`;
      }
      out += `\n`;
      out += `Evaluator: verify against these criteria:\n`;
      out += `  - All 5 spec sections present (overview, requirements,\n`;
      out += `    acceptance criteria, edge cases, open questions)\n`;
      out += `  - No TODO/FIXME placeholders in specs\n`;
      out += `  - Sprint Contract agreed between Planner and Evaluator\n`;
      break;
    case 'plan':
      out += `Planner: decompose features into tasks in feature_list.json\n`;
      out += `         Define task dependencies and effort estimates\n`;
      out += `\n`;
      out += `Generator: populate feature_list.json with all features\n`;
      out += `           and tasks for this sprint\n`;
      out += `\n`;
      out += `Evaluator: verify against these criteria:\n`;
      out += `  - feature_list.json is valid JSON\n`;
      out += `  - All features have at least one task\n`;
      out += `  - DAG of tasks is acyclic\n`;
      break;
    case 'review':
      out += `Planner: review all phase gates have passed\n`;
      out += `         Identify any outstanding blockers\n`;
      out += `\n`;
      out += `Generator: update evaluator-rubric.md with results\n`;
      out += `           Ensure CHANGELOG.md is updated\n`;
      out += `\n`;
      out += `Evaluator: verify against these criteria:\n`;
      out += `  - Branch up-to-date with main\n`;
      out += `  - All gates pass (lint, tests, coverage)\n`;
      out += `  - Sprint contract acceptance criteria met\n`;
      break;
    case 'ship':
      out += `Planner: verify pipeline is complete\n`;
      out += `         Prepare release notes\n`;
      out += `\n`;
      out += `Generator: tag commit, update changelog,\n`;
      out += `           verify git clean\n`;
      out += `\n`;
      out += `Evaluator: verify against these criteria:\n`;
      out += `  - Git status is clean\n`;
      out += `  - HEAD is tagged\n`;
      out += `  - CHANGELOG.md updated\n`;
      break;
    default:
      out += `Planner: define scope of this deliverable\n`;
      out += `\n`;
      out += `Generator: produce the phase deliverable\n`;
      out += `\n`;
      out += `Evaluator: verify against phase criteria\n`;
      break;
  }

  out += `\n`;
  out += `When done, run: dev-harness validate\n`;
  if (resetOnRetry) {out += `Git reset on retry: enabled\n`;}
  if (autoCommit) {out += `Auto-commit: enabled\n`;}
  return out;
}

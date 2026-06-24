/**
 * dashboard — Pipeline progress renderer with checkmarks.
 *
 * Renders a visual dashboard showing phases, features, and tasks
 * with completion status. Called at pipeline start and every transition.
 *
 * Usage:
 *   import { renderDashboard, getDashboardData } from './dashboard.mjs';
 *   renderDashboard('/path/to/project');
 *   const data = getDashboardData('/path/to/project');  // for JSON/TUI
 */
import { loadConfig, getPhaseOrder } from './state.mjs';
import { loadFeatureList, getNextFeature, getNextTask } from './ralph-inner.mjs';

// ── Constants ────────────────────────────────────────────────────────────────

const BOX_WIDTH = 64;

// Phases that iterate features (must match ralph-inner.mjs FEATURE_ITERATE)
const FEATURE_ITERATE_PHASES = new Set(['build', 'verify', 'simplify']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pad a string to a visual width, accounting for emoji width.
 * Simple heuristic: emoji and wide chars count as 2 columns.
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function pad(str, width) {
  // Rough visual width: most emoji are 2 columns, ASCII is 1
  let visualWidth = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    if (code > 0x1F000 || (code >= 0x2500 && code <= 0x257F)) {
      visualWidth += 2; // emoji and box-drawing chars
    } else {
      visualWidth += 1;
    }
  }
  return str + ' '.repeat(Math.max(0, width - visualWidth));
}

/**
 * Format a single boxed line.
 * @param {string} content
 * @returns {string}
 */
function boxLine(content) {
  return `║ ${pad(content, BOX_WIDTH - 4)} ║`;
}

/**
 * Top border of the box.
 * @returns {string}
 */
function boxTop() {
  return '╔' + '═'.repeat(BOX_WIDTH - 2) + '╗';
}

/**
 * Separator line inside the box.
 * @returns {string}
 */
function boxSep() {
  return '╠' + '═'.repeat(BOX_WIDTH - 2) + '╣';
}

/**
 * Bottom border of the box.
 * @returns {string}
 */
function boxBottom() {
  return '╚' + '═'.repeat(BOX_WIDTH - 2) + '╝';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Render the full pipeline dashboard to stdout.
 *
 * Shows three sections with checkmarks:
 *   1. Phases — all phases with ✅ (done), →🟠 (current), ☐ (pending)
 *   2. Features — for feature-iterate phases, with task counts
 *   3. Tasks — for the current feature, with per-task status
 *
 * @param {string} targetDir
 * @param {object} [options]
 * @param {boolean} [options.json] — skip rendering if JSON mode
 */
export function renderDashboard(targetDir, options = {}) {
  if (options.json) { return; }

  const data = getDashboardData(targetDir);
  if (!data) { return; }

  const lines = buildDashboardLines(data);
  for (const line of lines) {
    process.stdout.write(line + '\n');
  }
}

/**
 * Build dashboard lines as an array of strings.
 * Separated from renderDashboard so the TUI can use it for double-buffering.
 * @param {object} data — from getDashboardData()
 * @returns {string[]}
 */
export function buildDashboardLines(data) {
  const lines = [];

  // ── Header ──────────────────────────────────────────────────
  const header = `🎯 Dev Harness — ${data.project} (${data.stack ?? 'unknown'}, ${data.mode})`;
  lines.push('');
  lines.push(boxTop());
  lines.push(boxLine(header));
  lines.push(boxSep());

  // ── Phases ──────────────────────────────────────────────────
  lines.push(boxLine(''));
  lines.push(boxLine('📋 Phases'));
  const currentIdx = data.phases.findIndex(p => p.status === 'current');
  for (let i = 0; i < data.phases.length; i++) {
    const p = data.phases[i];
    let icon, marker;
    if (p.status === 'done') {
      icon = '✅'; marker = '  ';
    } else if (p.status === 'current') {
      icon = '→'; marker = '🟠';
    } else {
      icon = '☐'; marker = '  ';
    }
    const label = p.name.toUpperCase();
    const isCurrent = p.status === 'current';
    lines.push(boxLine(`    ${icon} ${marker} ${label}${isCurrent ? '  ← current' : ''}`));
  }

  // ── Features (only for feature-iterate phases) ──────────────
  if (data.features.length > 0) {
    const featuresDone = data.features.filter(f => f.passes).length;
    const featuresTotal = data.features.length;
    const phaseLabel = (data.currentPhase ?? '').toUpperCase();

    lines.push(boxLine(''));
    lines.push(boxLine(`🎯 Features (${phaseLabel}) — ${featuresDone}/${featuresTotal} done`));

    for (const feat of data.features) {
      let icon, marker;
      const isCurrent = !feat.passes && feat.tasksDone < feat.tasksTotal && feat === data.features.find(f => !f.passes);
      if (feat.passes) {
        icon = '✅'; marker = '  ';
      } else if (isCurrent) {
        icon = '→'; marker = '🟡';
      } else {
        icon = '☐'; marker = '  ';
      }
      const taskSummary = feat.tasksTotal > 0 ? ` (${feat.tasksDone}/${feat.tasksTotal} tasks)` : '';
      lines.push(boxLine(`    ${icon} ${marker} ${feat.name}${taskSummary}`));
    }

    // ── Tasks (for current feature) ─────────────────────────
    if (data.tasks.length > 0) {
      const currentFeature = data.features.find(f => !f.passes);
      const featName = currentFeature ? currentFeature.name : '';

      lines.push(boxLine(''));
      lines.push(boxLine(`📝 Tasks (${featName})`));

      for (const task of data.tasks) {
        let icon, marker;
        if (task.status === 'complete') {
          icon = '✅'; marker = '  ';
        } else if (task.status === 'in_progress' || (task.status === 'pending' && task === data.tasks.find(t => t.status !== 'complete'))) {
          icon = '→'; marker = '🟡';
        } else {
          icon = '☐'; marker = '  ';
        }
        lines.push(boxLine(`    ${icon} ${marker} ${task.description}`));
      }
    }
  }

  // ── Footer ──────────────────────────────────────────────────
  const retryCount = data.retryCount ?? 0;
  const maxRetries = data.maxRetries ?? 10;
  const taskRetry = data.taskRetryCount ?? 0;
  const paused = data.paused ? '⏸ paused' : 'running';

  lines.push(boxLine(''));
  lines.push(boxLine(`🔄 Retry: ${retryCount}/${maxRetries}  |  Task retry: ${taskRetry}/${maxRetries}  |  ${paused}`));
  lines.push(boxBottom());
  lines.push('');

  return lines;
}

/**
 * Get dashboard data as a structured object (for JSON mode or TUI).
 *
 * @param {string} targetDir
 * @returns {object|null} — null if config not found
 */
export function getDashboardData(targetDir) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) { return null; }

  const order = getPhaseOrder(config.phases?.enabled);
  const currentPhase = config.currentPhase;
  const currentIdx = order.indexOf(currentPhase);

  const phases = order.map((p, i) => ({
    name: p,
    status: i < currentIdx ? 'done' : p === currentPhase ? 'current' : 'pending',
  }));

  let features = [];
  let tasks = [];

  if (currentPhase && FEATURE_ITERATE_PHASES.has(currentPhase)) {
    const fl = loadFeatureList(targetDir);
    const flFeatures = fl.features || [];

    features = flFeatures.map(f => ({
      id: f.id,
      name: f.name,
      passes: f.passes,
      tasksDone: (f.tasks || []).filter(t => t.status === 'complete').length,
      tasksTotal: (f.tasks || []).length,
      tasks: (f.tasks || []).map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
      })),
    }));

    const currentFeature = getNextFeature(flFeatures);
    if (currentFeature) {
      tasks = (currentFeature.tasks || []).map(t => ({
        id: t.id,
        description: t.description,
        status: t.status,
      }));
    }
  }

  return {
    project: targetDir.split('/').pop(),
    stack: config.stack,
    mode: config.mode,
    paused: config.paused,
    currentPhase,
    phases,
    features,
    tasks,
    retryCount: config.retryCount ?? 0,
    taskRetryCount: config.taskRetryCount ?? 0,
    maxRetries: config.maxRetries ?? 10,
  };
}

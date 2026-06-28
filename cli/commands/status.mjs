/**
 * status — Show current phase + gate state + detected stack.
 *
 * Reads harness-config.json via state.mjs for live project state,
 * plus runs stack detection and gate checks for current status.
 *
 * Usage: dev-harness status [--json] [--target <dir>]
 */
import { resolve, basename } from 'node:path';
import { detectStack } from '../lib/detect-stack.mjs';
import { loadConfig } from '../lib/state.mjs';
import { readLessons, readHandoff, readProgressTail, readDecisionsTail } from '../lib/progress.mjs';
import { loadFeatureList, getNextFeature } from '../lib/ralph-tasks.mjs';
import { runChecks, areGatesEnabled } from '../lib/gates.mjs';
import { emitJson, emitHuman } from '../lib/output.mjs';

export default async function statusCommand(args) {
  const rawTarget = args.flags?.target;
  const targetDir = (typeof rawTarget === 'string') ? resolve(rawTarget) : process.cwd();
  const json = !!(args.json || args.flags?.json);

  // Stack detection
  const stack = detectStack(targetDir);

  // Config state (graceful if missing)
  const { config, ok: configOk, schemaErrors = [] } = loadConfig(targetDir);
  const phase = configOk ? config.currentPhase : null;
  const mode = configOk ? config.mode : 'copilot';

  // Current feature from feature_list.json
  let currentFeature = null;
  if (configOk && phase) {
    try {
      const fl = loadFeatureList(targetDir);
      const next = getNextFeature(fl.features);
      if (next) {
        currentFeature = { id: next.id, name: next.name };
      }
    } catch {
      // feature_list.json missing or invalid
    }
  }

  // Gate status — run checks for current phase
  let gateStatus = 'disabled';
  let checksPassing = 0;
  let checksTotal = 0;
  if (phase && areGatesEnabled(targetDir)) {
    const gateResult = await runChecks(targetDir, phase);
    checksTotal = gateResult.checks.length;
    checksPassing = gateResult.checks.filter(c => c.pass).length;
    gateStatus = gateResult.overall ? 'pass' : 'fail';
  }

  // Lessons — last 3
  const allLessons = readLessons(targetDir);
  const recentLessons = allLessons.slice(-3);

  // G15: session state from handoff file + progress tail + decisions tail
  const sessionState = readHandoff(targetDir);
  const progressTail = readProgressTail(targetDir, 5);
  const decisionsTail = readDecisionsTail(targetDir, 3);

  if (json) {
    emitJson({
      command: 'status',
      status: 'ok',
      message: configOk
        ? `Phase: ${phase || 'not started'}, Stack: ${stack.label}`
        : 'No harness/config.json found — run dev-harness init',
      project: basename(targetDir),
      stack: stack.name,
      stackLabel: stack.label,
      mode,
      currentPhase: phase,
      currentRole: configOk ? (config.currentRole || null) : null,
      currentFeature: currentFeature?.name || null,
      gateStatus,
      checksPassing,
      checksTotal,
      paused: configOk ? config.paused : false,
      features: configOk ? config.features : { remaining: 0, passing: 0, total: 0 },
      git: configOk ? config.git : { clean: true },
      maxRetries: configOk ? config.maxRetries : 3,
      retry: configOk ? (config.retry || { tasks: { enabled: true, maxRetries: config.maxRetries ?? 3 }, features: { enabled: false, maxRetries: 2 }, phases: { enabled: false, maxRetries: 2 } }) : null,
      retryCounters: configOk ? {
        retryCount: config.retryCount ?? 0,
        taskRetryCount: config.taskRetryCount ?? 0,
        featureRetryCount: config.featureRetryCount ?? 0,
        phaseRetryCount: config.phaseRetryCount ?? 0,
        pipelineIteration: config.pipelineIteration ?? 0,
      } : null,
      recentLessons: recentLessons.map(l => ({ date: l.date, author: l.author, text: l.text })),
      // G15: clock-in snapshot — one command = full context
      sessionState: sessionState ? sessionState.fields : null,
      handoffTimestamp: sessionState ? sessionState.timestamp : null,
      progressTail: progressTail.map(p => ({ timestamp: p.date, action: p.text })),
      decisionsTail,
      schemaErrors,
      nextAction: determineNextAction(targetDir, configOk, config, phase, gateStatus),
    });
    return;
  }

  // ── Human-readable output ─────────────────────────────────────────────
  // Render dashboard first (phases + features + tasks with checkmarks)

  let out = '';
  out += '═══ harness Status ═══\n';
  out += line('Project:', basename(targetDir)) + '\n';
  out += line('Stack:', `${stack.label}${stack.name !== 'generic' ? '' : ' (not detected)'}`) + '\n';
  out += line('Mode:', modeLabel(mode)) + '\n';
  out += '\n';

  if (configOk && phase) {
    out += line('Current Phase:', phase.toUpperCase()) + '\n';
    if (currentFeature) {
      out += line('Current Feature:', `${currentFeature.name} (${currentFeature.id})`) + '\n';
    }
    out += line('Gate Status:', gateStatusLabel(gateStatus, checksPassing, checksTotal)) + '\n';
    if (config.git?.branch) {
      out += line('Branch:', config.git.branch) + '\n';
    }
    out += '\n';
  } else if (configOk) {
    out += '  Phase: not started.\n';
    out += '\n';
  } else {
    out += '  No harness/config.json found.\n';
    out += '\n';
  }

  // Lessons
  if (recentLessons.length > 0) {
    out += `Last ${recentLessons.length} lesson(s):\n`;
    for (const l of recentLessons) {
      out += `  ${l.date} | ${l.text}\n`;
    }
    out += '\n';
  }

  // Schema violations (if any) — surface so users know config is malformed
  if (configOk && schemaErrors.length > 0) {
    out += `Schema warnings (${schemaErrors.length}):\n`;
    for (const e of schemaErrors) {
      out += `  ⚠ ${e}\n`;
    }
    out += '\n';
  }

  // Next action
  out += '  ' + determineNextAction(targetDir, configOk, config, phase, gateStatus) + '\n';

  emitHuman(out);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function line(k, v) {
  return `${k.padEnd(18)}${v}`;
}

function modeLabel(mode) {
  return mode === 'autopilot' ? 'Autopilot' : 'Copilot';
}

function gateStatusLabel(status, passing, total) {
  if (status === 'disabled') {return 'disabled';}
  if (total === 0) {return status;}
  return `${status === 'pass' ? 'passing' : 'failing'} — ${passing}/${total} checks passing`;
}

function determineNextAction(targetDir, configOk, config, phase, gateStatus) {
  if (!configOk) {
    return 'Run: dev-harness init';
  }
  if (!phase) {
    return 'Run: dev-harness phase define to start';
  }
  if (gateStatus === 'fail') {
    return 'Run: dev-harness validate to re-check';
  }
  // Determine next phase
  const order = ['define', 'plan', 'build', 'verify', 'review', 'ship'];
  const idx = order.indexOf(phase);
  if (idx >= 0 && idx < order.length - 1) {
    return `Run: dev-harness phase ${order[idx + 1]}`;
  }
  return `Run: dev-harness validate`;
}

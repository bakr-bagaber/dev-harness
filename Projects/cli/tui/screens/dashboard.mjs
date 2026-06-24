/**
 * dashboard — Main interactive dashboard screen.
 *
 * The primary TUI screen when a project is initialized. Shows:
 *   - Pipeline phases with checkmarks (✓/●/○)
 *   - Current feature/task
 *   - Mode, retry count, iteration
 *   - Current phase instructions
 *   - Gate status summary
 *   - Context-aware keybindings in status bar
 *
 * Handles all pipeline actions via keyboard:
 *   n=advance  v=validate  V=validate-task  f=fix-gates
 *   c=contract  C=contract-view  a=agent-run
 *   p=pause  r=resume  b=branch
 *   w=worktree  R=rollback  K=checkpoint
 *   l=learn  L=lessons  F=features  P=progress
 *   H=gate-history  E=rubric  s=status
 *   g=gate-config  t=tool-select  m=mode-switch
 *   o=config-editor  d=detect-tool  ?=help  q=quit
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { StatusBar } from '../components/StatusBar.mjs';
import { Badge } from '../components/Badge.mjs';
import {
  getPipelineStatus, runValidation, advancePhase, pausePipeline, resumePipeline,
  getConfig, getContract,
} from '../actions.mjs';
import { getDashboardData, buildDashboardLines } from '../../lib/dashboard.mjs';
import { showToast } from '../screens.mjs';

export default function DashboardScreen({ targetDir, navigate }) {
  const [dashLines, setDashLines] = useState([]);
  const [status, setStatus] = useState(null);
  const [tick, setTick] = useState(0);

  // Refresh dashboard data periodically
  useEffect(() => {
    const refresh = () => {
      try {
        const data = getDashboardData(targetDir);
        setDashLines(buildDashboardLines(data));
      } catch { /* config may be mid-write */ }
      const st = getPipelineStatus(targetDir);
      if (st.ok) setStatus(st.data);
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [targetDir, tick]);

  useInput(async (input, key) => {
    // Pipeline actions
    if (input === 'n') {
      const result = await advancePhase(targetDir);
      showToast(result.message, result.ok ? 'success' : 'error');
      setTick(t => t + 1);
      return;
    }
    if (input === 'v') {
      navigate.push('gate-fix', { phase: status?.phase });
      return;
    }
    if (input === 'V') {
      // Per-task validation — go to gate-fix with task scope
      navigate.push('gate-fix', { phase: status?.phase, scope: 'task' });
      return;
    }
    if (input === 'f') {
      navigate.push('gate-fix', { phase: status?.phase });
      return;
    }
    if (input === 'c') {
      navigate.push('contract');
      return;
    }
    if (input === 'C') {
      navigate.push('contract-view');
      return;
    }
    if (input === 'a') {
      navigate.push('agent-run');
      return;
    }
    if (input === 'p') {
      const result = pausePipeline(targetDir);
      showToast(result.message, result.ok ? 'success' : 'error');
      setTick(t => t + 1);
      return;
    }
    if (input === 'r') {
      const result = resumePipeline(targetDir);
      showToast(result.message, result.ok ? 'success' : 'error');
      setTick(t => t + 1);
      return;
    }
    if (input === 'b') {
      // Quick branch creation — navigate to a simple input
      navigate.push('gate-fix', { action: 'create-branch' });
      return;
    }

    // Git operations
    if (input === 'w') { navigate.push('worktree'); return; }
    if (input === 'R') { navigate.push('rollback'); return; }
    if (input === 'K') { navigate.push('checkpoint'); return; }

    // Data viewers
    if (input === 'l') { navigate.push('learn'); return; }
    if (input === 'L') { navigate.push('lessons'); return; }
    if (input === 'F') { navigate.push('feature-list'); return; }
    if (input === 'P') { navigate.push('progress'); return; }
    if (input === 'H') { navigate.push('gate-history'); return; }
    if (input === 'E') { navigate.push('rubric'); return; }

    // Config
    if (input === 'g') { navigate.push('gate-config'); return; }
    if (input === 't') { navigate.push('tool-select'); return; }
    if (input === 'm') {
      // Quick mode toggle
      const cfg = getConfig(targetDir);
      if (cfg.ok) {
        const newMode = cfg.data.mode === 'autopilot' ? 'copilot' : 'autopilot';
        const { setMode } = await import('../actions.mjs');
        const result = setMode(targetDir, newMode);
        showToast(result.message, result.ok ? 'success' : 'error');
        setTick(t => t + 1);
      }
      return;
    }
    if (input === 'o') { navigate.push('config-editor'); return; }
    if (input === 'd') { navigate.push('tool-select', { detect: true }); return; }

    // Navigation
    if (input === 's') { navigate.push('status'); return; }
    if (input === '?') { navigate.push('help'); return; }
    if (input === 'q') { navigate.exit(); return; }
  });

  // Build context-aware keybindings
  const keys = [
    { key: 'n', label: 'advance' },
    { key: 'v', label: 'validate' },
    { key: 'f', label: 'fix-gates' },
    { key: 'c', label: 'contract' },
  ];
  if (status?.phase && ['build', 'verify'].includes(status.phase)) {
    keys.push({ key: 'a', label: 'agent' });
  }
  if (status?.paused) {
    keys.push({ key: 'r', label: 'resume' });
  } else {
    keys.push({ key: 'p', label: 'pause' });
  }
  keys.push(
    { key: 's', label: 'status' },
    { key: 'o', label: 'config' },
    { key: '?', label: 'help' },
    { key: 'q', label: 'quit' },
  );

  return h(Box, { flexDirection: 'column' },
    // Dashboard pane (phases, features, tasks)
    h(Box, { flexDirection: 'column' },
      dashLines.map((line, i) => h(Text, { key: i }, line)),
    ),
    // Status summary
    status
      ? h(Box, { flexDirection: 'column', marginTop: 1 },
          h(Text, { dimColor: true }, `─`.repeat(60)),
          h(Text, null,
            h(Text, { bold: true }, 'Phase: '),
            status.phase || 'not started',
            h(Text, { dimColor: true }, '  |  Mode: '),
            status.mode,
            h(Text, { dimColor: true }, '  |  Gates: '),
            status.gatesEnabled ? h(Text, { color: 'green' }, 'on') : h(Text, { color: 'gray' }, 'off'),
          ),
          status.feature
            ? h(Text, null,
                h(Text, { bold: true }, 'Feature: '),
                status.feature.name,
                status.task ? `  |  Task: ${status.task.description}` : '')
            : null,
          status.paused
            ? h(Text, { color: 'yellow', bold: true }, '⏸ PAUSED — press r to resume')
            : null,
        )
      : null,
    // Status bar with keybindings
    h(StatusBar, { keys, message: status?.phase ? `Current: ${status.phase.toUpperCase()}` : 'Ready' }),
  );
}

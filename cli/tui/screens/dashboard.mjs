/**
 * dashboard — Main interactive dashboard screen (menu-driven, v3.2.0+).
 *
 * Redesigned from 25 single-letter hotkeys to a context-aware action menu
 * navigable with arrow keys + Enter. Consolidates duplicate data panels into
 * a single state header. Selecting "Advance" opens the advance screen which
 * shows the inner loop's task instructions (instead of discarding them).
 *
 * Navigation: ↑↓ navigate menu, Enter select, / search, q/Esc quit.
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { ActionMenu } from '../components/ActionMenu.mjs';
import {
  getPipelineStatus, pausePipeline, resumePipeline, getConfig,
} from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function DashboardScreen({ targetDir, navigate }) {
  const [status, setStatus] = useState(null);
  const [tick, setTick] = useState(0);

  // Single data source — one getPipelineStatus call feeds everything.
  useEffect(() => {
    const refresh = () => {
      const st = getPipelineStatus(targetDir);
      if (st.ok) setStatus(st.data);
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [targetDir, tick]);

  // Build context-aware action menu items
  const buildMenuItems = () => {
    const phase = status?.phase;
    const paused = status?.paused;
    const isBuildOrVerify = phase && ['build', 'verify', 'simplify'].includes(phase);

    const items = [];

    // ── Pipeline group ──
    items.push({
      label: paused ? 'Resume pipeline' : 'Advance to next task/phase',
      icon: paused ? '▶' : '▶',
      group: 'Pipeline',
      action: () => {
        if (paused) {
          const r = resumePipeline(targetDir);
          showToast(r.message, r.ok ? 'success' : 'error');
          setTick(t => t + 1);
        } else {
          navigate.push('advance');
        }
      },
    });

    if (!paused) {
      items.push({
        label: 'Validate gates',
        icon: '✓',
        group: 'Pipeline',
        action: () => navigate.push('gate-fix', { phase }),
      });
    }

    if (isBuildOrVerify && !paused) {
      items.push({
        label: 'Run agent on current task',
        icon: '🤖',
        group: 'Pipeline',
        action: () => navigate.push('agent-run'),
      });
    }

    if (!paused) {
      items.push({
        label: 'Pause pipeline',
        icon: '⏸',
        group: 'Pipeline',
        action: () => {
          const r = pausePipeline(targetDir);
          showToast(r.message, r.ok ? 'success' : 'error');
          setTick(t => t + 1);
        },
      });
    }

    // ── Sprint & Git group ──
    items.push({
      label: 'Sprint contract',
      icon: '📋',
      group: 'Sprint & Git',
      action: () => navigate.push('contract'),
    });
    items.push({
      label: 'View contract',
      icon: '📄',
      group: 'Sprint & Git',
      action: () => navigate.push('contract-view'),
    });
    items.push({
      label: 'Worktree manager',
      icon: '🌿',
      group: 'Sprint & Git',
      action: () => navigate.push('worktree'),
    });
    items.push({
      label: 'Rollback manager',
      icon: '⏪',
      group: 'Sprint & Git',
      action: () => navigate.push('rollback'),
    });
    items.push({
      label: 'Create checkpoint',
      icon: '📌',
      group: 'Sprint & Git',
      action: () => navigate.push('checkpoint'),
    });

    // ── Configuration group ──
    items.push({
      label: 'Configuration editor',
      icon: '⚙️',
      group: 'Configuration',
      action: () => navigate.push('config-editor'),
    });
    items.push({
      label: 'Retry configuration',
      icon: '🔄',
      group: 'Configuration',
      action: () => navigate.push('retry-config', { targetDir }),
    });
    items.push({
      label: 'Gate configuration',
      icon: '🚦',
      group: 'Configuration',
      action: () => navigate.push('gate-config'),
    });
    items.push({
      label: 'Select agent tool',
      icon: '🛠',
      group: 'Configuration',
      action: () => navigate.push('tool-select'),
    });
    items.push({
      label: 'Toggle mode (copilot/autopilot)',
      icon: '🔀',
      group: 'Configuration',
      action: async () => {
        const cfg = getConfig(targetDir);
        if (cfg.ok) {
          const newMode = cfg.data.mode === 'autopilot' ? 'copilot' : 'autopilot';
          const { setMode } = await import('../actions.mjs');
          const r = setMode(targetDir, newMode);
          showToast(r.message, r.ok ? 'success' : 'error');
          setTick(t => t + 1);
        }
      },
    });

    // ── Views & Logs group ──
    items.push({
      label: 'Detailed status',
      icon: '📊',
      group: 'Views & Logs',
      action: () => navigate.push('status'),
    });
    items.push({
      label: 'Feature list',
      icon: '📋',
      group: 'Views & Logs',
      action: () => navigate.push('feature-list'),
    });
    items.push({
      label: 'Progress log',
      icon: '📝',
      group: 'Views & Logs',
      action: () => navigate.push('progress'),
    });
    items.push({
      label: 'Gate history',
      icon: '📜',
      group: 'Views & Logs',
      action: () => navigate.push('gate-history'),
    });
    items.push({
      label: 'Lessons',
      icon: '📖',
      group: 'Views & Logs',
      action: () => navigate.push('lessons'),
    });
    items.push({
      label: 'Add lesson',
      icon: '✏️',
      group: 'Views & Logs',
      action: () => navigate.push('learn'),
    });
    items.push({
      label: 'Evaluator rubric',
      icon: '📏',
      group: 'Views & Logs',
      action: () => navigate.push('rubric'),
    });

    // ── Help & Quit group ──
    items.push({
      label: 'Help & keybindings',
      icon: '❓',
      group: 'Help & Quit',
      action: () => navigate.push('help'),
    });
    items.push({
      label: 'Quit',
      icon: '🚪',
      group: 'Help & Quit',
      action: () => navigate.exit(),
    });

    return items;
  };

  const menuItems = buildMenuItems();

  // Render pipeline phase indicators
  const renderPhases = () => {
    if (!status?.phase) return h(Text, { dimColor: true }, 'Not started — select "Advance" to begin');
    const allPhases = ['define', 'plan', 'build', 'verify', 'simplify', 'review', 'ship'];
    const currentIdx = allPhases.indexOf(status.phase);
    return h(Text, null,
      allPhases.filter(p => p !== 'simplify' || status?.phase === 'simplify').map((p) => {
        const realIdx = allPhases.indexOf(p);
        const icon = realIdx < currentIdx ? '✅' : realIdx === currentIdx ? '🟠' : '○';
        const label = p.toUpperCase();
        const prefix = realIdx === currentIdx ? '→ ' : '  ';
        return h(Text, {
          key: p,
          color: realIdx === currentIdx ? 'yellow' : realIdx < currentIdx ? 'green' : 'gray',
          bold: realIdx === currentIdx,
        }, `${prefix}${icon} ${label}  `);
      }),
    );
  };

  return h(Box, { flexDirection: 'column' },
    // ── State header (single source of truth) ──
    h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'cyan', paddingX: 1 },
      h(Text, { bold: true },
        `🎯 Dev Harness — ${status?.stackLabel || 'unknown'} (${status?.mode || 'copilot'})`,
      ),
      h(Text, null,
        h(Text, { bold: true }, 'Phase: '),
        h(Text, { color: 'yellow', bold: true }, (status?.phase || 'none').toUpperCase()),
        h(Text, { dimColor: true }, '  |  Gates: '),
        status?.gatesEnabled
          ? h(Text, { color: 'green' }, 'ON')
          : h(Text, { color: 'gray' }, 'off'),
        status?.paused
          ? h(Text, { color: 'yellow', bold: true }, '  |  ⏸ PAUSED')
          : null,
      ),
      status?.feature
        ? h(Text, null,
            h(Text, { bold: true }, 'Feature: '),
            status.feature.name,
            status?.task ? h(Text, { dimColor: true }, `  |  Task: ${status.task.description}`) : null,
          )
        : null,
    ),
    // ── Pipeline phases ──
    h(Box, { marginTop: 1, flexDirection: 'column' },
      h(Text, { bold: true, dimColor: true }, '📋 Pipeline'),
      renderPhases(),
    ),
    // ── Action menu ──
    h(Box, { marginTop: 1, flexDirection: 'column' },
      h(ActionMenu, {
        items: menuItems,
        onSelect: (item) => { if (item.action) item.action(); },
        onCancel: () => navigate.exit(),
        title: 'Actions',
      }),
    ),
  );
}

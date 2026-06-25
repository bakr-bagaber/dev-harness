/** retry-config — 3-level retry configuration overlay (v3.1.0+).
 *  Mirrors `config set retry.*` for tasks/features/phases enabled + maxRetries.
 *  Unified navigation: ↑↓ navigate, Enter toggle/edit, Esc back. */
import { useState, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { StatusBar } from '../components/StatusBar.mjs';
import { getConfig, setConfig } from '../actions.mjs';
import { showToast } from '../screens.mjs';

const LEVELS = [
  { key: 'tasks',    label: 'Task retry',    desc: 'Per-task retry (feature-iterate phases)',    configKey: 'retry.tasks' },
  { key: 'features', label: 'Feature retry', desc: 'Reset feature tasks + re-sweep on task exhaustion', configKey: 'retry.features' },
  { key: 'phases',   label: 'Phase retry',   desc: 'Reset all features + re-run phase on feature exhaustion', configKey: 'retry.phases' },
];

export default function RetryConfigScreen({ targetDir, navigate }) {
  const cfg = getConfig(targetDir);
  const data = cfg.ok ? cfg.data : {};
  const retry = data.retry || { tasks: { enabled: true, maxRetries: 10 }, features: { enabled: false, maxRetries: 2 }, phases: { enabled: false, maxRetries: 2 } };

  const [tasksEnabled, setTasksEnabled] = useState(retry.tasks?.enabled ?? true);
  const [tasksMax, setTasksMax] = useState(retry.tasks?.maxRetries ?? data.maxRetries ?? 10);
  const [featuresEnabled, setFeaturesEnabled] = useState(retry.features?.enabled ?? false);
  const [featuresMax, setFeaturesMax] = useState(retry.features?.maxRetries ?? 2);
  const [phasesEnabled, setPhasesEnabled] = useState(retry.phases?.enabled ?? false);
  const [phasesMax, setPhasesMax] = useState(retry.phases?.maxRetries ?? 2);

  // 6 rows: 3 toggles + 3 maxRetries editors. cursor 0-5.
  const [cursor, setCursor] = useState(0);
  // editing = which maxRetries row is being adjusted (1/2/3), 0 = none
  const [editing, setEditing] = useState(0);

  const states = [tasksEnabled, featuresEnabled, phasesEnabled];
  const maxes = [tasksMax, featuresMax, phasesMax];
  const maxSetters = [setTasksMax, setFeaturesMax, setPhasesMax];

  useInput((input, key) => {
    if (key.escape) {
      if (editing) { setEditing(0); return; }
      navigate.pop();
      return;
    }
    if (editing) {
      // Editing maxRetries for row `editing` (1-3)
      if (key.upArrow || input === '+') {
        maxSetters[editing - 1](m => m + 1);
      }
      if (key.downArrow || input === '-') {
        maxSetters[editing - 1](m => Math.max(1, m - 1));
      }
      if (key.return) {
        const path = `retry.${LEVELS[editing - 1].key}.maxRetries`;
        const val = maxes[editing - 1];
        setConfig(targetDir, path, val);
        showToast(`${LEVELS[editing - 1].label} maxRetries = ${val}`, 'success');
        setEditing(0);
      }
      return;
    }
    // Navigate 6 rows (3 toggle + 3 max)
    if (key.upArrow) setCursor(c => (c > 0 ? c - 1 : 5));
    if (key.downArrow) setCursor(c => (c < 5 ? c + 1 : 0));
    if (key.return) {
      // Rows 0-2 = toggle, rows 3-5 = edit maxRetries
      if (cursor < 3) {
        // Toggle
        const lvl = LEVELS[cursor];
        const setters = [setTasksEnabled, setFeaturesEnabled, setPhasesEnabled];
        const newVal = !states[cursor];
        setters[cursor](newVal);
        setConfig(targetDir, `retry.${lvl.key}.enabled`, newVal);
        showToast(`${lvl.label} ${newVal ? 'enabled' : 'disabled'}`, 'success');
      } else {
        // Edit maxRetries
        setEditing(cursor - 2); // rows 3,4,5 → editing 1,2,3
      }
    }
  });

  const renderRow = (idx) => {
    const lvl = LEVELS[idx];
    const enabled = states[idx];
    const max = maxes[idx];
    const isToggleRow = idx === cursor;
    const isMaxRow = (idx + 3) === cursor;
    const isEditing = editing === idx + 1;
    return h(Box, { key: lvl.key, flexDirection: 'column', marginTop: 1 },
      h(Box, null,
        h(Text, { color: isToggleRow ? 'cyan' : undefined, bold: isToggleRow },
          isToggleRow ? '❯ ' : '  '),
        h(Text, { bold: isToggleRow, color: isToggleRow ? 'cyan' : undefined },
          `${lvl.label} `),
        h(Text, { color: enabled ? 'green' : 'gray' }, enabled ? '[ON]' : '[off]'),
        h(Text, { dimColor: true }, '  [Enter] toggle'),
      ),
      h(Text, { dimColor: true }, `   ${lvl.desc}`),
      h(Box, { marginTop: 0 },
        h(Text, { color: isMaxRow ? 'cyan' : undefined, bold: isMaxRow },
          isMaxRow ? '❯ ' : '  '),
        h(Text, null, `   maxRetries: `),
        h(Text, { color: 'cyan', bold: true }, `${max}`),
        isEditing
          ? h(Text, { dimColor: true }, '  [↑↓] adjust  [Enter] save  [Esc] cancel')
          : h(Text, { dimColor: true }, '  [Enter] edit'),
      ),
    );
  };

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Retry Configuration (3-level) ══╗'),
    h(Text, { dimColor: true, marginTop: 0 }, 'Escalation chain: task → feature → phase → human'),
    renderRow(0),
    renderRow(1),
    renderRow(2),
    h(StatusBar, { keys: [
      { key: '↑↓', label: 'navigate' },
      { key: 'Enter', label: 'toggle/edit' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

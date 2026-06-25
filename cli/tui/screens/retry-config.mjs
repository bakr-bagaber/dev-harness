/** retry-config — 3-level retry configuration overlay (v3.1.0+).
 *  Mirrors `config set retry.*` for tasks/features/phases enabled + maxRetries. */
import { useState, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { Toggle } from '../components/Toggle.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getConfig, setConfig } from '../actions.mjs';
import { showToast } from '../screens.mjs';

const LEVELS = [
  { key: 'tasks',    label: 'Task retry',    desc: 'Per-task retry (feature-iterate phases)' },
  { key: 'features', label: 'Feature retry', desc: 'Reset feature tasks + re-sweep on task exhaustion' },
  { key: 'phases',   label: 'Phase retry',   desc: 'Reset all features + re-run phase on feature exhaustion' },
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

  // Which maxRetries field is being edited (1/2/3 for tasks/features/phases)
  const [editing, setEditing] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      if (editing) { setEditing(0); return; }
      navigate.pop();
      return;
    }
    if (editing) {
      if (input === '↑' || input === '+') {
        const setter = editing === 1 ? setTasksMax : editing === 2 ? setFeaturesMax : setPhasesMax;
        setter(m => m + 1);
      }
      if (input === '↓' || input === '-') {
        const setter = editing === 1 ? setTasksMax : editing === 2 ? setFeaturesMax : setPhasesMax;
        setter(m => Math.max(1, m - 1));
      }
      if (key.return) {
        const path = editing === 1 ? 'retry.tasks.maxRetries' : editing === 2 ? 'retry.features.maxRetries' : 'retry.phases.maxRetries';
        const val = editing === 1 ? tasksMax : editing === 2 ? featuresMax : phasesMax;
        setConfig(targetDir, path, val);
        showToast(`${LEVELS[editing - 1].label} maxRetries = ${val}`, 'success');
        setEditing(0);
      }
      return;
    }
    // Toggle keys: 1=tasks, 2=features, 3=phases
    if (input === '1') {
      const val = !tasksEnabled;
      setTasksEnabled(val);
      setConfig(targetDir, 'retry.tasks.enabled', val);
      showToast(`Task retry ${val ? 'enabled' : 'disabled'}`, 'success');
    }
    if (input === '2') {
      const val = !featuresEnabled;
      setFeaturesEnabled(val);
      setConfig(targetDir, 'retry.features.enabled', val);
      showToast(`Feature retry ${val ? 'enabled' : 'disabled'}`, 'success');
    }
    if (input === '3') {
      const val = !phasesEnabled;
      setPhasesEnabled(val);
      setConfig(targetDir, 'retry.phases.enabled', val);
      showToast(`Phase retry ${val ? 'enabled' : 'disabled'}`, 'success');
    }
    // Edit maxRetries: a/b/c
    if (input === 'a') setEditing(1);
    if (input === 'b') setEditing(2);
    if (input === 'c') setEditing(3);
  });

  const renderRow = (idx) => {
    const lvl = LEVELS[idx];
    const enabled = idx === 0 ? tasksEnabled : idx === 1 ? featuresEnabled : phasesEnabled;
    const max = idx === 0 ? tasksMax : idx === 1 ? featuresMax : phasesMax;
    const editKey = idx === 0 ? 'a' : idx === 1 ? 'b' : 'c';
    const isEditing = editing === idx + 1;
    return h(Box, { key: lvl.key, flexDirection: 'column', marginTop: 1 },
      h(Box, null,
        h(Text, { bold: true }, `${idx + 1}. ${lvl.label} `),
        h(Text, { color: enabled ? 'green' : 'gray' }, enabled ? '[ON]' : '[off]'),
        h(Text, { dimColor: true }, `  (${idx + 1} to toggle)`),
      ),
      h(Text, { dimColor: true }, `   ${lvl.desc}`),
      h(Box, { marginTop: 0 },
        h(Text, null, `   maxRetries: `),
        h(Text, { color: 'cyan', bold: true }, `${max}`),
        isEditing
          ? h(Text, { dimColor: true }, '  [↑↓] adjust  [Enter] save  [Esc] cancel')
          : h(Text, { dimColor: true }, `  [${editKey}] edit`),
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
      { key: '1/2/3', label: 'toggle' },
      { key: 'a/b/c', label: 'edit max' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

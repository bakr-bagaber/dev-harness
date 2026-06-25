/** gate-config — Gate configuration overlay. */
import { useState, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { Toggle } from '../components/Toggle.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getConfig, setConfig } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function GateConfigScreen({ targetDir, navigate }) {
  const cfg = getConfig(targetDir);
  const [enabled, setEnabled] = useState(cfg.ok ? cfg.data.gates?.enabled : false);
  const [coverageEnabled, setCoverageEnabled] = useState(cfg.ok ? cfg.data.gates?.coverage?.enabled : false);
  const [threshold, setThreshold] = useState(cfg.ok ? cfg.data.gates?.coverage?.threshold : 80);
  const [editingThreshold, setEditingThreshold] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      if (editingThreshold) { setEditingThreshold(false); return; }
      navigate.pop();
      return;
    }
    if (editingThreshold) {
      if (key.upArrow || input === '+') setThreshold(t => Math.min(100, t + 5));
      if (key.downArrow || input === '-') setThreshold(t => Math.max(0, t - 5));
      if (key.return) {
        setConfig(targetDir, 'gates.coverage.threshold', threshold);
        setEditingThreshold(false);
        showToast(`Threshold set to ${threshold}%`, 'success');
      }
    } else {
      // Enter to edit threshold (Toggle handles its own space/y/n)
      if (key.return) setEditingThreshold(true);
    }
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Gate Configuration ══╗'),
    h(Box, { marginTop: 1 },
      h(Toggle, {
        value: enabled, onChange: (val) => {
          setEnabled(val);
          setConfig(targetDir, 'gates.enabled', val);
          showToast(`Gates ${val ? 'enabled' : 'disabled'}`, 'success');
        },
        label: 'Gate validation',
        onText: 'Enabled', offText: 'Disabled',
      }),
    ),
    h(Box, { marginTop: 1 },
      h(Toggle, {
        value: coverageEnabled, onChange: (val) => {
          setCoverageEnabled(val);
          setConfig(targetDir, 'gates.coverage.enabled', val);
          showToast(`Coverage gates ${val ? 'enabled' : 'disabled'}`, 'success');
        },
        label: 'Coverage gate',
        onText: 'Enabled', offText: 'Disabled',
      }),
    ),
    h(Box, { marginTop: 1 },
      h(Text, { bold: true }, 'Coverage threshold: '),
      h(Text, { color: 'cyan', bold: true }, `${threshold}%`),
      editingThreshold
        ? h(Text, { dimColor: true }, '  [↑↓] adjust  [Enter] save  [Esc] cancel')
        : h(Text, { dimColor: true }, '  [Enter] edit'),
    ),
    h(StatusBar, { keys: [{ key: 'Enter', label: 'edit threshold' }, { key: 'space', label: 'toggle' }, { key: 'Esc', label: 'back' }] }),
  );
}

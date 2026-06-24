/** gate-config — Gate configuration overlay. */
import { useState, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
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
    if (key.escape) navigate.pop();
    if (input === 't' && !editingThreshold) setEditingThreshold(true);
    if (editingThreshold) {
      if (input === '↑' || input === '+') setThreshold(t => Math.min(100, t + 5));
      if (input === '↓' || input === '-') setThreshold(t => Math.max(0, t - 5));
      if (key.return) {
        setConfig(targetDir, 'gates.coverage.threshold', threshold);
        setEditingThreshold(false);
        showToast(`Threshold set to ${threshold}%`, 'success');
      }
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
        ? h(Text, { dimColor: true }, '  [↑↓] adjust  [Enter] save')
        : h(Text, { dimColor: true }, '  [t] edit'),
    ),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

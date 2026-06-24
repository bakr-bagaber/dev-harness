/** tool-select — Agent tool selection screen. */
import { useState, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectList } from '../components/SelectList.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { selectTool, getAgentTools, detectAgentTools } from '../actions.mjs';
import { KNOWN_AGENT_TOOLS } from '../../lib/scaffold.mjs';
import { showToast } from '../screens.mjs';

export default function ToolSelectScreen({ targetDir, navigate, detect }) {
  useInput((input, key) => {
    if (key.escape) navigate.pop();
  });

  const toolsResult = getAgentTools();
  const registry = toolsResult.data;
  const detected = detect ? detectAgentTools(targetDir) : null;

  const items = KNOWN_AGENT_TOOLS.map(t => {
    const entry = registry[t];
    const isDetected = detected?.data?.detected?.includes(t);
    return {
      label: entry?.label || t,
      description: [
        entry?.notes || entry?.description || '',
        isDetected ? '(detected)' : '',
      ].filter(Boolean).join(' '),
      value: t,
    };
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Agent Tool Selection ══╗'),
    detect && detected
      ? h(Text, { color: 'green' }, `Detected: ${detected.data.detected.join(', ') || 'none'}`)
      : null,
    h(SelectList, {
      items,
      onSelect: (item) => {
        const r = selectTool(targetDir, item.value);
        showToast(r.message, r.ok ? 'success' : 'error');
        if (r.ok) navigate.pop();
      },
      onCancel: () => navigate.pop(),
      title: 'Available tools:',
    }),
    h(StatusBar, { keys: [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: 'Esc', label: 'back' }] }),
  );
}

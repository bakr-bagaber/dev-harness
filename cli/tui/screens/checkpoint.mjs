/** checkpoint — Manual checkpoint creation. */
import { useState, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { TextInput } from '../components/TextInput.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { createCheckpoint } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function CheckpointScreen({ targetDir, navigate }) {
  const [label, setLabel] = useState('');

  useInput((input, key) => {
    if (key.escape) navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Create Checkpoint ══╗'),
    h(Text, { dimColor: true }, 'Creates a git tag (manual/<label>) for recovery'),
    h(Box, { marginTop: 1 },
      h(TextInput, {
        value: label, onChange: setLabel,
        onSubmit: async () => {
          if (!label) { showToast('Label required', 'error'); return; }
          const r = await createCheckpoint(targetDir, label);
          showToast(r.message, r.ok ? 'success' : 'error');
          if (r.ok) navigate.pop();
        },
        onCancel: () => navigate.pop(),
        placeholder: 'before-refactor',
        label: 'Label',
      }),
    ),
    h(StatusBar, { keys: [{ key: 'Enter', label: 'create' }, { key: 'Esc', label: 'cancel' }] }),
  );
}

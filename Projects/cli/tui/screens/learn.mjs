/** learn — Append a lesson to progress.md (inline input). */
import { useState, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { TextInput } from '../components/TextInput.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { addLesson } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function LearnScreen({ targetDir, navigate }) {
  const [text, setText] = useState('');

  useInput((input, key) => {
    if (key.escape) navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Add Lesson ══╗'),
    h(Text, { dimColor: true }, 'Record a learning for future sessions'),
    h(Box, { marginTop: 1 },
      h(TextInput, {
        value: text, onChange: setText,
        onSubmit: () => {
          if (!text) { showToast('Lesson text required', 'error'); return; }
          const r = addLesson(targetDir, text);
          showToast(r.message, r.ok ? 'success' : 'error');
          if (r.ok) navigate.pop();
        },
        onCancel: () => navigate.pop(),
        placeholder: 'Token refresh gotcha — accepts access_token in body',
        label: 'Lesson',
      }),
    ),
    h(StatusBar, { keys: [{ key: 'Enter', label: 'save' }, { key: 'Esc', label: 'cancel' }] }),
  );
}

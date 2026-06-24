/** progress — View progress.md (session state + history). */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getProgressText } from '../actions.mjs';

export default function ProgressScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const r = getProgressText(targetDir);
    setContent(r.ok ? r.data : 'No progress.md found.');
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'P') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Progress ══╗'),
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

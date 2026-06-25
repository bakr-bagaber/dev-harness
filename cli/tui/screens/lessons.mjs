/** lessons — View all lessons from progress.md. */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getLessons } from '../actions.mjs';

export default function LessonsScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const r = getLessons(targetDir);
    if (!r.ok || r.data.length === 0) {
      setContent('No lessons recorded yet.\n\nPress l from dashboard to add a lesson.');
    } else {
      setContent(r.data.map(l => `${l.date} | ${l.author || 'agent'}\n  ${l.text}`).join('\n\n'));
    }
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Lessons ══╗'),
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

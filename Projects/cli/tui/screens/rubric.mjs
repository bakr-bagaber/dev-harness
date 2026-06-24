/** rubric — View evaluator rubric. */
import { useState, useEffect, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getRubric } from '../actions.mjs';

export default function RubricScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const r = getRubric(targetDir);
    setContent(r.ok ? r.data : 'No evaluator-rubric.md found.');
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'E') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Evaluator Rubric ══╗'),
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

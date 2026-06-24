/** gate-history — View gate pass/fail history. */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getGateHistory } from '../actions.mjs';

export default function GateHistoryScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const r = getGateHistory(targetDir);
    if (!r.ok || !r.data || r.data.length === 0) {
      setContent('No gate history yet.\n\nGate results are recorded when validation runs.');
    } else {
      setContent(r.data.map(g =>
        `${g.timestamp || g.date || '—'} | ${g.phase || '?'} | ${g.overall ? 'PASS' : 'FAIL'} | ${g.checks?.length || 0} checks`
      ).join('\n'));
    }
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'H') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Gate History ══╗'),
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

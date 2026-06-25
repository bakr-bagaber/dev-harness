/** feature-list — View features and tasks with status. */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getFeatureList } from '../actions.mjs';
import { Badge } from '../components/Badge.mjs';

export default function FeatureListScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const r = getFeatureList(targetDir);
    if (!r.ok) {
      setContent('No feature list found.\n\nFeatures are created during DEFINE phase.');
      return;
    }
    const fl = r.data;
    if (!fl.features || fl.features.length === 0) {
      setContent('No features defined yet.\n\nDefine features during DEFINE phase.');
      return;
    }
    let out = '';
    for (const feat of fl.features) {
      const status = feat.passes ? '✓' : '●';
      out += `${status} ${feat.name} (${feat.id})\n`;
      if (feat.tasks) {
        for (const task of feat.tasks) {
          const taskStatus = task.status === 'complete' ? '✓' : '○';
          out += `  ${taskStatus} ${task.id}: ${task.description || ''}\n`;
        }
      }
      out += '\n';
    }
    setContent(out);
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Feature List ══╗'),
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

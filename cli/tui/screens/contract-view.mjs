/** contract-view — Read-only sprint contract viewer. */
import { useState, useEffect, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { readContractText, getContract } from '../actions.mjs';
import { Badge } from '../components/Badge.mjs';

export default function ContractViewScreen({ targetDir, navigate }) {
  const [text, setText] = useState('Loading...');
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const r = readContractText(targetDir);
    setText(r.ok ? r.data : 'No sprint-contract.md found');
    const s = getContract(targetDir);
    if (s.ok) setStatus(s.data);
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 'C') navigate.pop();
  });

  return h(Box, { flexDirection: 'column' },
    h(Box, null,
      h(Text, { bold: true }, 'Sprint Contract'),
      status ? h(Badge, { status: status.status === 'agreed' ? 'pass' : 'pending', text: status.status }) : null,
      status ? h(Text, { dimColor: true }, ` Round ${status.rounds}/5`) : null,
    ),
    h(ScrollView, { content: text, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
  );
}

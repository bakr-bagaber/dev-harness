/** worktree — Git worktree manager (create/list/prune/remove). */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { TextInput } from '../components/TextInput.mjs';
import { ConfirmDialog } from '../components/ConfirmDialog.mjs';
import { listWorktrees, createWorktree, pruneWorktrees, removeWorktree } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function WorktreeScreen({ targetDir, navigate }) {
  const [worktrees, setWorktrees] = useState([]);
  const [mode, setMode] = useState('list');
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const r = await listWorktrees(targetDir);
      setWorktrees(r.ok ? r.data : []);
      setCursor(0);
    })();
  }, [targetDir, tick]);

  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'list') navigate.pop();
      else setMode('list');
      return;
    }
    if (mode === 'list') {
      if (input === 'c') setMode('create');
      if (input === 'p') setMode('prune');
      if (key.upArrow) setCursor(c => Math.max(0, c - 1));
      if (key.downArrow) setCursor(c => Math.max(0, Math.min(worktrees.length - 1, c + 1)));
      if (input === 'x') {
        const sel = worktrees[cursor];
        if (sel) setRemoving(sel.path || sel.branch);
      }
    }
  });

  if (mode === 'create') {
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true }, 'Create Worktree:'),
      h(TextInput, {
        value: name, onChange: setName,
        onSubmit: async () => {
          const r = await createWorktree(targetDir, name);
          showToast(r.message, r.ok ? 'success' : 'error');
          if (r.ok) { setName(''); setMode('list'); setTick(t => t + 1); }
        },
        onCancel: () => setMode('list'),
        placeholder: 'feature-name',
        label: 'Name',
      }),
      h(Text, { dimColor: true }, '[Enter] create  [Esc] cancel'),
    );
  }

  if (mode === 'prune') {
    return h(ConfirmDialog, {
      message: 'Prune orphaned worktree metadata?',
      onConfirm: async () => {
        const r = await pruneWorktrees(targetDir);
        showToast(r.message, r.ok ? 'success' : 'error');
        setMode('list'); setTick(t => t + 1);
      },
      onCancel: () => setMode('list'),
    });
  }

  if (removing) {
    return h(ConfirmDialog, {
      message: `Remove worktree "${removing}"?`,
      onConfirm: async () => {
        const r = await removeWorktree(targetDir, removing);
        showToast(r.message, r.ok ? 'success' : 'error');
        setRemoving(null); setTick(t => t + 1);
      },
      onCancel: () => setRemoving(null),
    });
  }

  const content = worktrees.length === 0
    ? 'No worktrees found.'
    : worktrees.map((w, i) => {
        const marker = i === cursor ? '▶ ' : '  ';
        return `${marker}${w.path}\n  Branch: ${w.branch}\n  Hash: ${w.hash}`;
      }).join('\n\n');

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Worktree Manager ══╗'),
    h(ScrollView, { content, height: 12 }),
    h(StatusBar, { keys: [
      { key: 'c', label: 'create' },
      { key: 'x', label: 'remove' },
      { key: 'p', label: 'prune' },
      { key: '↑↓', label: 'select' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

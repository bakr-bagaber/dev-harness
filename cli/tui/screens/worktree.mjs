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
      // Action menu: ↑↓ navigate worktrees, number keys for actions
      if (key.upArrow) setCursor(c => Math.max(0, c - 1));
      if (key.downArrow) setCursor(c => Math.max(0, Math.min(worktrees.length - 1, c + 1)));
      if (input === '1') setMode('create');
      if (input === '2') setMode('prune');
      if (input === '3' && worktrees.length > 0) {
        const sel = worktrees[cursor];
        if (sel) setRemoving(sel.path || sel.branch);
      }
    }
  });

  // List mode with action menu at bottom
  if (mode === 'list') {
    const content = worktrees.length === 0
      ? 'No worktrees found.'
      : worktrees.map((w, i) => {
          const marker = i === cursor ? '▶ ' : '  ';
          return `${marker}${w.path}\n  Branch: ${w.branch}\n  Hash: ${w.hash}`;
        }).join('\n\n');

    const listActions = [
      { label: 'Create worktree', mode: 'create' },
      { label: 'Prune orphaned worktrees', mode: 'prune' },
      { label: worktrees.length > 0 ? `Remove worktree "${worktrees[cursor]?.path || ''}"` : null, mode: 'remove' },
    ].filter(a => a.label !== null);

    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true }, '╔══ Worktree Manager ══╗'),
      h(ScrollView, { content, height: 10 }),
      h(Box, { marginTop: 1, flexDirection: 'column' },
        h(Text, { bold: true, dimColor: true }, 'Actions — ↑↓ select worktree, then choose:'),
        h(Box, null,
          h(Text, { color: 'cyan' }, '[1]'), h(Text, null, ' Create   '),
          h(Text, { color: 'cyan' }, '[2]'), h(Text, null, ' Prune   '),
          h(Text, { color: 'cyan' }, '[3]'), h(Text, null, worktrees.length > 0 ? ' Remove selected' : ''),
        ),
      ),
      h(StatusBar, { keys: [
        { key: '↑↓', label: 'select' },
        { key: '1', label: 'create' },
        { key: '2', label: 'prune' },
        { key: '3', label: 'remove' },
        { key: 'Esc', label: 'back' },
      ] }),
    );
  }

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

  return null; // list mode handled above
}

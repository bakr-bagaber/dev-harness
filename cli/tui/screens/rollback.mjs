/** rollback — Checkpoint recovery manager (list/to/branch). */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { ConfirmDialog } from '../components/ConfirmDialog.mjs';
import { listCheckpoints, rollbackTo, rollbackBranch } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function RollbackScreen({ targetDir, navigate }) {
  const [checkpoints, setCheckpoints] = useState([]);
  const [confirming, setConfirming] = useState(null);
  const [cursor, setCursor] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const r = await listCheckpoints(targetDir);
      setCheckpoints(r.ok ? r.data : []);
      setCursor(0);
    })();
  }, [targetDir, tick]);

  useInput((input, key) => {
    if (key.escape) {
      if (confirming) setConfirming(null);
      else navigate.pop();
      return;
    }
    if (confirming) return; // ConfirmDialog handles its own keys
    if (checkpoints.length === 0) return;
    if (key.upArrow) setCursor(c => Math.max(0, c - 1));
    if (key.downArrow) setCursor(c => Math.min(checkpoints.length - 1, c + 1));
    // Enter → restore (default action); Shift+Enter or separate menu for branch
    // Use simple action menu: 1=restore, 2=branch
    if (input === '1') {
      const sel = checkpoints[cursor];
      if (sel) setConfirming({ action: 'to', ref: sel.ref });
    }
    if (input === '2') {
      const sel = checkpoints[cursor];
      if (sel) setConfirming({ action: 'branch', ref: sel.ref });
    }
  });

  if (confirming) {
    return h(ConfirmDialog, {
      message: confirming.action === 'to'
        ? `Restore working tree to "${confirming.ref}"?\nThis will stash uncommitted changes.`
        : `Create recovery branch from "${confirming.ref}"?`,
      onConfirm: async () => {
        const r = confirming.action === 'to'
          ? await rollbackTo(targetDir, confirming.ref)
          : await rollbackBranch(targetDir, confirming.ref);
        showToast(r.message, r.ok ? 'success' : 'error');
        setConfirming(null);
        setTick(t => t + 1);
      },
      onCancel: () => setConfirming(null),
    });
  }

  const content = checkpoints.length === 0
    ? 'No checkpoints found.\n\nCheckpoints are created automatically when auto-tagging is enabled,\nor manually with: dev-harness checkpoint create <label>'
    : checkpoints.map((c, i) => {
        const marker = i === cursor ? '▶ ' : '  ';
        return `${marker}${c.ref}\n  Type: ${c.type}  Date: ${c.date}  Hash: ${c.hash}`;
      }).join('\n\n');

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Rollback Manager ══╗'),
    h(ScrollView, { content, height: 12 }),
    checkpoints.length > 0
      ? h(Text, { dimColor: true }, `[↑↓] select  [t] restore  [b] branch`)
      : null,
    h(StatusBar, { keys: [
      { key: '↑↓', label: 'select' },
      { key: '1', label: 'restore' },
      { key: '2', label: 'branch' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

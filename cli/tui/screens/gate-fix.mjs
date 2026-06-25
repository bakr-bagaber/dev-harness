/**
 * gate-fix — Gate failure fix flow screen.
 *
 * Shows each failing gate check with its detail message and
 * an actionable fix button. Maps check names to TUI actions.
 *
 * Replaces: manual `dev-harness validate` failure handling
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { Badge } from '../components/Badge.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { TextInput } from '../components/TextInput.mjs';
import { ConfirmDialog } from '../components/ConfirmDialog.mjs';
import { runValidation, createFeatureBranch } from '../actions.mjs';
import { showToast } from '../screens.mjs';

// Map check names to fix actions
const FIX_ACTIONS = {
  'feature-branch': { key: 'b', label: 'Create feature branch', action: 'create-branch' },
  'contract-agreed': { key: 'c', label: 'Negotiate contract', action: 'open-contract' },
  'git-clean': { key: 's', label: 'Show git status', action: 'show-git-status' },
  'lint': { key: 'l', label: 'Fix linting errors', action: 'show-guidance' },
  'tests': { key: 't', label: 'Fix failing tests', action: 'show-guidance' },
  'coverage': { key: 'c', label: 'Add tests', action: 'show-guidance' },
  'rubric-exists': { key: 'i', label: 'Run init to scaffold', action: 'show-guidance' },
  'readme-exists': { key: 'r', label: 'Create README.md', action: 'show-guidance' },
  'branch-up-to-date': { key: 'p', label: 'Push to upstream', action: 'show-guidance' },
  'tagged': { key: 'T', label: 'Create tag', action: 'show-guidance' },
  'changelog': { key: 'h', label: 'Create CHANGELOG.md', action: 'show-guidance' },
};

export default function GateFixScreen({ targetDir, navigate, phase }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [branchName, setBranchName] = useState('');
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [tick, setTick] = useState(0);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await runValidation(targetDir, phase);
      setResult(r);
      setLoading(false);
    })();
  }, [targetDir, phase, tick]);

  // Build action menu from failing checks + re-validate
  const buildActions = () => {
    const actions = [];
    if (result?.data?.failures) {
      for (const failName of result.data.failures) {
        const fix = FIX_ACTIONS[failName];
        if (fix) {
          actions.push({ label: fix.label, failName, fix });
        }
      }
    }
    actions.push({ label: 'Re-validate gates', isRevalidate: true });
    return actions;
  };

  const actions = buildActions();

  useInput(async (input, key) => {
    if (key.escape) { navigate.pop(); return; }
    if (creatingBranch) return;
    if (key.upArrow) setCursor(c => (c > 0 ? c - 1 : actions.length - 1));
    if (key.downArrow) setCursor(c => (c < actions.length - 1 ? c + 1 : 0));
    if (key.return) {
      const sel = actions[cursor];
      if (!sel) return;
      if (sel.isRevalidate) { setTick(t => t + 1); setCursor(0); return; }
      const { fix, failName } = sel;
      if (fix.action === 'create-branch') { setCreatingBranch(true); return; }
      if (fix.action === 'open-contract') { navigate.push('contract'); return; }
      if (fix.action === 'show-git-status') {
        showToast('Fix: commit or stash changes — run `git status` then `git add` + `git commit`, or `git stash`', 'info');
        return;
      }
      if (fix.action === 'show-guidance') {
        const guidance = failName === 'lint'
          ? 'Fix linting: run your linter (e.g. `npm run lint`), resolve reported errors, then re-validate'
          : 'Fix tests: run your test suite (e.g. `npm test`), fix failing tests, then re-validate';
        showToast(guidance, 'info');
        return;
      }
    }
  });

  // Branch creation mode
  if (creatingBranch) {
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true }, 'Create feature branch:'),
      h(TextInput, {
        value: branchName,
        onChange: setBranchName,
        onSubmit: async () => {
          const r = await createFeatureBranch(targetDir, branchName || 'feat/define');
          showToast(r.message, r.ok ? 'success' : 'error');
          setCreatingBranch(false);
          setBranchName('');
          setTick(t => t + 1);
        },
        onCancel: () => setCreatingBranch(false),
        placeholder: 'feat/define',
        label: 'Branch name',
      }),
      h(Text, { dimColor: true }, '[Enter] create  [Esc] cancel'),
    );
  }

  if (loading) {
    return h(Text, { dimColor: true }, 'Running validation...');
  }

  if (!result) {
    return h(Text, { color: 'red' }, 'Failed to run validation');
  }

  // Gates disabled
  if (!result.ok && result.message.includes('Gates disabled')) {
    return h(Box, { flexDirection: 'column' },
      h(Text, { color: 'yellow' }, '⚠ Gates are disabled'),
      h(Text, null, 'Enable gates to validate: press g from dashboard'),
      h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
    );
  }

  // All gates pass
  if (result.ok) {
    return h(Box, { flexDirection: 'column' },
      h(Badge, { status: 'pass' }),
      h(Text, { color: 'green' }, result.message),
      h(Text, { dimColor: true, marginTop: 1 }, 'Select "Advance" from dashboard to go to next phase'),
      h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }] }),
    );
  }

  // Show failures with fix actions (menu-driven)
  const checks = result.data?.checks || [];
  const failures = checks.filter(c => !c.pass);

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true, color: 'red' }, `╔══ Gate Failures — ${phase?.toUpperCase() || 'CURRENT'} ══╗`),
    h(Text, { color: 'red' }, result.message),
    h(Box, { flexDirection: 'column', marginTop: 1 },
      failures.map((check, i) => {
        return h(Box, { key: i, flexDirection: 'column', marginBottom: 1 },
          h(Text, null,
            h(Text, { color: 'red', bold: true }, '✗ '),
            h(Text, { bold: true }, check.name),
          ),
          h(Text, { dimColor: true }, `  ${check.detail}`),
        );
      }),
    ),
    // Action menu
    h(Box, { flexDirection: 'column', marginTop: 1 },
      h(Text, { bold: true, dimColor: true }, 'Actions — ↑↓ navigate, Enter select'),
      actions.map((act, i) =>
        h(Box, { key: i },
          h(Text, { color: i === cursor ? 'cyan' : undefined, bold: i === cursor },
            i === cursor ? '❯ ' : '  '),
          h(Text, { bold: i === cursor, color: i === cursor ? 'cyan' : undefined },
            act.isRevalidate ? '↻ ' : '🔧 '),
          h(Text, { bold: i === cursor, color: i === cursor ? 'cyan' : undefined },
            act.label),
        ),
      ),
    ),
    h(StatusBar, { keys: [
      { key: '↑↓', label: 'navigate' },
      { key: 'Enter', label: 'select' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

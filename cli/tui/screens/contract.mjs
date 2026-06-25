/**
 * contract — Sprint contract negotiation screen.
 *
 * Inline form for proposing a contract, then review (agree/revise/escalate).
 * Shows round counter and escalation warnings.
 *
 * Replaces: `dev-harness contract propose/review/escalate`
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { MultiLineInput } from '../components/MultiLineInput.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { TextInput } from '../components/TextInput.mjs';
import {
  getContract, proposeSprintContract, reviewSprintContract, escalateSprintContract,
} from '../actions.mjs';
import { showToast } from '../screens.mjs';

const MODES = { form: 'form', review: 'review', escalate: 'escalate' };
const REVIEW_ACTIONS = [
  { label: 'Agree — contract accepted', action: 'agree' },
  { label: 'Needs revision — back to form', action: 'revise' },
  { label: 'Escalate — human adjudication', action: 'escalate' },
];

export default function ContractScreen({ targetDir, navigate }) {
  const [mode, setMode] = useState(MODES.form);
  const [scope, setScope] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [reviewCursor, setReviewCursor] = useState(0);
  const [contractStatus, setContractStatus] = useState(null);
  const [escalateReason, setEscalateReason] = useState('');

  // Load current contract status on mount
  useEffect(() => {
    const r = getContract(targetDir);
    if (r.ok) setContractStatus(r.data);
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape) {
      if (mode === MODES.form) navigate.pop();
      else if (mode === MODES.escalate) setMode(MODES.review);
      else setMode(MODES.form);
      return;
    }
    // Review mode: ↑↓ navigate, Enter select action
    if (mode === MODES.review) {
      if (key.upArrow) setReviewCursor(c => (c > 0 ? c - 1 : REVIEW_ACTIONS.length - 1));
      if (key.downArrow) setReviewCursor(c => (c < REVIEW_ACTIONS.length - 1 ? c + 1 : 0));
      if (key.return) {
        const act = REVIEW_ACTIONS[reviewCursor];
        if (!act) return;
        if (act.action === 'agree') {
          const r = reviewSprintContract(targetDir, { agreed: true });
          showToast(r.ok ? 'Contract agreed' : r.message, r.ok ? 'success' : 'error');
          if (r.ok) navigate.pop();
        }
        if (act.action === 'revise') {
          const r = reviewSprintContract(targetDir, { needsRevision: true });
          showToast(r.ok ? 'Contract sent for revision' : r.message, r.ok ? 'warning' : 'error');
          if (r.ok) setMode(MODES.form);
        }
        if (act.action === 'escalate') {
          setMode(MODES.escalate);
        }
      }
    }
  });

  // ── Escalate mode ──────────────────────────────────────────────────────
  if (mode === MODES.escalate) {
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'red' }, '⚠ Escalate Contract to Human'),
      h(Text, { dimColor: true }, 'Provide a reason for escalation:'),
      h(TextInput, {
        value: escalateReason,
        onChange: setEscalateReason,
        onSubmit: () => {
          const r = escalateSprintContract(targetDir, escalateReason);
          showToast(r.message, r.ok ? 'warning' : 'error');
          navigate.pop();
        },
        onCancel: () => setMode(MODES.review),
        placeholder: 'Reason for escalation...',
        label: 'Reason',
      }),
      h(Text, { dimColor: true }, '[Enter] escalate  [Esc] back'),
    );
  }

  // ── Review mode (after propose) ────────────────────────────────────────
  if (mode === MODES.review) {
    const rounds = contractStatus?.rounds || 0;
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Sprint Contract — Review ══╗'),
      h(Text, null, `Round ${rounds}/5`),
      rounds >= 4
        ? h(Text, { color: 'red', bold: true }, '⚠ Warning: Next round will auto-escalate!')
        : null,
      h(Box, { marginTop: 2 },
        h(Text, { dimColor: true }, 'Review the contract in harness/sprint-contract.md'),
      ),
      h(Box, { marginTop: 2, flexDirection: 'column' },
        h(Text, { bold: true, dimColor: true }, '↑↓ navigate, Enter select'),
        REVIEW_ACTIONS.map((act, i) =>
          h(Box, { key: i },
            h(Text, { color: i === reviewCursor ? 'cyan' : undefined, bold: i === reviewCursor },
              i === reviewCursor ? '❯ ' : '  '),
            h(Text, {
              bold: i === reviewCursor,
              color: i === reviewCursor ? 'cyan' : (act.action === 'agree' ? 'green' : act.action === 'revise' ? 'yellow' : 'red'),
            }, act.label),
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

  // ── Form mode (propose) ────────────────────────────────────────────────
  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true, color: 'cyan' }, '╔══ Sprint Contract — Propose ══╗'),
    contractStatus?.status
      ? h(Text, { dimColor: true }, `Current: ${contractStatus.status} (round ${contractStatus.rounds}/5)`)
      : null,
    h(Box, { marginTop: 1 },
      h(MultiLineInput, {
        value: scope,
        onChange: setScope,
        onSubmit: () => {
          if (!scope) { showToast('Scope is required', 'error'); return; }
          const r = proposeSprintContract(targetDir, {
            scope,
            exclusions: exclusions || null,
          });
          if (r.ok) {
            showToast('Contract proposed', 'success');
            setMode(MODES.review);
          } else {
            showToast(r.message, 'error');
          }
        },
        onCancel: () => navigate.pop(),
        placeholder: 'I will build X, Y, Z...',
        label: 'Scope (what will be delivered)',
      }),
    ),
    h(Box, { marginTop: 1 },
      h(TextInput, {
        value: exclusions,
        onChange: setExclusions,
        placeholder: 'Out of scope: A, B...',
        label: 'Exclusions (optional)',
      }),
    ),
    h(StatusBar, { keys: [{ key: 'Enter', label: 'propose' }, { key: 'Esc', label: 'cancel' }] }),
  );
}

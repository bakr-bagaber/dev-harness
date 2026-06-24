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

export default function ContractScreen({ targetDir, navigate }) {
  const [mode, setMode] = useState(MODES.form);
  const [scope, setScope] = useState('');
  const [exclusions, setExclusions] = useState('');
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
      else setMode(MODES.form);
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
        h(Text, { color: 'green' }, '[a] Agree — contract accepted'),
        h(Text, { color: 'yellow' }, '[r] Needs revision — back to form'),
        h(Text, { color: 'red' }, '[e] Escalate — human adjudication'),
      ),
      h(StatusBar, { keys: [
        { key: 'a', label: 'agree' },
        { key: 'r', label: 'revise' },
        { key: 'e', label: 'escalate' },
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

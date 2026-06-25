/** advance — Advance-with-instructions screen.
 *
 *  Shown when user selects "Advance" from the dashboard menu.
 *  Calls advancePhase, displays the inner loop's task instructions in a
 *  ScrollView (so the user sees what to do), handles gate failures by
 *  redirecting to gate-fix, and shows phase-completion state.
 *
 *  Replaces the old dashboard `n` hotkey that only toasted a one-line message
 *  and discarded the instructions.
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { Badge } from '../components/Badge.mjs';
import { advancePhase, runValidation } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function AdvanceScreen({ targetDir, navigate }) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [gateResult, setGateResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // If gates enabled, check them first before advancing
      const preGate = await runValidation(targetDir);
      if (!preGate.ok && preGate.data && preGate.data.failures?.length > 0) {
        if (!cancelled) {
          setGateResult(preGate);
          setLoading(false);
        }
        return;
      }
      // Gates pass (or disabled) — advance
      const r = await advancePhase(targetDir);
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetDir]);

  useInput((input, key) => {
    if (loading) return;
    if (key.escape) { navigate.pop(); return; }
    if (key.return) {
      if (gateResult) {
        // Gate failure → go to gate-fix screen
        navigate.replace('gate-fix', { phase: gateResult.data?.phase });
        return;
      }
      if (result?.ok) {
        // Advance done → back to dashboard
        navigate.pop();
        return;
      }
      // Advance failed → back to dashboard
      navigate.pop();
      return;
    }
    if (input === 'q') { navigate.pop(); return; }
  });

  if (loading) {
    return h(Box, { flexDirection: 'column' },
      h(Text, { dimColor: true }, 'Advancing pipeline...'),
    );
  }

  // Gate failure — show failures, offer to fix
  if (gateResult) {
    return h(Box, { flexDirection: 'column' },
      h(Badge, { status: 'fail' }),
      h(Text, { color: 'red', bold: true }, '⚠ Gate check failed before advance'),
      h(Text, { dimColor: true }, `Phase: ${gateResult.data?.phase?.toUpperCase() || 'current'}`),
      h(Text, { dimColor: true }, `Failures: ${gateResult.data?.failures?.join(', ') || 'unknown'}`),
      h(Box, { marginTop: 1 },
        h(Text, { color: 'cyan' }, '[Enter]'),
        h(Text, null, ' go to gate-fix screen'),
      ),
      h(Text, { dimColor: true }, '[Esc] back to dashboard'),
    );
  }

  // Advance succeeded — show instructions
  if (result?.ok) {
    const instructions = result.data?.details?.instructions || '';
    const phase = result.data?.phase;
    const status = result.data?.status;
    const feature = result.data?.details?.featureName;
    const task = result.data?.details?.taskDescription;

    return h(Box, { flexDirection: 'column' },
      h(Badge, { status: 'pass' }),
      h(Text, { bold: true }, `${phase?.toUpperCase() || 'Phase'} started`),
      feature ? h(Text, { dimColor: true }, `Feature: ${feature}`) : null,
      task ? h(Text, { dimColor: true }, `Task: ${task}`) : null,
      h(Text, { dimColor: true }, `Status: ${status}`),
      instructions
        ? h(Box, { marginTop: 1, flexDirection: 'column' },
            h(Text, { bold: true }, '📋 Instructions:'),
            h(ScrollView, { content: instructions, height: 14 }),
          )
        : h(Text, { dimColor: true }, '(No specific instructions for this phase)'),
      h(Box, { marginTop: 1 },
        h(Text, { color: 'cyan' }, '[Enter]'),
        h(Text, null, ' back to dashboard'),
      ),
    );
  }

  // Advance failed
  return h(Box, { flexDirection: 'column' },
    h(Badge, { status: 'fail' }),
    h(Text, { color: 'red' }, result?.message || 'Advance failed'),
    h(Text, { dimColor: true, marginTop: 1 }, '[Enter/Esc] back to dashboard'),
  );
}

/**
 * setup — First-run setup wizard screen.
 *
 * Guides the user through project scaffolding:
 *   1. Stack selection (31 stacks + auto-detect + custom)
 *   2. Agent tool selection (Tier-1/Tier-2)
 *   3. Gate config (enable, coverage)
 *   4. Mode (copilot/autopilot)
 *   5. Review + scaffold
 *
 * Replaces: `dev-harness init`, `dev-harness config set`, `dev-harness select-tool`, `dev-harness set-mode`
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { SelectList } from '../components/SelectList.mjs';
import { Toggle } from '../components/Toggle.mjs';
import { ProgressBar } from '../components/ProgressBar.mjs';
import { ConfirmDialog } from '../components/ConfirmDialog.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import {
  getAvailableStacks, detectProjectStack, getAgentTools,
  scaffoldProject, createFeatureBranch,
} from '../actions.mjs';
import { KNOWN_AGENT_TOOLS } from '../../lib/scaffold.mjs';

const STEPS = ['stack', 'tool', 'gates', 'mode', 'review', 'scaffold'];

export default function SetupScreen({ targetDir, navigate }) {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState({
    stack: null, agentTool: null, enableGates: false, mode: 'copilot',
  });
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldResult, setScaffoldResult] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const stepName = STEPS[step];

  // Free-form key handling for steps that don't use SelectList.
  // (SelectList steps — stack/tool/mode — handle their own arrow/Enter/Esc.)
  // Unified navigation: Enter = toggle/next/confirm, Esc = back, q = quit.
  useInput((input, key) => {
    if (stepName === 'gates') {
      // Enter advances to next step (Toggle component handles its own Enter for toggle)
      // but we need a way to advance. Use downArrow/Enter when not focused on toggle.
      // Simpler: Enter on gates step = next (Toggle uses space/y/n for toggle).
      if (key.return) { setStep(3); return; }
      if (key.escape) { setStep(1); return; }
    } else if (stepName === 'review' && !confirming) {
      if (key.return) { setConfirming(true); return; }
      if (key.escape) { setStep(3); return; }
      if (input === 'q') { navigate.exit(); return; }
    } else if (stepName === 'scaffold' && scaffoldResult) {
      if (key.return) { navigate.replace('dashboard', { targetDir }); return; }
      if (input === 'q') { navigate.exit(); return; }
    }
  });

  // Kick off scaffolding as a side effect (not during render).
  useEffect(() => {
    if (stepName !== 'scaffold' || scaffolding) return;
    let cancelled = false;
    setScaffolding(true);
    (async () => {
      const result = await scaffoldProject(targetDir, choices);
      if (cancelled) return;
      setScaffoldResult(result);
      if (result.ok) {
        await createFeatureBranch(targetDir, 'feat/define');
      }
    })();
    return () => { cancelled = true; };
  }, [stepName]);

  // ── Step: Stack selection ──────────────────────────────────────────────
  if (stepName === 'stack') {
    const stacksResult = getAvailableStacks();
    const detected = detectProjectStack(targetDir);
    const stacks = stacksResult.data || [];
    const detectedIdx = detected.data?.name ? stacks.indexOf(detected.data.name) : -1;
    const items = stacks.map(s => ({
      label: s,
      description: s === detected.data?.name ? `(detected) ${detected.data.label}` : '',
      value: s,
    }));

    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Setup Wizard — Step 1/4: Stack ══╗'),
      h(Text, { dimColor: true }, 'Select your project stack (arrow keys, Enter to select):'),
      detected.data?.name && detected.data.name !== 'generic'
        ? h(Text, { color: 'green' }, `Auto-detected: ${detected.data.label}`)
        : null,
      h(SelectList, {
        items,
        initialCursor: detectedIdx >= 0 ? detectedIdx : 0,
        onSelect: (item) => {
          setChoices(c => ({ ...c, stack: item.value }));
          setStep(1);
        },
        onCancel: () => navigate.exit(),
        title: 'Available stacks:',
      }),
      h(StatusBar, { keys: [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: '/', label: 'search' }, { key: 'Esc', label: 'exit' }] }),
    );
  }

  // ── Step: Agent tool selection ─────────────────────────────────────────
  if (stepName === 'tool') {
    const toolsResult = getAgentTools();
    const registry = toolsResult.data;
    const items = KNOWN_AGENT_TOOLS.map(t => {
      const entry = registry[t];
      return {
        label: entry?.label || t,
        description: entry?.notes || entry?.description || '',
        value: t,
      };
    });

    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Setup Wizard — Step 2/4: Agent Tool ══╗'),
      h(Text, { dimColor: true }, 'Which coding agent will you use?'),
      h(SelectList, {
        items,
        onSelect: (item) => {
          setChoices(c => ({ ...c, agentTool: item.value }));
          setStep(2);
        },
        onCancel: () => setStep(0),
        title: 'Agent tools:',
      }),
      h(StatusBar, { keys: [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: 'Esc', label: 'back' }] }),
    );
  }

  // ── Step: Gate config ──────────────────────────────────────────────────
  if (stepName === 'gates') {
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Setup Wizard — Step 3/4: Gates ══╗'),
      h(Text, { dimColor: true }, 'Enable gate validation? Gates enforce quality checks before phase advancement.'),
      h(Box, { marginTop: 1 },
        h(Toggle, {
          value: choices.enableGates,
          onChange: (val) => setChoices(c => ({ ...c, enableGates: val })),
          label: 'Enable gates',
          onText: 'Enabled (recommended)',
          offText: 'Disabled',
        }),
      ),
      h(Box, { marginTop: 2 },
        h(Text, { bold: true }, 'Gates check: feature-branch, contract, lint, tests, coverage, docs'),
      ),
      h(Box, { marginTop: 2 },
        h(Text, { dimColor: true }, '[space] toggle gates  [Enter] next step  [Esc] back'),
      ),
      h(StatusBar, { keys: [{ key: 'space', label: 'toggle' }, { key: 'Enter', label: 'next' }, { key: 'Esc', label: 'back' }] }),
    );
  }

  // ── Step: Mode selection ───────────────────────────────────────────────
  if (stepName === 'mode') {
    const modes = [
      { label: 'Copilot (manual)', description: 'You run each phase manually, agent does the work', value: 'copilot' },
      { label: 'Autopilot (auto-advance)', description: 'Harness auto-advances after gates pass', value: 'autopilot' },
    ];

    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Setup Wizard — Step 4/4: Mode ══╗'),
      h(Text, { dimColor: true }, 'Choose execution mode:'),
      h(SelectList, {
        items: modes,
        onSelect: (item) => {
          setChoices(c => ({ ...c, mode: item.value }));
          setStep(4);
        },
        onCancel: () => setStep(2),
        searchable: false,
        title: 'Execution modes:',
      }),
      h(StatusBar, { keys: [{ key: '↑↓', label: 'navigate' }, { key: 'Enter', label: 'select' }, { key: 'Esc', label: 'back' }] }),
    );
  }

  // ── Step: Review + confirm ─────────────────────────────────────────────
  if (stepName === 'review') {
    if (confirming) {
      return h(ConfirmDialog, {
        message: `Scaffold project in ${targetDir}?\n  Stack: ${choices.stack}\n  Tool: ${choices.agentTool}\n  Gates: ${choices.enableGates ? 'enabled' : 'disabled'}\n  Mode: ${choices.mode}`,
        onConfirm: () => { setConfirming(false); setStep(5); },
        onCancel: () => setConfirming(false),
      });
    }

    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true, color: 'cyan' }, '╔══ Setup Wizard — Review ══╗'),
      h(Box, { flexDirection: 'column', marginTop: 1 },
        h(Text, null, h(Text, { bold: true }, 'Stack: '), choices.stack || '(not set)'),
        h(Text, null, h(Text, { bold: true }, 'Agent tool: '), choices.agentTool || '(not set)'),
        h(Text, null, h(Text, { bold: true }, 'Gates: '), choices.enableGates ? h(Text, { color: 'green' }, 'enabled') : 'disabled'),
        h(Text, null, h(Text, { bold: true }, 'Mode: '), choices.mode),
      ),
      h(Box, { marginTop: 2 },
        h(Text, { dimColor: true }, '[Enter] scaffold project  [Esc] back  [q] cancel'),
      ),
      h(StatusBar, { keys: [{ key: 'Enter', label: 'scaffold' }, { key: 'Esc', label: 'back' }, { key: 'q', label: 'cancel' }] }),
    );
  }

  // ── Step: Scaffold ─────────────────────────────────────────────────
  if (stepName === 'scaffold') {
    if (scaffoldResult) {
      return h(Box, { flexDirection: 'column' },
        h(Text, { bold: true, color: scaffoldResult.ok ? 'green' : 'yellow' },
          scaffoldResult.ok ? '✓ Project scaffolded!' : '⚠ Scaffold completed with warnings'),
        h(Text, null, scaffoldResult.message),
        scaffoldResult.data?.errors?.length > 0
          ? h(Box, { flexDirection: 'column', marginTop: 1 },
              h(Text, { color: 'red' }, 'Errors:'),
              ...scaffoldResult.data.errors.map((e, i) =>
                h(Text, { key: i, color: 'red' }, `  ✗ ${e}`)),
            )
          : null,
        h(Box, { marginTop: 2 },
          h(Text, { dimColor: true }, '[Enter] go to dashboard  [q] exit'),
        ),
      );
    }

    return h(Box, { flexDirection: 'column' },
      h(Text, { dimColor: true }, 'Scaffolding project...'),
      h(ProgressBar, { value: 0.5, label: 'Creating files...' }),
    );
  }

  return h(Text, { color: 'red' }, 'Unknown step');
}

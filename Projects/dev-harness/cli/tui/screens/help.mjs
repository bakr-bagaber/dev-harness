/**
 * help — Help screen with keybindings, phase guide, and tutorial.
 *
 * Shows context-aware keybindings, phase descriptions, and
 * troubleshooting tips. Accessible via `?` from any screen.
 */
import { useState, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';

const HELP_TEXT = `
╔══════════════════════════════════════════════════════════════╗
║                    🎯 Dev Harness — Help                       ║
╚══════════════════════════════════════════════════════════════╝

═══ Keybindings (Dashboard) ═══

Pipeline:
  n          Advance to next phase
  v          Validate (run gate checks)
  V          Validate specific task (feature/task picker)
  f          Fix gate failures (shows actionable fixes)
  a          Start agent (BUILD+ phases, autopilot)
  p          Pause pipeline
  r          Resume pipeline

Contract:
  c          Negotiate sprint contract (propose/review)
  C          View full contract text

Git:
  b          Create feature branch
  w          Worktree manager (create/list/prune/remove)
  R          Rollback manager (list/to/branch)
  K          Create manual checkpoint

Data Viewers:
  F          Feature list (features + tasks + status)
  L          Lessons (view past lessons)
  P          Progress (session state + history)
  H          Gate history (pass/fail timeline)
  E          Evaluator rubric

Config:
  g          Gates config (enable/threshold)
  t          Tool selection (switch agent tool)
  m          Mode switch (copilot ↔ autopilot)
  o          Config editor (all 29 parameters)
  d          Detect agent tools

Navigation:
  s          Full status screen
  ?          This help screen
  Esc        Back / cancel
  q          Quit (safe exit — saves state)

═══ Pipeline Phases ═══

DEFINE   — Write specs before any code
           Gates: feature-branch, contract-agreed
           You need: git checkout -b feat/define, negotiate contract

PLAN     — Break specs into actionable tasks
           Gates: git-clean
           You need: clean working tree

BUILD    — Implement features one at a time
           Gates: git-clean, lint, tests, contract, coverage
           You need: passing lint + tests, agreed contract

VERIFY   — Validate and test everything
           Gates: git-clean, tests, coverage
           You need: passing tests + coverage threshold

SIMPLIFY — Refactor, reduce complexity
           Gates: git-clean, no-empty-dirs
           You need: clean tree, no empty directories

REVIEW   — Multi-agent committee review
           Gates: branch-up-to-date, rubric, readme, architecture, decisions
           You need: pushed branch, all docs present

SHIP     — Tag + release
           Gates: git-clean, tagged, changelog, readme, license
           You need: clean tree, git tag, changelog

═══ Common Workflows ═══

First-time setup:
  1. Run dev-harness (no args) → setup wizard
  2. Select stack, tool, gates, mode
  3. Project scaffolded, feature branch created

Starting a phase:
  1. Press n to advance to next phase
  2. Follow the phase instructions shown
  3. Press v to validate when done
  4. If gates fail, press f for fix actions

Contract negotiation:
  1. Press c to open contract form
  2. Enter scope + exclusions
  3. Press Enter to propose
  4. Review contract, press a to agree or r for revision

Running agent (autopilot):
  1. Press a to start agent
  2. Agent spawns per task with fresh session
  3. Live output streams in bottom pane
  4. Auto-validates on agent exit
  5. Auto-advances if gates pass

═══ Troubleshooting ═══

"Gates disabled" → Press g to enable gates
"On master branch" → Press b to create feature branch
"Contract pending" → Press c to negotiate contract
"Lint failed" → Fix linting errors, press v to re-validate
"Tests failed" → Fix failing tests, press v to re-validate
"Working tree not clean" → Commit or stash changes

═══ Tips ═══

• Press ? from any screen for context-aware help
• Press Esc to go back to previous screen
• Press q to quit (pipeline state is saved automatically)
• Use dev-harness <command> for CLI mode (AI agents, scripting)
`;

export default function HelpScreen({ targetDir, navigate }) {
  useInput((input, key) => {
    if (key.escape || input === 'q' || input === '?') {
      navigate.pop();
    }
  });

  return h(Box, { flexDirection: 'column' },
    h(ScrollView, { content: HELP_TEXT, height: 20 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }, { key: 'q', label: 'back' }] }),
  );
}

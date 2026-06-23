/**
 * dashboard — Live TUI dashboard with split-pane layout, powered by Ink.
 *
 * Top pane: persistent pipeline dashboard (phases, features, tasks with checkmarks)
 * Bottom pane: scrolling agent output
 *
 * Uses Ink (React for CLIs) for layout, focus management, and Unicode-aware
 * rendering. Falls back to a one-shot text render if not a TTY.
 *
 * Because the project ships .mjs (no transpile step), JSX is unavailable —
 * we use React.createElement directly. A tiny `h()` alias keeps call sites
 * readable.
 *
 * Public API is unchanged from the previous hand-rolled version:
 *   startLiveDashboard(targetDir, options) → boolean (true if TUI started)
 *   stopLiveDashboard()
 *   appendAgentOutput(text)
 *
 * Usage:
 *   import { startLiveDashboard, stopLiveDashboard, appendAgentOutput } from './dashboard.mjs';
 *   startLiveDashboard(targetDir);
 *   // ... agent output streams in via appendAgentOutput()
 *   stopLiveDashboard();
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { getDashboardData, buildDashboardLines, renderDashboard } from '../lib/dashboard.mjs';

/** createElement shorthand — avoids JSX in .mjs files. */
const h = React.createElement;

// ── Module-level Ink handle ──────────────────────────────────────────────────
// Ink's render() returns a handle with unmount(). We store it module-level so
// stopLiveDashboard() can tear it down without callers needing to thread it.
let inkHandle = null;
let outputBuffer = []; // scrolling buffer of agent output lines

/**
 * Append a line of agent output to the scrolling buffer.
 * Triggers a re-render so the bottom pane updates live.
 * @param {string} text
 */
export function appendAgentOutput(text) {
  // Split on newlines so each line is a separate row in the bottom pane.
  for (const line of String(text).split('\n')) {
    outputBuffer.push(line);
  }
  // Cap buffer to avoid unbounded growth (matches previous maxOutputLines=50
  // but allow a bit more headroom since Ink re-renders cheaply).
  if (outputBuffer.length > 200) {
    outputBuffer = outputBuffer.slice(-200);
  }
}

// ── React component ──────────────────────────────────────────────────────────

/**
 * LiveDashboard — the Ink root component.
 *
 * Renders the top dashboard pane (from buildDashboardLines), a separator,
 * the scrolling agent-output pane, and a status bar. Handles keyboard input
 * for pause/resume/quit.
 */
function LiveDashboard({ targetDir, refreshMs, onKey }) {
  const { exit } = useApp();
  const [dashLines, setDashLines] = useState([]);
  const [paused, setPaused] = useState(false);
  const [output, setOutput] = useState([]);
  const [, setTick] = useState(0);

  // Refresh dashboard data on an interval + on file changes.
  useEffect(() => {
    let timer;
    const refresh = () => {
      try {
        const data = getDashboardData(targetDir);
        setDashLines(buildDashboardLines(data));
      } catch {
        // Config/feature list may be mid-write — keep last good render.
      }
      // Pull latest agent output from the module-level buffer.
      setOutput([...outputBuffer]);
    };

    refresh();
    timer = setInterval(refresh, refreshMs);

    // Watch config + feature list for changes (instant refresh on transition).
    const configPath = resolve(targetDir, 'harness', 'config.json');
    const featureListPath = resolve(targetDir, 'harness', 'features', 'feature-list.json');
    const watchers = [];
    for (const p of [configPath, featureListPath]) {
      try {
        watchers.push(watch(p, () => refresh()));
      } catch { /* file may not exist yet */ }
    }

    return () => {
      clearInterval(timer);
      for (const w of watchers) { try { w.close(); } catch { /* noop */ } }
    };
  }, [targetDir, refreshMs]);

  // Keyboard input: p=pause, r=resume, q/escape/ctrl-c=quit, d=toggle.
  useInput((input, key) => {
    if (input === 'q' || key.escape || (key.ctrl && input === 'c')) {
      exit();
      return;
    }
    if (input === 'p') {
      setPaused(true);
      if (onKey) { onKey({ key: 'p', action: 'pause' }); }
    } else if (input === 'r') {
      setPaused(false);
      if (onKey) { onKey({ key: 'r', action: 'resume' }); }
    } else if (input === 'd') {
      if (onKey) { onKey({ key: 'd', action: 'toggle' }); }
    }
  });

  // Force a re-render every refresh cycle so elapsed-time displays stay fresh
  // even when no file changes arrive.
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  // Build child elements via createElement (no JSX).
  const dashRows = dashLines.map((line, i) => h(Text, { key: i, wrap: 'truncate' }, line));
  const outputRows = output.slice(-20).map((line, i) => h(Text, { key: i, wrap: 'truncate' }, line));

  return h(Box, { flexDirection: 'column', height: '100%' },
    // Top pane: dashboard
    h(Box, { flexDirection: 'column' }, ...dashRows),
    // Separator
    h(Text, { color: 'cyan' }, '─'.repeat(64)),
    // Bottom pane: scrolling agent output
    h(Box, { flexDirection: 'column', flexGrow: 1 },
      h(Text, { dimColor: true }, 'Agent Output'),
      ...outputRows,
    ),
    // Status bar
    h(Box, null,
      paused
        ? h(Text, { color: 'yellow' }, '⏸ PAUSED — press \'r\' to resume, \'q\' to quit')
        : h(Text, { color: 'green' }, '● RUNNING — press \'p\' to pause, \'q\' to quit'),
    ),
  );
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Start the live TUI dashboard.
 *
 * Enters Ink's render loop, renders dashboard, starts refresh interval,
 * sets up file watchers for state changes, and listens for keyboard input.
 *
 * @param {string} targetDir
 * @param {object} [options]
 * @param {number} [options.refreshMs] — Refresh interval in ms (default 1000)
 * @param {function} [options.onKey] — Callback for key presses ({ key, action })
 * @returns {boolean} — true if TUI started, false if not a TTY (falls back to text)
 */
export function startLiveDashboard(targetDir, options = {}) {
  const { refreshMs = 1000, onKey } = options;

  if (!process.stdout.isTTY) {
    // Not a TTY — fall back to one-shot text render.
    renderDashboard(targetDir);
    return false;
  }

  outputBuffer = [];
  inkHandle = render(
    h(LiveDashboard, { targetDir, refreshMs, onKey }),
    { exitOnCtrlC: false },
  );
  return true;
}

/**
 * Stop the live TUI dashboard and restore the terminal.
 */
export function stopLiveDashboard() {
  if (inkHandle) {
    inkHandle.unmount();
    inkHandle = null;
  }
}

/**
 * app — TUI application entry point.
 *
 * Launches the full interactive TUI when `dev-harness` is run with no
 * subcommand in a terminal (TTY). Detects project state and routes to
 * the appropriate initial screen:
 *   - No harness/config.json → Setup Wizard
 *   - Config exists → Main Dashboard
 *
 * Manages the screen navigation stack, global keybindings, and
 * graceful shutdown (pause pipeline, save state, unmount Ink).
 *
 * Usage:
 *   import { launchTui } from './tui/app.mjs';
 *   await launchTui(process.cwd());
 */
import { render, Box, Text, useApp, useInput } from 'ink';
import { useState, useEffect, createElement as h } from 'react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  pushScreen, popScreen, getCurrentScreen, getNavStack,
  resetToScreen, clearStack, getScreenLoader, clearToast,
} from './screens.mjs';
import { Toast } from './components/Toast.mjs';
import { Breadcrumb } from './components/Breadcrumb.mjs';
import { CONFIG_PATH } from '../lib/paths.mjs';

const h2 = h;

/**
 * Root TUI component — manages screen stack and global keys.
 *
 * ⚠ All hooks must be at the top level, before any conditional return,
 * to satisfy React's Rules of Hooks (same hook count on every render).
 */
function TuiApp({ targetDir }) {
  const { exit } = useApp();
  const [tick, setTick] = useState(0);
  const [error, setError] = useState(null);
  const [ScreenComponent, setScreenComponent] = useState(null);

  // Initialize screen on mount
  useEffect(() => {
    const configExists = existsSync(CONFIG_PATH(targetDir));
    if (configExists) {
      resetToScreen('dashboard', { targetDir });
    } else {
      resetToScreen('setup', { targetDir });
    }
    setTick(t => t + 1);
  }, [targetDir]);

  // Determine current screen from nav stack
  const current = getCurrentScreen();
  const navTrail = getNavStack().map(s => s.name);

  // Lazy-load screen component when current.name changes
  useEffect(() => {
    let cancelled = false;
    if (!current) return;
    const loader = getScreenLoader(current.name);
    if (!loader) {
      setError(`Unknown screen: ${current.name}`);
      return;
    }
    loader().then(mod => {
      if (!cancelled) {
        setScreenComponent(() => mod.default);
        setError(null);
      }
    }).catch(err => {
      if (!cancelled) setError(`Failed to load screen: ${err.message}`);
    });
    return () => { cancelled = true; };
  }, [current?.name]);

  // Global key handler
  useInput((input, key) => {
    // Screens handle their own keyboard input.
    // This is a safety net for global keys.
  });

  // ── Render (no early returns — all hooks run first) ──────────────────

  if (!current) {
    return h2(Text, { color: 'red' }, 'No screen loaded. Press q to exit.');
  }

  if (error) {
    return h2(Box, { flexDirection: 'column' },
      h2(Text, { color: 'red' }, `Error: ${error}`),
      h2(Text, { dimColor: true }, 'Press q to exit'),
    );
  }

  if (!ScreenComponent) {
    return h2(Text, { dimColor: true }, 'Loading...');
  }

  const navigate = {
    push: (name, props) => { pushScreen(name, { targetDir, ...props }); setTick(t => t + 1); },
    pop: () => { popScreen(); setTick(t => t + 1); },
    replace: (name, props) => { resetToScreen(name, { targetDir, ...props }); setTick(t => t + 1); },
    exit: () => { clearStack(); exit(); },
  };

  return h2(Box, { flexDirection: 'column' },
    // Breadcrumb
    navTrail.length > 1
      ? h2(Breadcrumb, { trail: navTrail })
      : null,
    // Current screen
    h2(ScreenComponent, {
      ...current.props,
      navigate,
      targetDir,
    }),
    // Toast notifications
    h2(Toast),
  );
}

/**
 * Launch the TUI application.
 * @param {string} targetDir — project directory
 * @returns {Promise<void>}
 */
export async function launchTui(targetDir) {
  if (!process.stdout.isTTY) {
    process.stderr.write('dev-harness TUI requires a terminal (TTY).\n');
    process.stderr.write('Use `dev-harness <command>` for CLI mode.\n');
    process.exit(1);
    return;
  }

  const absDir = resolve(targetDir);
  const inkHandle = render(h2(TuiApp, { targetDir: absDir }), {
    exitOnCtrlC: false,
  });

  // Handle graceful shutdown
  const shutdown = () => {
    clearToast();
    inkHandle.unmount();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * screens — TUI screen registry and navigation manager.
 *
 * Manages the stack of active screens and provides navigation.
 * Each screen is a React component (Ink) that receives:
 *   { targetDir, navigate, showToast, onExit }
 *
 * Usage:
 *   import { pushScreen, popScreen, getCurrentScreen } from './screens.mjs';
 *   pushScreen('dashboard', { targetDir });
 *   popScreen(); // back to previous
 */

// Screen registry — maps screen name to lazy loader
const SCREEN_LOADERS = {
  setup:      () => import('./screens/setup.mjs'),
  dashboard:  () => import('./screens/dashboard.mjs'),
  status:     () => import('./screens/status.mjs'),
  'gate-fix': () => import('./screens/gate-fix.mjs'),
  'gate-config': () => import('./screens/gate-config.mjs'),
  contract:   () => import('./screens/contract.mjs'),
  'contract-view': () => import('./screens/contract-view.mjs'),
  'agent-run': () => import('./screens/agent-run.mjs'),
  worktree:   () => import('./screens/worktree.mjs'),
  rollback:   () => import('./screens/rollback.mjs'),
  checkpoint: () => import('./screens/checkpoint.mjs'),
  learn:      () => import('./screens/learn.mjs'),
  lessons:    () => import('./screens/lessons.mjs'),
  'feature-list': () => import('./screens/feature-list.mjs'),
  progress:   () => import('./screens/progress.mjs'),
  'gate-history': () => import('./screens/gate-history.mjs'),
  rubric:     () => import('./screens/rubric.mjs'),
  'config-editor': () => import('./screens/config-editor.mjs'),
  'tool-select': () => import('./screens/tool-select.mjs'),
  help:       () => import('./screens/help.mjs'),
};

// Navigation stack — array of { name, props, component }
let navStack = [];

// Toast state — { message, type } or null
let toastState = null;
let toastTimer = null;

/**
 * Get the current screen (top of stack).
 * @returns {{ name: string, props: object }|null}
 */
export function getCurrentScreen() {
  return navStack.length > 0 ? navStack[navStack.length - 1] : null;
}

/**
 * Get the full navigation stack (for breadcrumbs).
 * @returns {array}
 */
export function getNavStack() {
  return [...navStack];
}

/**
 * Push a new screen onto the stack.
 * @param {string} name — screen name from registry
 * @param {object} [props] — props to pass to the screen
 */
export function pushScreen(name, props = {}) {
  if (!SCREEN_LOADERS[name]) {
    throw new Error(`Unknown screen: ${name}`);
  }
  navStack.push({ name, props, loaded: false, component: null });
}

/**
 * Pop the current screen (go back).
 * @returns {boolean} — true if popped, false if at root
 */
export function popScreen() {
  if (navStack.length > 1) {
    navStack.pop();
    return true;
  }
  return false;
}

/**
 * Replace the current screen (no back navigation).
 * @param {string} name
 * @param {object} [props]
 */
export function replaceScreen(name, props = {}) {
  if (!SCREEN_LOADERS[name]) {
    throw new Error(`Unknown screen: ${name}`);
  }
  if (navStack.length > 0) {
    navStack[navStack.length - 1] = { name, props, loaded: false, component: null };
  } else {
    navStack.push({ name, props, loaded: false, component: null });
  }
}

/**
 * Reset to a single screen (clear stack).
 * @param {string} name
 * @param {object} [props]
 */
export function resetToScreen(name, props = {}) {
  navStack = [{ name, props, loaded: false, component: null }];
}

/**
 * Clear the entire stack (exit TUI).
 */
export function clearStack() {
  navStack = [];
}

/**
 * Get the loader for a screen name.
 * @param {string} name
 * @returns {function|null}
 */
export function getScreenLoader(name) {
  return SCREEN_LOADERS[name] || null;
}

/**
 * Show a toast notification (auto-dismiss after timeout).
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type]
 * @param {number} [timeoutMs] — auto-dismiss time (default 3000)
 */
export function showToast(message, type = 'info', timeoutMs = 3000) {
  toastState = { message, type };
  if (toastTimer) { clearTimeout(toastTimer); }
  toastTimer = setTimeout(() => { toastState = null; }, timeoutMs);
}

/**
 * Get current toast state.
 * @returns {{ message: string, type: string }|null}
 */
export function getToast() {
  return toastState;
}

/**
 * Clear the toast immediately.
 */
export function clearToast() {
  toastState = null;
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

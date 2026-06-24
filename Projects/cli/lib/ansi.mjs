/**
 * ansi — ANSI escape code utilities for TUI rendering.
 *
 * Cursor & screen control helpers remain hand-rolled (no good dependency
 * covers these concisely). Color styling delegates to `picocolors`, which
 * handles TTY detection, NO_COLOR, FORCE_COLOR, and Windows conformance.
 * Visual string width delegates to `string-width`, which correctly handles
 * emoji, combining marks, zero-width joiners, and East Asian wide chars —
 * replacing the previous heuristic that mis-measured many code points.
 *
 * All cursor/screen functions check process.stdout.isTTY and no-op if not,
 * so the CLI degrades gracefully in non-interactive contexts (CI, pipes).
 *
 * Usage:
 *   import { clearScreen, cursorHome, colors, box } from './ansi.mjs';
 */
import pc from 'picocolors';
import stringWidth from 'string-width';

// ── Check if stdout is a TTY ─────────────────────────────────────────────────

const isTTY = () => process.stdout.isTTY ?? false;

// ── Cursor & screen control ──────────────────────────────────────────────────

export const ESC = '\x1b[';

export function clearScreen() {
  if (!isTTY()) { return ''; }
  return `${ESC}2J${ESC}H`;
}

export function cursorHome() {
  if (!isTTY()) { return ''; }
  return `${ESC}H`;
}

export function cursorHide() {
  if (!isTTY()) { return ''; }
  return `${ESC}?25l`;
}

export function cursorShow() {
  if (!isTTY()) { return ''; }
  return `${ESC}?25h`;
}

export function saveCursor() {
  if (!isTTY()) { return ''; }
  return '\x1b7';
}

export function restoreCursor() {
  if (!isTTY()) { return ''; }
  return '\x1b8';
}

export function cursorTo(row, col) {
  if (!isTTY()) { return ''; }
  return `${ESC}${row};${col}H`;
}

export function clearLine() {
  if (!isTTY()) { return ''; }
  return `${ESC}2K`;
}

export function clearLinesBelow() {
  if (!isTTY()) { return ''; }
  return `${ESC}J`;
}

/**
 * Set scroll region (for split-pane layouts).
 * @param {number} top — Top row (1-based)
 * @param {number} bottom — Bottom row (1-based)
 */
export function setScrollRegion(top, bottom) {
  if (!isTTY()) { return ''; }
  return `${ESC}${top};${bottom}r`;
}

export function resetScrollRegion() {
  if (!isTTY()) { return ''; }
  return `${ESC}r`;
}

/**
 * Enter alternate screen buffer (like vim, less).
 */
export function enterAltScreen() {
  if (!isTTY()) { return ''; }
  return `${ESC}?1049h`;
}

/**
 * Exit alternate screen buffer.
 */
export function exitAltScreen() {
  if (!isTTY()) { return ''; }
  return `${ESC}?1049l`;
}

// ── Colors ───────────────────────────────────────────────────────────────────
// Delegated to picocolors — handles TTY detection, NO_COLOR, FORCE_COLOR,
// Windows conformance, and 256/truecolor downgrading automatically.
// The shape mirrors the previous hand-rolled `colors` object so callers
// (tui/dashboard.mjs, box()) need no edits.
export const colors = {
  reset: pc.reset,
  bold: pc.bold,
  dim: pc.dim,
  italic: pc.italic,
  underline: pc.underline,

  // Foreground colors
  black: pc.black,
  red: pc.red,
  green: pc.green,
  yellow: pc.yellow,
  blue: pc.blue,
  magenta: pc.magenta,
  cyan: pc.cyan,
  white: pc.white,

  // Bright foreground colors (picocolors exposes these as bright* helpers)
  brightRed: pc.redBright,
  brightGreen: pc.greenBright,
  brightYellow: pc.yellowBright,
  brightBlue: pc.blueBright,
  brightMagenta: pc.magentaBright,
  brightCyan: pc.cyanBright,
};

// ── Box drawing ──────────────────────────────────────────────────────────────

/**
 * Draw a bordered box with optional title.
 * @param {number} width
 * @param {string} [title]
 * @param {string} [color] — ANSI color code for border
 * @returns {{ top: string, sep: string, line: (content: string) => string, bottom: string }}
 */
export function box(width, title, color = '') {
  const reset = colors.reset;
  const innerWidth = width - 2;
  const top = `${color}╔${'═'.repeat(innerWidth)}╗${reset}`;
  const sep = `${color}╠${'═'.repeat(innerWidth)}╣${reset}`;
  const bottom = `${color}╚${'═'.repeat(innerWidth)}╝${reset}`;

  function line(content) {
    const visualWidth = stringWidth(content);
    const padding = Math.max(0, innerWidth - visualWidth - 1); // -1 for leading space
    return `${color}║${reset} ${content}${' '.repeat(padding)}${color}║${reset}`;
  }

  return { top, sep, bottom, line };
}

/**
 * Get terminal dimensions.
 * @returns {{ rows: number, cols: number }}
 */
export function getTerminalSize() {
  return {
    rows: process.stdout.rows || 24,
    cols: process.stdout.columns || 80,
  };
}

// Re-export stringWidth for callers that need accurate visual measurement.
export { stringWidth };

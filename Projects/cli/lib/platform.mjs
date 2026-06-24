/**
 * platform — Cross-platform detection and execution helpers.
 *
 * Usage:
 *   import { getPlatform, isWindows, crossExec } from './platform.mjs';
 */
import { execSync } from 'node:child_process';

/**
 * Detect the current platform.
 * @returns {'linux'|'darwin'|'win32'}
 */
export function getPlatform() {
  return process.platform;
}

/**
 * Check if running on Windows.
 * @returns {boolean}
 */
export function isWindows() {
  return process.platform === 'win32';
}

/**
 * Check if running on macOS.
 * @returns {boolean}
 */
export function isMacOS() {
  return process.platform === 'darwin';
}

/**
 * Shell-quote a string for the current platform.
 * On Windows, uses double quotes. On Unix, wraps in single quotes (or double if shell chars present).
 * @param {string} str
 * @returns {string}
 */
export function shellQuote(str) {
  if (isWindows()) {
    // Windows CMD: double quotes, doubled for literal
    return `"${str.replace(/"/g, '""')}"`;
  }
  // Unix: single quotes, escaped for any single quotes in the string
  if (str.includes("'")) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }
  return `'${str}'`;
}

/**
 * Execute a command using the platform-appropriate shell.
 * On Windows, uses 'cmd /c'. On Unix, uses 'sh -c'.
 * @param {string} cmd
 * @param {object} [options]
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
export function crossExec(cmd, options = {}) {
  const shell = isWindows() ? 'cmd' : 'sh';
  const shellFlag = isWindows() ? '/c' : '-c';
  try {
    // execSync with encoding:'utf-8' returns the stdout string directly
    // (not an object with .stdout/.stderr).
    const stdout = execSync(`${shell} ${shellFlag} ${shellQuote(cmd)}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: options.timeout || 60000,
      ...options,
    });
    return { stdout: stdout || '', stderr: '', exitCode: 0 };
  } catch (err) {
    return {
      stdout: typeof err.stdout === 'string' ? err.stdout : (err.stdout?.toString() || ''),
      stderr: typeof err.stderr === 'string' ? err.stderr : (err.stderr?.toString() || err.message),
      exitCode: err.status || 1,
    };
  }
}

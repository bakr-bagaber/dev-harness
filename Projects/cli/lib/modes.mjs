/**
 * modes — Copilot/Autopilot mode configuration and behavior.
 *
 * Shared utilities for determining mode, reading copilot config,
 * and handling interactive prompts.
 *
 * Usage:
 *   import { getMode, shouldAutoPrompt, shouldConfirmGates, promptYesNo } from './modes.mjs';
 */
import { loadConfig, set } from './state.mjs';
import * as readline from 'node:readline';

/**
 * Get the current mode for a project.
 * @param {string} targetDir
 * @returns {'copilot'|'autopilot'}
 */
export function getMode(targetDir) {
  const { config } = loadConfig(targetDir);
  return (config.mode === 'autopilot') ? 'autopilot' : 'copilot';
}

/**
 * Check if copilot should auto-prompt after gate passes.
 * @param {string} targetDir
 * @returns {boolean}
 */
export function shouldAutoPrompt(targetDir) {
  const { config } = loadConfig(targetDir);
  if (config.mode !== 'copilot') {return false;}
  return config.copilot?.autoPrompt !== false; // default true
}

/**
 * Check if copilot should confirm before advancing gates.
 * @param {string} targetDir
 * @returns {boolean}
 */
export function shouldConfirmGates(targetDir) {
  const { config } = loadConfig(targetDir);
  if (config.mode !== 'copilot') {return false;}
  return config.copilot?.confirmGates !== false; // default true
}

/**
 * Prompt the user with a yes/no question. Returns true for y/yes.
 * In non-interactive contexts (stdin not a TTY), returns null (no answer).
 * @param {string} question — question text to display
 * @returns {Promise<boolean|null>} true=y, false=n, null=no answer
 */
export function promptYesNo(question) {
  // Use readline for interactive prompt
  return new Promise((resolve) => {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(`${question} (y/n) `, (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        if (trimmed === 'y' || trimmed === 'yes') {
          resolve(true);
        } else if (trimmed === 'n' || trimmed === 'no') {
          resolve(false);
        } else {
          // Invalid input — treat as no
          resolve(false);
        }
      });
    } catch {
      // Not interactive or readline unavailable
      resolve(null);
    }
  });
}

/**
 * Ensure copilot config block exists in project config.
 * @param {string} targetDir
 * @param {object} [overrides]
 */
export function ensureCopilotConfig(targetDir, overrides = {}) {
  const { config } = loadConfig(targetDir);
  if (!config.copilot) {
    config.copilot = { autoPrompt: true, confirmGates: true };
  }
  // Apply overrides
  if (overrides.autoPrompt !== undefined) {config.copilot.autoPrompt = overrides.autoPrompt;}
  if (overrides.confirmGates !== undefined) {config.copilot.confirmGates = overrides.confirmGates;}
  set(targetDir, 'copilot', config.copilot);
}

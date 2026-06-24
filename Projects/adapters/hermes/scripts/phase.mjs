#!/usr/bin/env node
/**
 * Hermes skill wrapper — harness-dev phase
 *
 * Thin wrapper that resolves the CLI relative to this skill's location
 * and forwards arguments to the phase command.
 *
 * Usage: node hermes/skill/dev-harness/scripts/phase.mjs <phase-name> [--json] [--target <dir>]
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..', '..', '..');
const cliPath = resolve(projectRoot, 'cli/harness-dev.mjs');

const args = process.argv.slice(2);

const result = spawnSync('node', [cliPath, 'phase', ...args], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env },
});

process.exit(result.status ?? 1);

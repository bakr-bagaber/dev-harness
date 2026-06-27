#!/usr/bin/env node
/**
 * Skill wrapper — dev-harness validate
 *
 * Thin wrapper that resolves the CLI relative to this skill's location
 * and forwards arguments to the validate command.
 *
 * Usage: node skill/dev-harness/scripts/validate.mjs [--json] [--phase <name>] [--feature <id>] [--task <id>] [--target <dir>]
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..', '..', '..', '..');
const cliPath = resolve(projectRoot, 'cli/dev-harness.mjs');

const args = process.argv.slice(2);

const result = spawnSync('node', [cliPath, 'validate', ...args], {
  stdio: 'inherit',
  cwd: projectRoot,
  env: { ...process.env },
});

process.exit(result.status ?? 1);

#!/usr/bin/env node
/**
 * dev-harness — Agent-agnostic development harness CLI (backend).
 *
 * Entry point. CLI mode only — AI agent tools (Claude Code, Codex, Cursor,
 * OpenCode, Antigravity) are the frontend. They read AGENTS.md + phase skill
 * files and call CLI commands to follow the workflow.
 *
 * Parses args, routes to command handler, formats output (human or JSON).
 */

import { parseArgs } from './lib/args.mjs';
import { CliError, EXIT, die } from './lib/errors.mjs';
import { helpText, versionText, commandHelpText } from './lib/help.mjs';

/** Map of command names to their implementation modules. */
const COMMANDS = {
  init:       () => import('./commands/init.mjs'),
  status:     () => import('./commands/status.mjs'),
  phase:      () => import('./commands/phase.mjs'),
  validate:   () => import('./commands/validate.mjs'),
  'set-mode': () => import('./commands/set-mode.mjs'),
  config:     () => import('./commands/config.mjs'),
  pause:      () => import('./commands/pause.mjs'),
  resume:     () => import('./commands/resume.mjs'),
  learn:      () => import('./commands/learn.mjs'),
  decision:   () => import('./commands/decision.mjs'),
  role:       () => import('./commands/role.mjs'),
  contract:   () => import('./commands/contract.mjs'),
  worktree:   () => import('./commands/worktree.mjs'),
  rollback:   () => import('./commands/rollback.mjs'),
  checkpoint: () => import('./commands/checkpoint.mjs'),
  cleanup:    () => import('./commands/cleanup.mjs'),
  audit:      () => import('./commands/audit.mjs'),
  help:       null, // handled inline
};

async function main() {
  const args = parseArgs(process.argv);
  const json = args.json;

  // --help with no command
  if (args.help && !args.command) {
    process.stdout.write(helpText(json) + '\n');
    return;
  }

  // --version
  if (args.version) {
    process.stdout.write(versionText(json) + '\n');
    return;
  }

  // --help with a command → per-command help (falls back to global help)
  if (args.help && args.command) {
    const perCmd = commandHelpText(args.command, json);
    process.stdout.write((perCmd ?? helpText(json)) + '\n');
    return;
  }

  // No command → show help (agent-backend mode, no TUI)
  if (!args.command) {
    process.stdout.write(helpText(json) + '\n');
    return;
  }

  // "help" command alias — redirects to --help
  // "help <command>" → per-command help
  if (args.command === 'help') {
    if (args.subcommand) {
      const perCmd = commandHelpText(args.subcommand, json);
      process.stdout.write((perCmd ?? helpText(json)) + '\n');
    } else {
      process.stdout.write(helpText(json) + '\n');
    }
    return;
  }

  // Resolve command module
  const loader = COMMANDS[args.command];
  if (!loader) {
    throw new CliError(
      `Unknown command "${args.command}". See dev-harness --help`,
      EXIT.USAGE_ERROR
    );
  }

  // Load and execute
  const mod = await loader();
  await mod.default(args);
}

main().catch((err) => {
  const isCli = err instanceof CliError;
  // Detect --json from argv since parseArgs already ran
  const json = process.argv.includes('--json');
  die(err, json);
  // die() calls process.exit, but keep this as safety net
  process.exit(isCli ? EXIT.USAGE_ERROR : EXIT.INTERNAL_ERROR);
});

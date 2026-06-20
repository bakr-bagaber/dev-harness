#!/usr/bin/env node
/**
 * dev-harness — Agent-agnostic development harness CLI.
 *
 * Entry point. Parses args, routes to command handler,
 * formats output (human or JSON), handles errors.
 */

import { parseArgs } from './lib/args.mjs';
import { CliError, EXIT, die } from './lib/errors.mjs';
import { helpText, versionText, commandHelpText } from './lib/help.mjs';

/** Map of command names to their implementation modules. */
const COMMANDS = {
  init:      () => import('./commands/init.mjs'),
  status:    () => import('./commands/status.mjs'),
  phase:     () => import('./commands/phase.mjs'),
  validate:  () => import('./commands/validate.mjs'),
  'set-mode': () => import('./commands/set-mode.mjs'),
  config:    () => import('./commands/config.mjs'),
  pause:     () => import('./commands/pause.mjs'),
  resume:    () => import('./commands/resume.mjs'),
  learn:     () => import('./commands/learn.mjs'),
  contract:  () => import('./commands/contract.mjs'),
  worktree:  () => import('./commands/worktree.mjs'),
  rollback:  () => import('./commands/rollback.mjs'),
  checkpoint: () => import('./commands/checkpoint.mjs'),
  'detect-tool': () => import('./commands/detect-tool.mjs'),
  help:      null, // handled inline — prints help text, registers as valid command
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

  // No command → help (exit 0, not an error)
  if (!args.command) {
    process.stdout.write(helpText(json) + '\n');
    return;
  }

  // "help" command alias — redirects to --help
  if (args.command === 'help') {
    process.stdout.write(helpText(json) + '\n');
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

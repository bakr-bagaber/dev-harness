/**
 * Minimal argument parser — no external deps.
 *
 * Parses: --flag value, --flag=value, --boolean, -h, --, positional args
 * Supports: --json, --help, --version as named flags
 */

/**
 * @param {string[]} argv — typically process.argv
 * @returns {{
 *   command: string|null,
 *   subcommand: string|null,
 *   flags: Record<string, string|boolean>,
 *   positionals: string[],
 *   json: boolean,
 *   help: boolean,
 *   version: boolean,
 * }}
 */
export function parseArgs(argv) {
  const result = {
    command: null,
    subcommand: null,
    flags: {},
    positionals: [],
    json: false,
    help: false,
    version: false,
  };

  // skip node binary + script path
  const tokens = argv.slice(2);
  let stopParsing = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // everything after -- is a positional
    if (stopParsing) {
      result.positionals.push(token);
      continue;
    }

    if (token === '--') {
      stopParsing = true;
      continue;
    }

    // flag tokens
    if (token.startsWith('--')) {
      const eqIdx = token.indexOf('=');

      if (eqIdx !== -1) {
        // --key=value
        const key = token.slice(2, eqIdx);
        result.flags[key] = token.slice(eqIdx + 1);
        // promote well-known flags
        if (key === 'json') {result.json = true;}
        if (key === 'help') {result.help = true;}
        if (key === 'version') {result.version = true;}
      } else {
        const key = token.slice(2);

        // promote before value detection so --json alone is boolean
        if (key === 'json') { result.json = true; continue; }
        if (key === 'help') { result.help = true; continue; }
        if (key === 'version') { result.version = true; continue; }

        // peek next token for value
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
          result.flags[key] = tokens[i + 1];
          i++;
        } else {
          // boolean flag (no value)
          result.flags[key] = true;
        }
      }
      continue;
    }

    // short flags
    if (token.startsWith('-') && token.length > 1 && token[1] !== '-') {
      if (token === '-h') { result.help = true; continue; }
      result.flags[token.slice(1)] = true;
      continue;
    }

    // positional — first one is the command
    if (!result.command) {
      result.command = token;
    } else {
      result.positionals.push(token);
    }
  }

  // The first positional becomes the subcommand (e.g. "phase build" → command=phase, subcommand=build)
  if (result.positionals.length > 0) {
    result.subcommand = result.positionals[0];
    result.positionals = result.positionals.slice(1);
  }

  return result;
}

/**
 * Determine if stdout should be JSON based on args.
 * Mirrors the implicit promotion logic in parseArgs for external callers.
 * @param {{ json?: boolean, flags?: Record<string,any> }} args
 * @returns {boolean}
 */
// wantsJson removed — use parseCommandArgs().json from command-helpers.mjs instead.

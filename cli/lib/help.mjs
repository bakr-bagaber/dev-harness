/**
 * Help text builder — centralized to keep all formatting in one place.
 */

const USAGE = `Usage: dev-harness [command] [options]

💡 Run "dev-harness" with NO arguments for the interactive TUI (recommended for humans).
   CLI commands below are for AI agents, scripting, and --json automation.

Pipeline commands:
  init                  Scaffold full harness in current directory
  phase <name>          Invoke a phase (define|plan|build|verify|simplify|review|ship)
  validate              Run gate checks for current phase
  validate --feature X --task Y   Validate a single task (feature-iterate phases)

State commands:
  status                Show current phase + gate state + detected stack
  config list            List all config parameters with descriptions
  config get [key]      Get config value (omit key for all)
  config set <key> <val> Set config value (e.g. config set gates.enabled true)
  pause                 Pause autopilot execution
  resume                Resume autopilot execution
  run                   Start orchestrator (spawn agent per task, autopilot)
  select-tool           Choose backend agentic tool (interactive wizard)
  learn <message>       Append a lesson to progress.md

Agent workflow commands:
  contract propose      Write/update sprint-contract.md
  contract review       Evaluator reviews contract, sets status
  contract status       Show current contract state
  contract escalate     Human adjudication when agents can't agree

Git workflow commands:
  worktree create <name> Create isolated worktree for a feature
  worktree list          List active worktrees
  worktree prune         Remove orphaned worktrees
  worktree remove <name> Clean up worktree (optionally merge branch)
  rollback list          Show available checkpoints
  rollback to <tag>      Restore state to a checkpoint
  rollback branch <tag>  Branch off a good iteration
  checkpoint create <label> Force a manual checkpoint tag
  detect-tool           Detect which agent tools are configured

Mode:
  set-mode <mode>       Switch mode (copilot|autopilot)

Other:
  help                  Alias for --help

Global flags:
  --json      Machine-parseable JSON output
  --help, -h  Show this help message
  --version   Show version

Exit codes:
  0  Success
  1  Validation failure (gate check failed)
  2  Usage error (bad arguments)
  3  Internal error`;

const VERSION = '3.0.0';

// Help text for JSON output
function buildJsonHelp() {
  return {
    help: true,
    version: VERSION,
    usage: 'dev-harness <command> [options]',
    commands: {
      init: 'Scaffold full harness in current directory',
      status: 'Show current phase + gate state + detected stack',
      phase: 'Invoke a phase (define|plan|build|verify|simplify|review|ship)',
      validate: 'Run gate checks for current phase (--feature --task for per-task check)',
      run: 'Start orchestrator — spawn agent per task with fresh session, API retry, live dashboard',
      'select-tool': 'Choose backend agentic tool (interactive wizard or direct selection)',
      'set-mode': 'Switch mode (copilot|autopilot)',
      config: 'Get/set config values',
      pause: 'Pause autopilot execution',
      resume: 'Resume autopilot execution',
      learn: 'Append a lesson to progress.md',
      contract: 'Sprint Contract workflow (propose/review/status/escalate)',
      worktree: 'Git worktree management (create/list/prune/remove)',
      rollback: 'Checkpoint recovery (list/to/branch)',
      checkpoint: 'Manual checkpoint tagging (create)',
      'detect-tool': 'Detect which agent coding tools are configured in the project',
      help: 'Alias for --help',
    },
    flags: {
      json: 'Machine-parseable JSON output',
      help: 'Show this help message',
      version: 'Show version',
    },
    exitCodes: {
      0: 'Success',
      1: 'Validation failure (gate check failed)',
      2: 'Usage error (bad arguments)',
      3: 'Internal error',
    },
  };
}

/**
 * @param {boolean} json
 * @returns {string}
 */
export function helpText(json = false) {
  if (json) {
    return JSON.stringify(buildJsonHelp());
  }
  return USAGE;
}

/**
 * @param {boolean} json
 * @returns {string}
 */
export function versionText(json = false) {
  if (json) {
    return JSON.stringify({ version: VERSION });
  }
  return `dev-harness v${VERSION}`;
}

// Per-command help text (for `dev-harness <command> --help`).
const COMMAND_HELP = {
  init: `Usage: dev-harness init [--stack <name>] [--target <dir>] [--agent-tool <tool>] [--mode <copilot|autopilot>] [--force] [--no-git] [--json]

Scaffold a full harness in the target directory:
  - Detects stack (or use --stack)
  - Generates AGENTS.md, harness-config.json, init.sh, progress.md,
    sprint-contract.md, feature_list.json, docs/, ci/, evaluator-rubric.md
  - Initializes git repo + initial commit (unless --no-git)

Flags:
  --stack <name>          Override stack detection (node|python|go|rust|java|...)
  --target <dir>          Target directory (default: cwd)
  --agent-tool <tool>     Configure agent tool (e.g. claude-code, cursor, copilot)
  --mode <mode>           Pipeline mode: copilot (default) or autopilot
  --force                 Overwrite existing harness files
  --no-git                Skip git init
  --json                  JSON output`,

  status: `Usage: dev-harness status [--target <dir>] [--json]

Show current phase, gate state, detected stack, recent lessons, and next action.

Flags:
  --target <dir>    Project directory (default: cwd)
  --json            JSON output`,

  phase: `Usage: dev-harness phase <name> [--target <dir>] [--git-ops] [--json]

Invoke a phase. Valid phases: define, plan, build, verify, simplify, review, ship.

Flags:
  --target <dir>    Project directory (default: cwd)
  --git-ops         Execute git reset --hard + clean on retry (fresh context)
  --json            JSON output`,

  validate: `Usage: dev-harness validate [--phase <name>] [--feature <id> --task <id>] [--target <dir>] [--json]

Run gate checks for the current (or specified) phase.

Flags:
  --phase <name>    Override current phase
  --feature <id>    Validate a single feature (feature-iterate phases)
  --task <id>       Validate a single task within a feature
  --target <dir>    Project directory (default: cwd)
  --json            JSON output`,

  'set-mode': `Usage: dev-harness set-mode <copilot|autopilot> [--target <dir>] [--json]

Switch execution mode. Autopilot requires DEFINE phase or later.`,

  config: `Usage: dev-harness config list [--target <dir>] [--json]
       dev-harness config get [key] [--target <dir>] [--json]
       dev-harness config set <key> <value> [--target <dir>] [--json]

List all parameters with descriptions, or get/set values via dot-notation.
Use 'config list' to see all configurable parameters, their current values,
types, allowed options, and descriptions.

Examples:
  dev-harness config list
  dev-harness config list --json
  dev-harness config get gates.enabled
  dev-harness config set gates.enabled true
  dev-harness config set mode autopilot
  dev-harness config set maxRetries 5`,

  pause: `Usage: dev-harness pause [--target <dir>] [--json]

Pause autopilot execution. Autopilot stops after the current phase gate.`,

  resume: `Usage: dev-harness resume [--target <dir>] [--json]

Resume autopilot execution.`,

  learn: `Usage: dev-harness learn "<message>" [--target <dir>] [--json]

Append a lesson to the Lessons section of progress.md.`,

  contract: `Usage: dev-harness contract <subcommand> [options] [--target <dir>] [--json]

Subcommands:
  propose --scope "..." [--exclusions "..."] [--criteria "..."]   Generator proposes
  review --decision <agreed|needs-revision> [--notes "..."]       Evaluator reviews
  status                                                            Show contract state
  escalate [--reason "..."]                                         Human adjudication`,

  worktree: `Usage: dev-harness worktree <subcommand> [options] [--target <dir>] [--json]

Subcommands:
  create <name>   Create isolated worktree for a feature
  list            List active worktrees
  prune           Remove orphaned worktrees
  remove <name>   Clean up worktree (optionally merge branch)`,

  rollback: `Usage: dev-harness rollback <subcommand> [checkpoint] [--target <dir>] [--json]

Subcommands:
  list            Show available checkpoints
  to <tag>        Restore state to a checkpoint
  branch <tag>    Branch off a good iteration`,

  checkpoint: `Usage: dev-harness checkpoint create <label> [--force] [--target <dir>] [--json]

Create a manual checkpoint tag (manual/<label>). Requires clean working tree
unless --force is given.`,

  'detect-tool': `Usage: dev-harness detect-tool [--target <dir>] [--json]

Scan the project for agent-tool files (CLAUDE.md, .cursorrules, AGENTS.md, etc.)
and report which coding agents are available. Recommends a tool based on config
and detected files.`,

  run: `Usage: dev-harness run [--agent-tool <tool>] [--target <dir>] [--json] [--no-tui]

Start the orchestrator (supervisor) for autonomous pipeline execution.
Spawns the configured agentic tool per task with a fresh session, monitors
for completion, handles API downtime with exponential backoff, and auto-
advances through the pipeline. Renders a live dashboard showing progress.

Tier-1 tools (spawnable): hermes, openclaw, claude-code
Tier-2 tools (IDE): cursor, copilot, windsurf, etc. — use manual workflow

Flags:
  --agent-tool <tool>  Override configured tool for this run
  --no-tui             Disable TUI, use text output
  --json               JSON output mode

Keyboard (TUI mode):
  p = pause   r = resume   q = quit   Ctrl+C = safe exit`,

  'select-tool': `Usage: dev-harness select-tool [tool-name] [--list] [--target <dir>] [--json]

Choose backend agentic tool. Interactive wizard by default, or direct
selection with a tool name argument.

Tier-1 (spawnable, deep integration):
  hermes        TUI agent with skill manifests
  openclaw      TUI agent, reads AGENTS.md
  claude-code   Anthropic CLI with --print mode

Tier-2 (instruction-based, IDE tools):
  cursor, copilot, windsurf, gemini, cline, roo, kilo-code,
  amazon-q, codex, aider, continue, opencode

Flags:
  --list    List all available tools with installation status
  --json    JSON output (non-interactive)`,

  help: `Usage: dev-harness help

Show the global help message. Alias for --help.`,
};

/**
 * Get per-command help text.
 * @param {string} command
 * @param {boolean} json
 * @returns {string|null} — null if no per-command help exists
 */
export function commandHelpText(command, json = false) {
  const text = COMMAND_HELP[command];
  if (!text) { return null; }
  if (json) {
    return JSON.stringify({ command, help: text });
  }
  return text;
}

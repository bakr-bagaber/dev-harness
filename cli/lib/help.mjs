/**
 * Help text builder — centralized to keep all formatting in one place.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Read version from package.json (single source of truth) so it never drifts.
const __dirname = dirname(fileURLToPath(import.meta.url));
let VERSION = '0.0.0';
try {
  const pkgPath = resolve(__dirname, '..', '..', 'package.json');
  VERSION = JSON.parse(readFileSync(pkgPath, 'utf-8')).version || '0.0.0';
} catch (_e) {
  // Fallback if package.json unavailable (shouldn't happen in normal install)
}

const USAGE = `Usage: dev-harness [command] [options]

Agent-backend CLI — AI agent tools (Claude Code, Codex, Cursor, OpenCode,
Antigravity) are the frontend. They read AGENTS.md + phase skill files and
call these CLI commands to follow the workflow.

Pipeline commands:
  init                  Scaffold full harness in current directory
  phase <name>          Invoke a phase (define|plan|build|verify|simplify|review|ship)
  phase next            Advance to next phase (checks gates, enforces order)
  validate              Run gate checks for current phase
  validate --feature X --task Y   Validate a single task (feature-iterate phases)

State commands:
  status                Show current phase + gate state + detected stack
  config list           List all config parameters with descriptions
  config get [key]      Get config value (omit key for all)
  config set <key> <val> Set config value (e.g. config set gates.enabled true)
  pause                 Pause autopilot execution
  resume                Resume autopilot execution
  learn <message>       Append a lesson to progress.md
  decision <text>       Record a decision in lessons-decisions.md (G18)
  role <name>           Set current agent role (planner|generator|evaluator|simplifier) (G20)

Maintenance commands:
  cleanup               Scan for stale artifacts + empty dirs (--auto-fix to remove) (G24)
  audit                 Report active gates/retry/phases + suggestions (G24)

Agent workflow commands:
  contract propose      Write/update sprint-contract.md
  contract review      Evaluator reviews contract, sets status
  contract status       Show current contract state
  contract escalate     Human adjudication when agents can't agree

Git workflow commands:
  worktree create <name> Create isolated worktree for a feature
  worktree list          List active worktrees
  worktree prune         Remove orphaned worktrees
  worktree remove <name> Clean up worktree
  rollback list          Show available checkpoints
  rollback to <tag>      Restore state to a checkpoint
  rollback branch <tag>  Branch off a good iteration
  checkpoint create <label> Force a manual checkpoint tag

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

// Help text for JSON output
function buildJsonHelp() {
  return {
    help: true,
    version: VERSION,
    usage: 'dev-harness <command> [options]',
    commands: {
      init: 'Scaffold full harness in current directory',
      status: 'Show current phase + gate state + detected stack',
      phase: 'Invoke a phase (define|plan|build|verify|simplify|review|ship) or "next" to advance',
      validate: 'Run gate checks for current phase (--feature --task for per-task check)',
      'set-mode': 'Switch mode (copilot|autopilot)',
      config: 'Get/set config values',
      pause: 'Pause autopilot execution',
      resume: 'Resume autopilot execution',
      learn: 'Append a lesson to progress.md',
      decision: 'Record a decision in lessons-decisions.md (G18)',
      role: 'Set current agent role (G20)',
      contract: 'Sprint Contract workflow (propose/review/status/escalate)',
      worktree: 'Git worktree management (create/list/prune/remove)',
      rollback: 'Checkpoint recovery (list/to/branch)',
      checkpoint: 'Manual checkpoint tagging (create)',
      cleanup: 'Scan for stale artifacts + empty dirs (G24)',
      audit: 'Report active gates/retry/phases + suggestions (G24)',
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
  init: `Usage: dev-harness init [--stack <name>] [--target <dir>] [--agent-tool <tool|all|list>] [--mode <copilot|autopilot>] [--force] [--no-git] [--json]

Scaffold a full harness in the target directory:
  - Detects stack (or use --stack)
  - Generates AGENTS.md, harness-config.json, init.sh, progress.md,
    sprint-contract.md, feature_list.json, docs/, ci/, evaluator-rubric.md
  - Initializes git repo + initial commit (unless --no-git)
  - Generates tool-specific instruction files from AGENTS.md content

Agent tool options:
  --agent-tool claude-code       Generate CLAUDE.md (for Claude Code)
  --agent-tool cursor            Generate .cursorrules (for Cursor)
  --agent-tool claude-code,cursor  Generate both (comma-separated)
  --agent-tool all               Generate all tool-specific files
  (omitted)                      AGENTS.md only (works with any tool that reads it)

Supported tools: claude-code, codex, cursor, opencode, antigravity, openclaw, skill

Flags:
  --stack <name>          Override stack detection (node|python|go|rust|java|...)
  --target <dir>          Target directory (default: cwd)
  --agent-tool <tool>     Agent tool(s): single, comma-separated, or "all"
  --mode <mode>           Pipeline mode: copilot (default) or autopilot
  --force                 Overwrite existing harness files (does NOT reject dirty git — init scaffolds regardless)
  --no-git                Skip git init
  --no-gates              Disable gates by default (gates are ON by default since v3.2.0)
  --json                  JSON output`,

  status: `Usage: dev-harness status [--target <dir>] [--json]

Show current phase, gate state, detected stack, recent lessons, and next action.

Flags:
  --target <dir>    Project directory (default: cwd)
  --json            JSON output`,

  phase: `Usage: dev-harness phase <name|next> [--target <dir>] [--git-ops] [--json]

Invoke a phase. Valid phases: define, plan, build, verify, simplify, review, ship.
Use "phase next" to auto-advance to the next phase (checks gates first).

Flags:
  --target <dir>    Project directory (default: cwd)
  --git-ops         Execute git reset --hard + clean on retry (fresh context)
  --json            JSON output`,

  validate: `Usage: dev-harness validate [--phase <name>] [--feature <id> --task <id>] [--session-exit] [--target <dir>] [--json]

Run gate checks for the current (or specified) phase.

Flags:
  --phase <name>    Override current phase
  --feature <id>    Validate a single feature (feature-iterate phases)
  --task <id>       Validate a single task within a feature
  --session-exit    Run ONLY the clean-state gate (5 conditions: lint, tests, handoff, no-stale, startup). Fatal-on-demand. (G17)
  --target <dir>    Project directory (default: cwd)
  --json            JSON output`,

  'set-mode': `Usage: dev-harness set-mode <copilot|autopilot> [--target <dir>] [--json]

Switch execution mode. Autopilot requires DEFINE phase or later.`,

  config: `Usage: dev-harness config list [--target <dir>] [--json]
       dev-harness config get [key] [--target <dir>] [--json]
       dev-harness config set <key> <value> [--json-value <json>] [--target <dir>] [--json]

List all parameters with descriptions, or get/set values via dot-notation.
Use 'config list' to see all configurable parameters, their current values,
types, allowed options, and descriptions.

For array/object values, use --json-value to bypass shell quoting:
  --json-value '["a","b"]'         Parse as JSON string
  --json-value @file.json          Read from file
  --json-value -                   Read from stdin

Examples:
  dev-harness config list
  dev-harness config list --json
  dev-harness config get gates.enabled
  dev-harness config set gates.enabled true
  dev-harness config set mode autopilot
  dev-harness config set maxRetries 5
  dev-harness config set phases.enabled --json-value '["define","plan","build"]'
  dev-harness config set gates.cleanState.stalePatterns --json-value '["console.log","TODO"]'`,

  pause: `Usage: dev-harness pause [--target <dir>] [--json]

Pause autopilot execution. Autopilot stops after the current phase gate.`,

  resume: `Usage: dev-harness resume [--target <dir>] [--json]

Resume autopilot execution.`,

  learn: `Usage: dev-harness learn "<message>" [--target <dir>] [--json]

Append a lesson to the Lessons section of progress.md.`,

  decision: `Usage: dev-harness decision "<text>" [--links-lesson "lesson text"] [--target <dir>] [--json]

Record a decision in harness/lessons-decisions.md, linked to the last lesson (G18).
Decisions are recorded live (not backfilled at REVIEW). Each decision is paired
with a lesson to preserve causality.

Flags:
  --links-lesson "text"   Link to a specific lesson (default: last lesson)
  --target <dir>          Target directory (default: cwd)
  --json                  JSON output`,

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

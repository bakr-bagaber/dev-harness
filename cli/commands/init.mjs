#!/usr/bin/env node
/**
 * init — Scaffold full harness in target directory.
 *
 * Creates all harness files: template-based (AGENTS.md, harness-config.json,
 * init.sh, progress.md, sprint-contract.md) plus project files (feature_list.json,
 * feature-list.schema.json, session-handoff.md, etc.), git init, .gitignore.
 *
 * Usage: dev-harness init [--stack <name>] [--target <dir>] [--agent-tool <name>] [--force] [--no-git] [--json]
 */
import { resolve, join } from 'node:path';
import {
  existsSync, writeFileSync, mkdirSync, readFileSync,
} from 'node:fs';
import { generateTemplates } from '../lib/templates.mjs';
import { detectStack, getStackMeta } from '../lib/detect-stack.mjs';
import { listStacks } from '../lib/vars.mjs';
import { CliError, EXIT, die } from '../lib/errors.mjs';
import { execGit } from '../lib/git.mjs';
import {
  getExtraFiles,
  getConfigFileContent,
  getVersionFileContent,
  getGitignoreContent,
  KNOWN_AGENT_TOOLS,
} from '../lib/scaffold.mjs';
import { getToolEntry } from '../lib/tool-registry.mjs';


// ── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Check if targetDir is inside a git repository.
 */
function isInsideGitRepo(targetDir) {
  return execGit('git rev-parse --git-dir 2>/dev/null', targetDir).ok;
}

/**
 * Check if git repo is empty (no commits yet).
 */
function isGitRepoEmpty(targetDir) {
  const r = execGit('git rev-list -n 1 HEAD 2>/dev/null', targetDir);
  return !r.ok || r.stdout === '';
}

/**
 * Init git repo and create initial commit.
 */
function initGit(targetDir) {
  const messages = [];

  if (!isInsideGitRepo(targetDir)) {
    execGit('git init', targetDir);
    messages.push('Initialized empty git repo');
  }

  if (isGitRepoEmpty(targetDir)) {
    // Stage everything and commit
    execGit('git add -A', targetDir);
    execGit('git commit -m "harness: initial scaffold" --allow-empty', targetDir);
    messages.push('Created initial commit: harness: initial scaffold');
  } else {
    messages.push('Git repo already has commits — skipped initial commit');
  }

  return messages;
}

// ── Command handler ──────────────────────────────────────────────────────────

export default async function initCommand(args) {
  const json = !!(args.json || args.flags?.json);
  const force = args.flags?.force === true || args.flags?.force === 'true';
  const noGit = args.flags?.['no-git'] === true || args.flags?.['no-git'] === 'true';
  const agentTool = args.flags?.['agent-tool'] || null;

  // Validate agent-tool if specified
  if (agentTool && !KNOWN_AGENT_TOOLS.includes(agentTool)) {
    die(
      new CliError(
        `Unknown agent tool "${agentTool}". Valid: ${KNOWN_AGENT_TOOLS.join(', ')}`,
        EXIT.USAGE_ERROR,
      ),
      json,
    );
    return;
  }
  // Guard: --target without value passes boolean true — fall back to cwd
  const rawTarget = args.flags?.target;
  const targetDir = resolve((typeof rawTarget === 'string') ? rawTarget : process.cwd());

  // Resolve stack — explicit or auto-detect
  let stack;
  const explicitStack = args.flags?.stack;
  const validStacks = listStacks();

  if (explicitStack) {
    if (!validStacks.includes(explicitStack)) {
      // Allow unknown stacks — user/agent will fill stackMeta in harness-config.json
      // during DEFINE phase (testCmd, lintCmd, buildCmd, installCmd, etc.)
      process.stderr.write(
        `Note: stack "${explicitStack}" is not built-in. ` +
        `Fill stackMeta in harness-config.json during DEFINE phase ` +
        `(testCmd, lintCmd, buildCmd, installCmd, coverageCmd).\n`
      );
    }
    stack = explicitStack;
  } else {
    // Auto-detect
    const detected = detectStack(targetDir);
    if (detected.name === 'generic') {
      die(
        new CliError(
          'Could not auto-detect project stack. Specify with --stack <name>. ' +
          `Valid: ${validStacks.join(', ')}, or any custom stack name ` +
          `(fill stackMeta during DEFINE phase).`,
          EXIT.USAGE_ERROR,
        ),
        json,
      );
      return;
    }
    stack = detected.name;
  }

  // Build the full file manifest
  const extraFiles = getExtraFiles(stack);

  // Config file and version file from stacks.json metadata
  const meta = getStackMeta(stack);
  let configFileRel = null;
  let versionFileRel = null;
  if (meta && meta.configFile) {
    configFileRel = meta.configFile; // e.g. "pyproject.toml"
  }
  if (meta && meta.versionFile) {
    versionFileRel = meta.versionFile; // e.g. ".python-version"
  }

  // Collate all output paths for existence check
  // We separate "harness files" (our scaffold — conflict = abort) from
  // "project files" (user's own — skip silently if they exist).
  const harnessPaths = [];
  const projectPaths = [];

  // Template files — known template names (mapped to harness/ paths by templates.mjs)
  const templateNames = [
    'AGENTS.md', 'harness/config.json', 'harness/scripts/init.sh',
    'harness/progress.md', 'harness/sprint-contract.md', 'harness/evaluator-rubric.md',
  ];
  for (const name of templateNames) {
    harnessPaths.push(join(targetDir, name));
  }

  // Extra scaffold files (already have harness/ prefix from getExtraFiles)
  for (const relPath of Object.keys(extraFiles)) {
    harnessPaths.push(join(targetDir, relPath));
  }

  // .gitignore
  harnessPaths.push(join(targetDir, '.gitignore'));

  // Stack config file and version file — these are the user's own project files.
  // Skip if they exist (don't abort scaffold for them).
  if (configFileRel) {
    projectPaths.push({ rel: configFileRel, abs: join(targetDir, configFileRel) });
  }
  if (versionFileRel) {
    projectPaths.push({ rel: versionFileRel, abs: join(targetDir, versionFileRel) });
  }

  // Check for existing harness files (unless --force)
  if (!force) {
    const conflicts = harnessPaths.filter(p => existsSync(p));
    if (conflicts.length > 0) {
      const msg = conflicts.length === 1
        ? `File already exists: ${conflicts[0]}` +
          '\nUse --force to overwrite existing files.'
        : `${conflicts.length} harness file(s) already exist in ${targetDir}` +
          `\nFirst conflict: ${conflicts[0]}` +
          '\nUse --force to overwrite existing files.';
      die(new CliError(msg, EXIT.VALIDATION_FAILURE), json);
      return;
    }
  }

  // ── Write phase ──────────────────────────────────────────────────────

  // Ensure target directory exists
  mkdirSync(targetDir, { recursive: true });

  // Ensure harness/ directory exists (all harness files go here)
  mkdirSync(join(targetDir, 'harness'), { recursive: true });

  const created = [];
  const errors = [];

  // 1. Template files
  try {
    const tmplResult = generateTemplates({ stack, target: targetDir });
    for (const f of tmplResult.files) {
      created.push(f);
    }
    for (const e of tmplResult.errors) {
      errors.push(e);
    }
  } catch (err) {
    errors.push(`Template generation: ${err.message}`);
  }

  // 2. Extra files (inline content)
  for (const [relPath, content] of Object.entries(extraFiles)) {
    const absPath = join(targetDir, relPath);
    // Ensure subdirectories exist
    mkdirSync(resolve(absPath, '..'), { recursive: true });
    try {
      writeFileSync(absPath, content, 'utf-8');
      created.push(absPath);
    } catch (err) {
      errors.push(`${relPath}: ${err.message}`);
    }
  }

  // 3. Stack config file — skip if it already exists (user's project file)
  if (configFileRel) {
    const cfPath = join(targetDir, configFileRel);
    if (force || !existsSync(cfPath)) {
      const cfContent = getConfigFileContent(stack);
      if (cfContent !== null) {
        try {
          writeFileSync(cfPath, cfContent, 'utf-8');
          created.push(cfPath);
        } catch (err) {
          errors.push(`${configFileRel}: ${err.message}`);
        }
      }
    } else {
      // Skipped — already exists, will report in output
    }
  }

  // 4. Stack version file — skip if it already exists
  if (versionFileRel) {
    const vfPath = join(targetDir, versionFileRel);
    if (force || !existsSync(vfPath)) {
      const vfContent = getVersionFileContent(stack);
      if (vfContent !== null && vfContent !== '') {
        try {
          writeFileSync(vfPath, vfContent, 'utf-8');
          created.push(vfPath);
        } catch (err) {
          errors.push(`${versionFileRel}: ${err.message}`);
        }
      }
    } else {
      // Skipped — already exists
    }
  }

  // 5. .gitignore
  const gitignorePath = join(targetDir, '.gitignore');
  try {
    writeFileSync(gitignorePath, getGitignoreContent(stack), 'utf-8');
    created.push(gitignorePath);
  } catch (err) {
    errors.push(`.gitignore: ${err.message}`);
  }

  // 5b. Agent-tool file (e.g. CLAUDE.md, .cursorrules, .windsurfrules)
  //     Generated from the already-rendered AGENTS.md content + optional header.
  //     No separate templates needed — AGENTS.md is the canonical source.
  if (agentTool) {
    const toolEntry = getToolEntry(agentTool);
    if (toolEntry && toolEntry.file) {
      const agentsMdPath = join(targetDir, 'AGENTS.md');
      if (existsSync(agentsMdPath)) {
        try {
          const agentsContent = readFileSync(agentsMdPath, 'utf-8');
          const header = toolEntry.header || '';
          const outPath = join(targetDir, toolEntry.file);
          // Ensure subdirectory exists (e.g. .github/copilot-instructions.md)
          mkdirSync(resolve(outPath, '..'), { recursive: true });
          writeFileSync(outPath, header + '\n' + agentsContent, 'utf-8');
          created.push(outPath);
        } catch (err) {
          errors.push(`${toolEntry.file}: ${err.message}`);
        }
      }
    }

    // Set agentTool in the generated harness/config.json
    const configPath = join(targetDir, 'harness', 'config.json');
    if (existsSync(configPath)) {
      try {
        const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
        cfg.agentTool = agentTool;
        writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
      } catch (err) {
        errors.push(`harness/config.json agentTool: ${err.message}`);
      }
    }
  }

  // 6. Git init (unless --no-git)
  const gitMessages = [];
  if (!noGit) {
    try {
      const msgs = initGit(targetDir);
      gitMessages.push(...msgs);
    } catch (err) {
      errors.push(`Git init: ${err.message}`);
    }
  }

  // ── Output ───────────────────────────────────────────────────────────

  if (json) {
    const status = errors.length > 0 ? 'partial' : 'ok';
    const message = errors.length > 0
      ? `Created ${created.length} file(s) with ${errors.length} error(s)`
      : `Created ${created.length} file(s) for stack "${stack}"`;
    process.stdout.write(JSON.stringify({
      command: 'init',
      status,
      message,
      stack,
      target: targetDir,
      filesCreated: created.length,
      files: created,
      git: gitMessages,
      errors,
    }) + '\n');
    if (errors.length > 0) {
      process.exit(EXIT.VALIDATION_FAILURE);
    }
    return;
  }

  // Human output
  for (const f of created) {
    process.stdout.write(`  ✓ ${f}\n`);
  }
  for (const e of errors) {
    process.stderr.write(`  ✗ ${e}\n`);
  }
  for (const g of gitMessages) {
    process.stdout.write(`  ● ${g}\n`);
  }
  process.stdout.write(`\nCreated ${created.length} file(s) for stack "${stack}" in ${targetDir}\n`);
}

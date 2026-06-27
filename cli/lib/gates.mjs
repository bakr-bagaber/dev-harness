/**
 * gates — Phase gate validation engine.
 *
 * Each phase has a set of deterministic checks. Checks are functions
 * that return { name, pass, detail }.
 *
 * Phase gates are disabled by default (gates.enabled: false).
 * Run via: dev-harness validate
 *
 * Usage:
 *   import { runChecks, getPhase } from './gates.mjs';
 *   const result = runChecks('/path/to/project', 'build');
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execSync } from 'node:child_process';
import { loadConfig } from './state.mjs';
import { getStackMeta, detectStack } from './detect-stack.mjs';
import { validateContract } from './contract.mjs';
import { execGitCheck as execCheck } from './git.mjs';
import { CONFIG_PATH, RUBRIC_PATH, ARCHITECTURE_PATH, DECISIONS_PATH, HARNESS_DIR, CONTRACT_PATH, FEATURE_LIST_PATH } from './paths.mjs';
import { COVERAGE_TIMEOUT, COVERAGE_THRESHOLD_DEFAULT } from './constants.mjs';

function getStackLabel(targetDir) {
  const stack = detectStack(targetDir);
  return stack.name;
}

// ── Individual check functions ───────────────────────────────────────────────
// Each takes (targetDir) and returns { name, pass, detail }

async function checkGitRepo(targetDir) {
  const { exitCode, out } = await execCheck('git rev-parse --git-dir 2>/dev/null', targetDir);
  return {
    name: 'git-repo',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `Git dir: ${out}` : 'Not a git repository',
  };
}

function checkConfigExists(targetDir) {
  const cfgPath = CONFIG_PATH(targetDir);
  const exists = existsSync(cfgPath);
  return {
    name: 'config-exists',
    pass: exists,
    detail: exists ? 'harness/config.json present' : 'Missing: harness/config.json',
  };
}

async function checkInitExecutable(targetDir) {
  // init.sh is now at harness/scripts/init.sh
  const initSh = resolve(HARNESS_DIR(targetDir), 'scripts', 'init.sh');
  // Windows has no POSIX executable bit — skip the exec-bit check there.
  if (process.platform === 'win32') {
    return {
      name: 'init-executable',
      pass: existsSync(initSh),
      detail: existsSync(initSh) ? 'init.sh present (exec bit not checked on Windows)' : 'init.sh not found',
    };
  }
  try {
    const { exitCode } = await execCheck(`test -x "${initSh}"`, targetDir);
    return {
      name: 'init-executable',
      pass: exitCode === 0,
      detail: exitCode === 0 ? 'init.sh is executable' : 'init.sh not found or not executable',
    };
  } catch {
    return { name: 'init-executable', pass: false, detail: 'init.sh not found' };
  }
}

async function checkFeatureBranch(targetDir) {
  const { out, exitCode } = await execCheck('git symbolic-ref HEAD 2>/dev/null', targetDir);
  if (exitCode !== 0) {
    return { name: 'feature-branch', pass: false, detail: 'Not on a branch (detached HEAD or no git repo)' };
  }
  const ref = out.replace('refs/heads/', '');
  const isMain = ref === 'main' || ref === 'master';
  return {
    name: 'feature-branch',
    pass: !isMain,
    detail: isMain ? `On main/master branch: ${ref}` : `Feature branch: ${ref}`,
  };
}

async function checkGitCleanSimple(targetDir) {
  const { exitCode } = await execCheck('git diff --quiet 2>/dev/null', targetDir);
  if (exitCode !== 0) {
    // There are uncommitted changes
    return { name: 'git-clean', pass: false, detail: 'Uncommitted changes (git diff --quiet failed)' };
  }
  return { name: 'git-clean', pass: true, detail: 'Working tree clean' };
}

async function checkGitStatusClean(targetDir) {
  const { out, exitCode } = await execCheck('git status --porcelain 2>/dev/null', targetDir);
  if (exitCode !== 0) {
    return { name: 'git-clean', pass: false, detail: 'Unable to check git status' };
  }
  const clean = out.length === 0;
  return {
    name: 'git-clean',
    pass: clean,
    detail: clean ? 'Working tree fully clean (no untracked files)' : `Unclean: ${out.slice(0, 200)}`,
  };
}

async function checkLint(targetDir) {
  const stack = getStackLabel(targetDir);
  const meta = getStackMeta(stack, targetDir);
  const lintCmd = meta?.lintCmd;
  if (!lintCmd) {
    return { name: 'lint', pass: true, detail: `No lint command configured for ${stack}` };
  }
  const { exitCode, out } = await execCheck(lintCmd, targetDir);
  return {
    name: 'lint',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `${lintCmd} — 0 issues` : `${lintCmd} — failed\n${out.slice(0, 200)}`,
  };
}

async function checkTests(targetDir) {
  const stack = getStackLabel(targetDir);
  const meta = getStackMeta(stack, targetDir);
  const testCmd = meta?.testCmd;
  if (!testCmd) {
    return { name: 'tests', pass: true, detail: `No test command configured for ${stack}` };
  }
  const { exitCode, out } = await execCheck(testCmd, targetDir);
  return {
    name: 'tests',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `${testCmd} — passed` : `${testCmd} — failed\n${out.slice(0, 200)}`,
  };
}

function checkChangelog(targetDir) {
  const paths = ['CHANGELOG.md', 'changelog.md', 'history/changelog.md', 'CHANGELOG'];
  const found = paths.find(p => existsSync(resolve(targetDir, p)));
  return {
    name: 'changelog',
    pass: !!found,
    detail: found ? `Changelog: ${found}` : 'No CHANGELOG.md found',
  };
}

async function checkTagged(targetDir) {
  const { out, exitCode } = await execCheck('git describe --exact-match --tags HEAD 2>/dev/null', targetDir);
  return {
    name: 'tagged',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `Tagged: ${out}` : 'HEAD is not tagged',
  };
}

async function checkBranchUpToDate(targetDir) {
  const { exitCode } = await execCheck(
    'git fetch origin 2>/dev/null; git merge-base --is-ancestor HEAD @{u} 2>/dev/null',
    targetDir,
  );
  if (exitCode === 0) {
    return { name: 'branch-up-to-date', pass: true, detail: 'Branch is up to date with upstream' };
  }
  // Check if there's an upstream at all
  const { out: upstream } = await execCheck('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null', targetDir);
  if (!upstream) {
    return { name: 'branch-up-to-date', pass: true, detail: 'No upstream configured — skipped' };
  }
  return { name: 'branch-up-to-date', pass: false, detail: 'Branch is behind upstream' };
}

/** Check that sprint contract exists and is agreed. */
function checkContractAgreed(targetDir) {
  return validateContract(targetDir);
}

/** Check that evaluator-rubric.md exists in the project. */
function checkRubricExists(targetDir) {
  const found = existsSync(RUBRIC_PATH(targetDir));
  return {
    name: 'rubric-exists',
    pass: found,
    detail: found ? 'harness/evaluator-rubric.md found' : 'harness/evaluator-rubric.md missing — run init to scaffold',
  };
}

/** Check test coverage against configured threshold. */
function checkCoverage(targetDir) {
  const { config } = loadConfig(targetDir);
  const enabled = config?.gates?.coverage?.enabled;
  const threshold = config?.gates?.coverage?.threshold ?? COVERAGE_THRESHOLD_DEFAULT;

  if (!enabled) {
    return { name: 'coverage', pass: true, detail: 'Coverage gate disabled (set gates.coverage.enabled=true)' };
  }

  const stack = detectStack(targetDir);
  const meta = getStackMeta(stack.name, targetDir);
  const cmd = meta?.coverageCmd;

  if (!cmd) {
    return { name: 'coverage', pass: true, detail: `No coverage command for ${stack.label}` };
  }

  try {
    const { stdout, exitCode } = execSync(cmd, { cwd: targetDir, stdio: 'pipe', encoding: 'utf-8', timeout: COVERAGE_TIMEOUT });
    // Parse percentage from common coverage tool outputs
    const pctMatch = stdout.match(/(\d+(?:\.\d+)?)%/);
    if (!pctMatch) {
      return { name: 'coverage', pass: exitCode === 0, detail: exitCode === 0 ? 'Coverage ran (no percentage parsed)' : 'Coverage command failed' };
    }
    const pct = parseFloat(pctMatch[1]);
    if (pct >= threshold) {
      return { name: 'coverage', pass: true, detail: `${Math.round(pct)}% >= ${threshold}% threshold` };
    }
    return { name: 'coverage', pass: false, detail: `${Math.round(pct)}% < ${threshold}% threshold` };
  } catch (e) {
    return { name: 'coverage', pass: false, detail: `Coverage check failed: ${e.message?.split('\n')[0] || e}` };
  }
}

// ── Project deliverable gates (end-user/developer files) ────────────────────
// These verify that shipped deliverables (README, LICENSE, CHANGELOG,
// ARCHITECTURE, etc.) are present and meaningfully filled in — not stubs.
// Separate from workflow gates (harness files like config, contract, rubric).

/** Minimum content lines for a doc to be considered "filled in" (not a stub). */
const MIN_DOC_LINES = 5;

/**
 * Count non-empty, non-comment, non-heading lines in a file.
 * @param {string} filePath
 * @returns {number}
 */
function countContentLines(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .filter(l => {
        const t = l.trim();
        return t && !t.startsWith('<!--') && !t.startsWith('#') && !t.startsWith('|--');
      })
      .length;
  } catch {
    return 0;
  }
}

/** Check that README.md exists and has meaningful content. */
function checkReadme(targetDir) {
  const readmePath = resolve(targetDir, 'README.md');
  if (!existsSync(readmePath)) {
    return { name: 'readme-exists', pass: false, detail: 'README.md missing — every project needs one' };
  }
  const lines = countContentLines(readmePath);
  if (lines < MIN_DOC_LINES) {
    return { name: 'readme-exists', pass: false, detail: `README.md has only ${lines} content lines — needs description, install, usage` };
  }
  return { name: 'readme-exists', pass: true, detail: `README.md present (${lines} content lines)` };
}

/** Check that a LICENSE file exists. */
function checkLicense(targetDir) {
  const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
  const found = candidates.find(f => existsSync(resolve(targetDir, f)));
  return {
    name: 'license-exists',
    pass: !!found,
    detail: found ? `${found} present` : 'No LICENSE file found — required for distribution',
  };
}

/** Check that CHANGELOG.md exists and has at least one version entry. */
function checkChangelogContent(targetDir) {
  const candidates = ['CHANGELOG.md', 'CHANGES.md', 'HISTORY.md'];
  const found = candidates.find(f => existsSync(resolve(targetDir, f)));
  if (!found) {
    return { name: 'changelog-content', pass: false, detail: 'No CHANGELOG.md found' };
  }
  const content = readFileSync(resolve(targetDir, found), 'utf-8');
  // Look for version-like patterns: ## [v]1.0.0, ## 2024-01-01, etc.
  const hasVersion = /\n##\s*(\[?v?\d+\.\d+|\d{4}-\d{2})/.test(content);
  return {
    name: 'changelog-content',
    pass: hasVersion,
    detail: hasVersion ? `${found} has version entries` : `${found} exists but no version entries found`,
  };
}

/** Check that ARCHITECTURE.md is filled in (if file exists, not just stub). */
function checkArchitectureDoc(targetDir) {
  const archPath = ARCHITECTURE_PATH(targetDir);
  if (!existsSync(archPath)) {
    return { name: 'architecture-doc', pass: true, detail: 'ARCHITECTURE.md not present (optional)' };
  }
  const lines = countContentLines(archPath);
  if (lines < MIN_DOC_LINES) {
    return { name: 'architecture-doc', pass: false, detail: `ARCHITECTURE.md is a stub (${lines} content lines) — fill in module structure` };
  }
  return { name: 'architecture-doc', pass: true, detail: `ARCHITECTURE.md documented (${lines} content lines)` };
}

/** Check that DECISIONS.md has at least one recorded decision (if file exists). */
function checkDecisionsLogged(targetDir) {
  const decPath = DECISIONS_PATH(targetDir);
  if (!existsSync(decPath)) {
    return { name: 'decisions-logged', pass: true, detail: 'DECISIONS.md not present (optional)' };
  }
  const content = readFileSync(decPath, 'utf-8');
  const hasEntry = /\n##\s*\d{4}-\d{2}-\d{2}/.test(content) || /\*\*Status:\s*(accepted|proposed)/.test(content);
  return {
    name: 'decisions-logged',
    pass: hasEntry,
    detail: hasEntry ? 'DECISIONS.md has recorded decisions' : 'DECISIONS.md is a stub — record at least one decision',
  };
}

/** Check that no empty directories exist (excluding .git, node_modules, build artifacts). */
function checkNoEmptyDirs(targetDir) {
  const emptyDirs = [];
  const skipDirs = new Set([
    '.git', 'node_modules', '.venv', 'venv', '__pycache__',
    'dist', 'build', 'target', '.next', '.cache', '.pytest_cache',
    '.mypy_cache', '.ruff_cache', '.tox', 'coverage', '.nyc_output',
  ]);

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let hasContent = false;
    for (const e of entries) {
      if (e.isDirectory()) {
        if (skipDirs.has(e.name)) { hasContent = true; continue; }
        walk(resolve(dir, e.name));
        hasContent = true;
      } else {
        hasContent = true;
      }
    }
    if (!hasContent && dir !== targetDir) {
      emptyDirs.push(relative(targetDir, dir));
    }
  }

  try {
    walk(targetDir);
  } catch {
    return { name: 'no-empty-dirs', pass: true, detail: 'Could not scan directories' };
  }

  if (emptyDirs.length === 0) {
    return { name: 'no-empty-dirs', pass: true, detail: 'No empty directories' };
  }
  return {
    name: 'no-empty-dirs',
    pass: false,
    detail: `${emptyDirs.length} empty dir(s): ${emptyDirs.slice(0, 5).join(', ')}${emptyDirs.length > 5 ? '...' : ''}`,
  };
}

/** Check that CONTRIBUTING.md exists (optional, recommended for open source). */
function checkContributing(targetDir) {
  const candidates = ['CONTRIBUTING.md', '.github/CONTRIBUTING.md', 'docs/CONTRIBUTING.md'];
  const found = candidates.find(f => existsSync(resolve(targetDir, f)));
  if (!found) {
    return { name: 'contributing-exists', pass: true, detail: 'CONTRIBUTING.md not present (recommended for open source)' };
  }
  return { name: 'contributing-exists', pass: true, detail: `${found} present` };
}

// ── Clean-state gate (G17 — walkinglabs L12) ────────────────────────────────

/**
 * Check clean state at session boundary (5 conditions per walkinglabs L12).
 * 1. Build passes (lint clean)
 * 2. Tests pass
 * 3. Progress recorded (handoff file exists + is fresh)
 * 4. No stale artifacts (matches gates.cleanState.stalePatterns)
 * 5. Startup path works (gates.cleanState.startupCmd)
 *
 * Fires at all 7 session-boundary triggers (alongside writeHandoff).
 * Exported so the session-boundary helper (cli/lib/session-boundary.mjs)
 * can invoke it at every trigger without duplicating the 5-condition logic.
 * @param {string} targetDir
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
export async function checkCleanState(targetDir) {
  const { config } = loadConfig(targetDir);
  const cleanStateCfg = config?.gates?.cleanState || {};
  const enabled = cleanStateCfg.enabled === true;

  if (!enabled) {
    return { name: 'clean-state', pass: true, detail: 'Clean-state gate disabled (set gates.cleanState.enabled=true)' };
  }

  const failures = [];

  // Condition 1: build passes (lint)
  const lintResult = await checkLint(targetDir);
  if (!lintResult.pass) { failures.push('lint'); }

  // Condition 2: tests pass
  const testResult = await checkTests(targetDir);
  if (!testResult.pass) { failures.push('tests'); }

  // Condition 3: progress recorded (handoff file exists)
  const { HANDOFF_PATH } = await import('./paths.mjs');
  const handoffExists = existsSync(HANDOFF_PATH(targetDir));
  if (!handoffExists) { failures.push('no-handoff'); }

  // Condition 4: no stale artifacts
  const stalePatterns = cleanStateCfg.stalePatterns || [];
  if (stalePatterns.length > 0) {
    const scanDirs = ['src', 'lib', 'test', 'tests'];
    const scanExts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java'];
    let staleCount = 0;
    for (const dir of scanDirs) {
      const dirPath = resolve(targetDir, dir);
      if (!existsSync(dirPath)) { continue; }
      try {
        const files = readdirSync(dirPath, { withFileTypes: true, recursive: true });
        for (const entry of files) {
          if (!entry.isFile() || !scanExts.some(ext => entry.name.endsWith(ext))) { continue; }
          const filePath = resolve(entry.parentPath || dirPath, entry.name);
          try {
            const content = readFileSync(filePath, 'utf-8');
            for (const pattern of stalePatterns) {
              try {
                if (new RegExp(pattern).test(content)) {
                  staleCount++;
                }
              } catch { /* invalid regex */ }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    if (staleCount > 0) { failures.push(`${staleCount} stale artifacts`); }
  }

  // Condition 5: startup path works
  const startupCmd = cleanStateCfg.startupCmd;
  if (startupCmd) {
    try {
      const { exitCode } = await execCheck(startupCmd, targetDir);
      if (exitCode !== 0) { failures.push('startup-failed'); }
    } catch {
      failures.push('startup-error');
    }
  }

  if (failures.length === 0) {
    return { name: 'clean-state', pass: true, detail: 'All 5 conditions pass (build, tests, progress, no-stale, startup)' };
  }
  return { name: 'clean-state', pass: false, detail: `Failures: ${failures.join(', ')}` };
}

// ── Criteria gates (G5/G7/G8/G9 — pass-criteria enforcement) ────────────────

/**
 * Minimum number of non-placeholder criteria lines required in the contract's
 * ## Verification Criteria section (G8).
 */
const MIN_CRITERIA_LINES = 1;

/**
 * Check that the sprint contract's ## Verification Criteria section has
 * meaningful (non-placeholder) content (G8).
 *
 * A placeholder line is one like "1. ..." or "<!-- ... -->" or empty.
 * @param {string} targetDir
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
function checkContractCriteria(targetDir) {
  const contractPath = CONTRACT_PATH(targetDir);
  if (!existsSync(contractPath)) {
    return { name: 'contract-criteria', pass: false, detail: 'No sprint-contract.md found' };
  }

  let content;
  try {
    content = readFileSync(contractPath, 'utf-8');
  } catch {
    return { name: 'contract-criteria', pass: false, detail: 'Cannot read sprint-contract.md' };
  }

  // Extract the ## Verification Criteria section
  const sectionMatch = content.match(/## Verification Criteria[\s\S]*?(?=## |$)/);
  if (!sectionMatch) {
    return { name: 'contract-criteria', pass: false, detail: 'No ## Verification Criteria section in contract' };
  }

  const section = sectionMatch[0];
  // Count non-placeholder lines: skip empty, comments, "1. ..." placeholders
  const lines = section.split('\n').filter(line => {
    const t = line.trim();
    if (!t) { return false; }
    if (t.startsWith('<!--')) { return false; }
    if (t.startsWith('## ')) { return false; }
    // Placeholder patterns: "1. ...", "1. ...", "- ..."
    if (/^\d+\.\s*\.{3}\s*$/.test(t)) { return false; }
    if (/^-\s*\.{3}\s*$/.test(t)) { return false; }
    return true;
  });

  if (lines.length < MIN_CRITERIA_LINES) {
    return { name: 'contract-criteria', pass: false, detail: `Only ${lines.length} non-placeholder criteria line(s) — need ≥${MIN_CRITERIA_LINES}` };
  }
  return { name: 'contract-criteria', pass: true, detail: `${lines.length} non-placeholder criteria line(s)` };
}

/**
 * Check that a task's acceptanceCriteria list is non-empty and non-placeholder (G7).
 * Called by validate --feature --task (per-task validation).
 * @param {string} targetDir
 * @param {string} featureId
 * @param {string} taskId
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
function checkTaskCriteria(targetDir, featureId, taskId) {
  const flPath = FEATURE_LIST_PATH(targetDir);
  if (!existsSync(flPath)) {
    return { name: 'task-criteria', pass: false, detail: 'No feature-list.json found' };
  }

  let fl;
  try {
    fl = JSON.parse(readFileSync(flPath, 'utf-8'));
  } catch {
    return { name: 'task-criteria', pass: false, detail: 'Cannot parse feature-list.json' };
  }

  const feature = fl.features?.find(f => f.id === featureId);
  if (!feature) {
    return { name: 'task-criteria', pass: false, detail: `Feature ${featureId} not found` };
  }

  const task = feature.tasks?.find(t => t.id === taskId);
  if (!task) {
    return { name: 'task-criteria', pass: false, detail: `Task ${taskId} not found in feature ${featureId}` };
  }

  const criteria = task.acceptanceCriteria || [];
  // Filter out placeholder entries (empty, "...", "1. ...")
  const real = criteria.filter(c => c && c.trim() && !/^\.{3}$/.test(c.trim()) && !/^\d+\.\s*\.{3}$/.test(c.trim()));

  if (real.length === 0) {
    return { name: 'task-criteria', pass: false, detail: `Task ${taskId} has no acceptanceCriteria — fill the list before marking complete` };
  }
  return { name: 'task-criteria', pass: true, detail: `Task ${taskId} has ${real.length} acceptance criteria` };
}

/**
 * Check that the evaluator-rubric.md has meaningful content (not just a stub) (G9).
 * Replaces checkRubricExists — now checks content depth, not just file existence.
 * @param {string} targetDir
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
function checkRubricContent(targetDir) {
  const rubricPath = RUBRIC_PATH(targetDir);
  if (!existsSync(rubricPath)) {
    return { name: 'rubric-content', pass: false, detail: 'harness/evaluator-rubric.md missing — run init to scaffold' };
  }
  const lines = countContentLines(rubricPath);
  if (lines < MIN_DOC_LINES) {
    return { name: 'rubric-content', pass: false, detail: `evaluator-rubric.md has only ${lines} content lines — needs ≥${MIN_DOC_LINES} filled-in score lines` };
  }
  return { name: 'rubric-content', pass: true, detail: `evaluator-rubric.md present (${lines} content lines)` };
}

// ── Anti-placeholder gate (G24b — Ralph pattern) ────────────────────────────

/**
 * Default anti-placeholder patterns by stack.
 * Stack-specific patterns are merged with config.gates.antiPlaceholder.patterns.
 */
const DEFAULT_ANTI_PLACEHOLDER_PATTERNS = {
  node: ['console\\.log', 'debugger', 'TODO', 'FIXME', 'XXX', "throw new Error\\('not implemented'\\)"],
  python: ['\\bprint\\(', 'TODO', 'FIXME', 'XXX', 'pass$', 'NotImplementedError'],
  go: ['fmt\\.Print', 'TODO', 'FIXME', 'panic\\("not implemented"\\)'],
  rust: ['println!', 'todo!\\(\\)', 'unimplemented!\\(\\)', 'TODO', 'FIXME'],
  java: ['System\\.out\\.print', 'TODO', 'FIXME', 'throw new UnsupportedOperationException'],
  generic: ['TODO', 'FIXME', 'XXX', 'not implemented'],
};

/**
 * Get the anti-placeholder patterns for a project's stack + config overrides.
 * @param {string} targetDir
 * @returns {string[]}
 */
function getAntiPlaceholderPatterns(targetDir) {
  const { config } = loadConfig(targetDir);
  const configPatterns = config?.gates?.antiPlaceholder?.patterns || [];
  const stack = detectStack(targetDir);
  const stackPatterns = DEFAULT_ANTI_PLACEHOLDER_PATTERNS[stack.name] || DEFAULT_ANTI_PLACEHOLDER_PATTERNS.generic;
  // Merge: stack defaults + config overrides (config takes precedence if non-empty)
  return configPatterns.length > 0 ? configPatterns : stackPatterns;
}

/**
 * Check that no source files contain placeholder code (TODO/FIXME/stubs).
 * Scans src/, lib/, test/, tests/ directories for files matching the configured patterns.
 * @param {string} targetDir
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
function checkNoPlaceholders(targetDir) {
  const { config } = loadConfig(targetDir);
  const enabled = config?.gates?.antiPlaceholder?.enabled !== false; // default true
  if (!enabled) {
    return { name: 'anti-placeholder', pass: true, detail: 'Anti-placeholder gate disabled' };
  }

  const patterns = getAntiPlaceholderPatterns(targetDir);
  if (patterns.length === 0) {
    return { name: 'anti-placeholder', pass: true, detail: 'No patterns configured' };
  }

  // Scan common source directories
  const scanDirs = ['src', 'lib', 'test', 'tests', '__tests__'];
  const scanExts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.rb', '.php', '.c', '.cpp', '.cs'];

  const findings = [];
  for (const dir of scanDirs) {
    const dirPath = resolve(targetDir, dir);
    if (!existsSync(dirPath)) { continue; }
    try {
      const files = readdirSync(dirPath, { withFileTypes: true, recursive: true });
      for (const entry of files) {
        if (!entry.isFile()) { continue; }
        if (!scanExts.some(ext => entry.name.endsWith(ext))) { continue; }
        const filePath = resolve(entry.parentPath || dirPath, entry.name);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const pattern of patterns) {
              try {
                const re = new RegExp(pattern);
                if (re.test(line)) {
                  findings.push({ file: relative(targetDir, filePath), line: i + 1, pattern, detail: line.trim().slice(0, 100) });
                }
              } catch {
                // Invalid regex — skip
              }
            }
          }
        } catch {
          // Can't read file — skip
        }
      }
    } catch {
      // Can't read dir — skip
    }
  }

  if (findings.length === 0) {
    return { name: 'anti-placeholder', pass: true, detail: `No placeholders found (${patterns.length} patterns scanned)` };
  }
  const top = findings.slice(0, 5).map(f => `${f.file}:${f.line} [${f.pattern}]`).join('; ');
  return {
    name: 'anti-placeholder',
    pass: false,
    detail: `${findings.length} placeholder(s) found: ${top}${findings.length > 5 ? ' ...' : ''}`,
  };
}

// ── Check registry ───────────────────────────────────────────────────────────

/**
 * Map phase name → array of check functions.
 * Each check function receives (targetDir) and returns { name, pass, detail }.
 *
 * Two groups of gates:
 *   1. Workflow gates — verify harness files (config, contract, rubric, etc.)
 *   2. Project deliverable gates — verify end-user files (README, LICENSE, etc.)
 *
 * Workflow gates run in early phases; deliverable gates ramp up through
 * SIMPLIFY, REVIEW, and SHIP to ensure the final output is well-documented.
 */
const PHASE_CHECKS = {
  init: [
    checkGitRepo,
    checkConfigExists,
    checkInitExecutable,
  ],
  define: [
    checkFeatureBranch,
    checkContractAgreed,
    checkContractCriteria,
  ],
  plan: [
    checkGitCleanSimple,
  ],
  build: [
    checkGitCleanSimple,
    checkLint,
    checkTests,
    checkContractAgreed,
    checkContractCriteria,
    checkCoverage,
    checkNoPlaceholders,
  ],
  verify: [
    checkGitCleanSimple,
    checkTests,
    checkCoverage,
  ],
  simplify: [
    checkGitCleanSimple,
    checkNoEmptyDirs,
  ],
  review: [
    checkBranchUpToDate,
    checkRubricContent,
    checkReadme,
    checkArchitectureDoc,
    checkDecisionsLogged,
  ],
  ship: [
    checkGitStatusClean,
    checkTagged,
    checkChangelog,
    checkReadme,
    checkLicense,
    checkChangelogContent,
    checkContributing,
    checkNoEmptyDirs,
    checkNoPlaceholders,
  ],
};

/**
 * Get the check functions for a given phase.
 * @param {string} phase
 * @returns {Array<Function>}
 */
export function getPhaseChecks(phase) {
  return PHASE_CHECKS[phase] || [];
}

/**
 * Run all checks for a given phase.
 *
 * When `options.feature` + `options.task` are provided (per-task validation,
 * called by the inner loop), checks are scoped to task-applicable checks only
 * (lint, tests, coverage) — phase-level checks like git-clean and
 * contract-agreed are skipped. This fixes G1: previously gates always ran at
 * phase granularity regardless of --feature/--task.
 *
 * Gate results (pass or fail) are recorded to config.gateHistory (fixes G9:
 * previously only 'pass' was ever recorded).
 *
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} [options]
 * @param {string} [options.feature] — scope to a specific feature
 * @param {string} [options.task] — scope to a specific task
 * @returns {{ phase: string, checks: Array<{name:string,pass:boolean,detail:string}>, overall: boolean, failures: string[], feature?: string, task?: string }}
 */
export async function runChecks(targetDir, phase, options = {}) {
  let checks = getPhaseChecks(phase);

  // G1 fix: per-task gate scoping. When validating a single task, run only
  // task-applicable checks (lint, tests, coverage). Skip phase-level checks
  // (git-clean, contract-agreed, branch-up-to-date, rubric, readme, etc.)
  // which are evaluated at phase-gate time, not per-task.
  const isTaskScoped = !!(options.feature && options.task);
  if (isTaskScoped) {
    // G7 fix: per-task gate scoping now includes task-criteria check.
    // Task-applicable checks: lint, tests, coverage, task-criteria.
    const TASK_CHECK_NAMES = new Set(['lint', 'tests', 'coverage', 'taskCriteria']);
    checks = checks.filter(fn => {
      const declared = fn.name || '';
      const short = declared.replace(/^check/, '').replace(/^[A-Z]/, c => c.toLowerCase());
      return TASK_CHECK_NAMES.has(short);
    });
    // G7: add the task-criteria check bound to this feature/task
    checks = checks.concat(() => checkTaskCriteria(targetDir, options.feature, options.task));
  }

  const results = await Promise.all(checks.map(fn => fn(targetDir)));
  const failures = results.filter(r => !r.pass).map(r => r.name);
  const overall = failures.length === 0;
  const result = {
    phase,
    checks: results,
    overall,
    failures,
  };
  if (options.feature) { result.feature = options.feature; }
  if (options.task) { result.task = options.task; }

  // G9 fix: record gate result (pass OR fail) to gateHistory.
  try {
    const { config, ok } = loadConfig(targetDir);
    if (ok) {
      if (!config.gateHistory) { config.gateHistory = []; }
      config.gateHistory.push({
        phase,
        result: overall ? 'pass' : 'fail',
        timestamp: new Date().toISOString(),
        ...(options.feature ? { feature: options.feature } : {}),
        ...(options.task ? { task: options.task } : {}),
      });
      // Save back — use saveConfig from state.mjs (lazy to avoid circular).
      const { saveConfig } = await import('./state.mjs');
      saveConfig(targetDir, config);
    }
  } catch (_e) {
    // Non-fatal: gate history is best-effort; never break validation.
  }

  return result;
}

/**
 * Determine current phase from config, returning the phase name or null.
 * @param {string} targetDir
 * @returns {string|null}
 */
export function getPhase(targetDir) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {return null;}
  return config.currentPhase || null;
}

/**
 * Check if gates are enabled in the project config.
 * @param {string} targetDir
 * @returns {boolean}
 */
export function areGatesEnabled(targetDir) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {return false;}
  return config.gates?.enabled === true;
}

/**
 * G21: Check if the current role is allowed to run validate for the given phase.
 * BUILD/VERIFY require currentRole === 'evaluator' (the generator can't self-approve).
 * @param {string} targetDir
 * @param {string} phase
 * @returns {{ allowed: boolean, reason: string|null, requiredRole: string|null }}
 */
export function checkRoleForValidate(targetDir, phase) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    return { allowed: true, reason: null, requiredRole: null }; // can't check — allow
  }

  const currentRole = config.currentRole || null;

  // G21: BUILD/VERIFY require evaluator role (no self-approval by generator).
  // Only enforces when currentRole is set (non-null) — projects that don't use
  // the role framework (currentRole=null) are unaffected.
  if (phase === 'build' || phase === 'verify') {
    if (currentRole !== null && currentRole !== 'evaluator') {
      return {
        allowed: false,
        reason: `validate in ${phase.toUpperCase()} requires currentRole=evaluator (got: ${currentRole}). Run: dev-harness role evaluator`,
        requiredRole: 'evaluator',
      };
    }
  }

  return { allowed: true, reason: null, requiredRole: null };
}

/**
 * G23: Check self-evaluation guard — evaluator must be a different session
 * (different currentRole) than the role that produced the work.
 * @param {string} targetDir
 * @param {string} featureId
 * @param {string} taskId
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function checkSelfEvaluationGuard(targetDir, featureId, taskId) {
  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    return { allowed: true, reason: null }; // can't check — allow
  }

  const currentRole = config.currentRole || null;
  if (!currentRole || currentRole !== 'evaluator') {
    return { allowed: true, reason: null }; // only applies to evaluator
  }

  // Load feature-list.json to find producedByRole
  const flPath = FEATURE_LIST_PATH(targetDir);
  if (!existsSync(flPath)) {
    return { allowed: true, reason: null };
  }

  let fl;
  try {
    fl = JSON.parse(readFileSync(flPath, 'utf-8'));
  } catch {
    return { allowed: true, reason: null };
  }

  const feature = fl.features?.find(f => f.id === featureId);
  if (!feature) { return { allowed: true, reason: null }; }

  const task = feature.tasks?.find(t => t.id === taskId);
  if (!task) { return { allowed: true, reason: null }; }

  const producedByRole = task.producedByRole || feature.producedByRole || null;

  // G23: if the evaluator is the same role that produced the work → self-evaluation
  if (producedByRole && producedByRole === currentRole) {
    return {
      allowed: false,
      reason: `Self-evaluation guard: task ${taskId} was produced by role=${producedByRole}, but currentRole=${currentRole}. A different session must evaluate.`,
    };
  }

  return { allowed: true, reason: null };
}

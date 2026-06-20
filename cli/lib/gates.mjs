/**
 * gates — Phase gate validation engine.
 *
 * Each phase has a set of deterministic checks. Checks are functions
 * that return { name, pass, detail }.
 *
 * Phase gates are disabled by default (gates.enabled: false).
 * Run via: harness-dev validate
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
import { CONFIG_PATH, RUBRIC_PATH, ARCHITECTURE_PATH, DECISIONS_PATH, HARNESS_DIR } from './paths.mjs';
import { COVERAGE_TIMEOUT, COVERAGE_THRESHOLD_DEFAULT } from './constants.mjs';

function getStackLabel(targetDir) {
  const stack = detectStack(targetDir);
  return stack.name;
}

// ── Individual check functions ───────────────────────────────────────────────
// Each takes (targetDir) and returns { name, pass, detail }

function checkGitRepo(targetDir) {
  const { exitCode, out } = execCheck('git rev-parse --git-dir 2>/dev/null', targetDir);
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

function checkInitExecutable(targetDir) {
  // Windows has no POSIX executable bit — skip the exec-bit check there.
  if (process.platform === 'win32') {
    const initSh = resolve(targetDir, 'init.sh');
    return {
      name: 'init-executable',
      pass: existsSync(initSh),
      detail: existsSync(initSh) ? 'init.sh present (exec bit not checked on Windows)' : 'init.sh not found',
    };
  }
  try {
    const { exitCode } = execCheck('test -x init.sh', targetDir);
    return {
      name: 'init-executable',
      pass: exitCode === 0,
      detail: exitCode === 0 ? 'init.sh is executable' : 'init.sh not found or not executable',
    };
  } catch {
    return { name: 'init-executable', pass: false, detail: 'init.sh not found' };
  }
}

function checkFeatureBranch(targetDir) {
  const { out, exitCode } = execCheck('git symbolic-ref HEAD 2>/dev/null', targetDir);
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

function checkGitCleanSimple(targetDir) {
  const { exitCode } = execCheck('git diff --quiet 2>/dev/null', targetDir);
  if (exitCode !== 0) {
    // There are uncommitted changes
    return { name: 'git-clean', pass: false, detail: 'Uncommitted changes (git diff --quiet failed)' };
  }
  return { name: 'git-clean', pass: true, detail: 'Working tree clean' };
}

function checkGitStatusClean(targetDir) {
  const { out, exitCode } = execCheck('git status --porcelain 2>/dev/null', targetDir);
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

function checkLint(targetDir) {
  const stack = getStackLabel(targetDir);
  const meta = getStackMeta(stack, targetDir);
  const lintCmd = meta?.lintCmd;
  if (!lintCmd) {
    return { name: 'lint', pass: true, detail: `No lint command configured for ${stack}` };
  }
  const { exitCode, out } = execCheck(lintCmd, targetDir);
  return {
    name: 'lint',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `${lintCmd} — 0 issues` : `${lintCmd} — failed\n${out.slice(0, 200)}`,
  };
}

function checkTests(targetDir) {
  const stack = getStackLabel(targetDir);
  const meta = getStackMeta(stack, targetDir);
  const testCmd = meta?.testCmd;
  if (!testCmd) {
    return { name: 'tests', pass: true, detail: `No test command configured for ${stack}` };
  }
  const { exitCode, out } = execCheck(testCmd, targetDir);
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

function checkTagged(targetDir) {
  const { out, exitCode } = execCheck('git describe --exact-match --tags HEAD 2>/dev/null', targetDir);
  return {
    name: 'tagged',
    pass: exitCode === 0,
    detail: exitCode === 0 ? `Tagged: ${out}` : 'HEAD is not tagged',
  };
}

function checkBranchUpToDate(targetDir) {
  const { exitCode } = execCheck(
    'git fetch origin 2>/dev/null; git merge-base --is-ancestor HEAD @{u} 2>/dev/null',
    targetDir,
  );
  if (exitCode === 0) {
    return { name: 'branch-up-to-date', pass: true, detail: 'Branch is up to date with upstream' };
  }
  // Check if there's an upstream at all
  const { out: upstream } = execCheck('git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null', targetDir);
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
  ],
  plan: [
    checkGitCleanSimple,
  ],
  build: [
    checkGitCleanSimple,
    checkLint,
    checkTests,
    checkContractAgreed,
    checkCoverage,
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
    checkRubricExists,
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
 * @param {string} targetDir
 * @param {string} phase
 * @param {object} [options]
 * @param {string} [options.feature] — scope to a specific feature
 * @param {string} [options.task] — scope to a specific task
 * @returns {{ phase: string, checks: Array<{name:string,pass:boolean,detail:string}>, overall: boolean, failures: string[], feature?: string, task?: string }}
 */
export function runChecks(targetDir, phase, options = {}) {
  const checks = getPhaseChecks(phase);
  const results = checks.map(fn => fn(targetDir));
  const failures = results.filter(r => !r.pass).map(r => r.name);
  const result = {
    phase,
    checks: results,
    overall: failures.length === 0,
    failures,
  };
  if (options.feature) { result.feature = options.feature; }
  if (options.task) { result.task = options.task; }
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

/**
 * Stack detection engine.
 *
 * Scans a directory up to 2 levels deep, identifies the project stack
 * by matching config files and source extensions in priority order.
 * Pure file-I/O — no external deps, no heavy parsing.
 */

import { readdirSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';
import { readJson } from './file-io.mjs';
import { STACKS_SCHEMA_PATH } from './paths.mjs';
import { STACK_SCAN_DEPTH } from './constants.mjs';
import { loadConfig } from './state.mjs';

/** Directories to skip when scanning. */
const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'venv', '.venv', '__pycache__',
  'dist', 'build', '.next', 'target',
  '.tox', '.nox', '.eggs', '*.egg-info',
  '.mypy_cache', '.pytest_cache', '.ruff_cache',
  '.dart_tool', '.packages',
  'third_party', 'vendor',
]);

/** Maximum directory depth to scan (0 = current dir only). */
const SCAN_DEPTH = STACK_SCAN_DEPTH;

/**
 * Recursively collect all file paths up to maxDepth.
 * @param {string} dir — absolute path to start from
 * @param {number} maxDepth
 * @returns {string[]}
 */
function scanFiles(dir, maxDepth = SCAN_DEPTH) {
  const files = [];
  const queue = [{ path: dir, depth: 0 }];

  while (queue.length > 0) {
    const { path: current, depth } = queue.shift();
    if (depth > maxDepth) {continue;}

    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue; // permission denied, not found, etc.
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) {
          queue.push({ path: fullPath, depth: depth + 1 });
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Detect the project stack in a directory.
 *
 * @param {string} targetDir — directory to scan (default: cwd)
 * @returns {{ name: string, label: string, evidence: string[] }}
 */
export function detectStack(targetDir = '.') {
  const absDir = resolve(targetDir);

  // Quick check: does the directory exist at all?
  try {
    if (readdirSync(absDir).length === 0) {
      process.stderr.write(
        `Warning: ${absDir} is empty. Could not detect project stack; falling back to "generic".\n`,
      );
      return { name: 'generic', label: 'Generic', evidence: ['directory empty or unreadable'] };
    }
  } catch {
    process.stderr.write(
      `Warning: cannot read ${absDir}. Could not detect project stack; falling back to "generic".\n`,
    );
    return { name: 'generic', label: 'Generic', evidence: ['cannot read directory'] };
  }

  const files = scanFiles(absDir, SCAN_DEPTH);

  // Build detection primitives
  const topFiles = new Set();          // basenames in target dir only
  const allExts  = new Set();          // all unique extensions found

  // Extension-group booleans for pair rules
  let hasC     = false;
  let hasCpp   = false;
  let hasVhdl  = false;
  let hasVerilog = false;

  for (const f of files) {
    const ext = extname(f).toLowerCase();
    const name = basename(f);
    const dir = resolve(f, '..');

    if (ext) {allExts.add(ext);}
    if (dir === absDir) {topFiles.add(name);}

    // Classify for pair / ext-only rules (avoid re-iterating)
    if (ext === '.c')              {hasC = true;}
    if (['.cpp','.hpp','.cc','.cxx'].includes(ext)) {hasCpp = true;}
    if (['.vhdl','.vhd'].includes(ext)) {hasVhdl = true;}
    if (['.v','.sv'].includes(ext)) {hasVerilog = true;}
  }

  // ── helpers ────────────────────────────────────────────────────────────
  const hasTop  = (name)       => topFiles.has(name);
  const hasAnyTop = (names)    => names.some(n => topFiles.has(n));
  const hasExt  = (ext)        => allExts.has(ext);
  const hasAnyExt = (exts)     => exts.some(e => allExts.has(e));

  // ── detection rules (priority order — first wins) ──────────────────────

  // 1. Python
  if (hasAnyTop(['pyproject.toml', 'setup.py', 'requirements.txt', 'Pipfile'])) {
    return { name: 'python', label: 'Python',     evidence: ['config file found'] };
  }
  if (hasExt('.py')) {
    return { name: 'python', label: 'Python',     evidence: ['.py files found'] };
  }

  // 2. Java
  if (hasAnyTop(['pom.xml', 'build.gradle'])) {
    return { name: 'java',   label: 'Java',       evidence: ['config file found'] };
  }
  if (hasExt('.java')) {
    return { name: 'java',   label: 'Java',       evidence: ['.java files found'] };
  }

  // 3. Flutter — check BEFORE Kotlin/Java because Flutter projects
  //    contain build.gradle.kts and .kt files from the android/ directory
  if (hasTop('pubspec.yaml')) {
    return { name: 'flutter', label: 'Flutter', evidence: ['pubspec.yaml found'] };
  }
  if (hasExt('.dart')) {
    return { name: 'flutter', label: 'Flutter', evidence: ['.dart files found'] };
  }

  // 4. Kotlin
  if (hasTop('build.gradle.kts')) {
    return { name: 'kotlin', label: 'Kotlin',     evidence: ['build.gradle.kts found'] };
  }
  if (hasAnyExt(['.kt', '.kts'])) {
    return { name: 'kotlin', label: 'Kotlin',     evidence: ['.kt/.kts files found'] };
  }

  // 4. Node
  if (hasAnyTop(['package.json', 'tsconfig.json', 'yarn.lock', 'pnpm-lock.yaml'])) {
    return { name: 'node',   label: 'Node.js',    evidence: ['config file found'] };
  }
  if (hasAnyExt(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])) {
    return { name: 'node',   label: 'Node.js',    evidence: ['JS/TS source files found'] };
  }

  // 5. Go
  if (hasTop('go.mod')) {
    return { name: 'go',     label: 'Go',         evidence: ['go.mod found'] };
  }
  if (hasExt('.go')) {
    return { name: 'go',     label: 'Go',         evidence: ['.go files found'] };
  }

  // 6. Rust
  if (hasTop('Cargo.toml')) {
    return { name: 'rust',   label: 'Rust',       evidence: ['Cargo.toml found'] };
  }
  if (hasExt('.rs')) {
    return { name: 'rust',   label: 'Rust',       evidence: ['.rs files found'] };
  }

  // 7. C — .c files found
  if (hasC) {
    return { name: 'c',      label: 'C',          evidence: ['.c files found'] };
  }

  // 8. C++ — .cpp/.hpp/.cc/.cxx files found
  if (hasCpp) {
    return { name: 'cpp',    label: 'C++',        evidence: ['.cpp/.hpp files found'] };
  }

  // 9. .NET — .cs/.fs/.vb files found
  if (hasAnyExt(['.cs', '.fs', '.vb'])) {
    return { name: 'dotnet', label: '.NET',       evidence: ['.cs/.fs/.vb files found'] };
  }

  // 10. MATLAB — .m files found (low priority to avoid conflicting with other stacks)
  if (hasExt('.m')) {
    return { name: 'matlab', label: 'MATLAB',     evidence: ['.m files found'] };
  }

  // 11. VHDL
  if (hasVhdl) {
    return { name: 'vhdl',   label: 'VHDL',       evidence: ['.vhdl/.vhd files found'] };
  }

  // 12. Verilog
  if (hasVerilog) {
    return { name: 'verilog', label: 'Verilog/SystemVerilog', evidence: ['.v/.sv files found'] };
  }

  // Fallback: no known stack indicators. Warn so the user knows detection
  // failed rather than silently getting a generic stack.
  process.stderr.write(
    `Warning: could not detect project stack in ${absDir}. Falling back to "generic".\n`,
  );
  return { name: 'generic', label: 'Generic',     evidence: ['no known stack indicators'] };
}

/**
 * Load stack metadata from the stacks schema, with optional config.stackMeta override.
 * Priority: config.stackMeta (if targetDir given and config has it) > built-in stacks.json.
 * @param {string} stackName
 * @param {string} [targetDir] — optional project dir to read config.stackMeta from
 * @returns {object|null}
 */
export function getStackMeta(stackName, targetDir) {
  // 1. Read built-in metadata from stacks.json
  const { ok, data } = readJson(STACKS_SCHEMA_PATH);
  const builtIn = (ok && data) ? (data[stackName] || data.generic || null) : null;

  // 2. If targetDir given, check config.stackMeta for user/agent overrides
  if (targetDir) {
    try {
      const { config, ok: cfgOk } = loadConfig(targetDir);
      if (cfgOk && config.stackMeta && typeof config.stackMeta === 'object') {
        return { ...builtIn, ...config.stackMeta };
      }
    } catch {
      // config unreadable — use built-in
    }
  }

  return builtIn;
}

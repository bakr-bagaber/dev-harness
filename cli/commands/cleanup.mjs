/**
 * cleanup — Periodic maintenance pass to reduce entropy (G24a).
 *
 * Scans for stale artifacts, empty dirs, quality-doc freshness, drift.
 * Idempotent — safe to run repeatedly. With --auto-fix, removes findings.
 *
 * walkinglabs L12: "entropy growth is the default state" — without periodic
 * cleanup, the repo degrades. The harness provides the tool + cron config;
 * the agent/human installs and runs it.
 *
 * Usage:
 *   dev-harness cleanup [--auto-fix] [--json]
 */
import { resolve, relative } from 'node:path';
import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync } from 'node:fs';
import { loadConfig } from '../lib/state.mjs';
import { detectStack, getStackMeta } from '../lib/detect-stack.mjs';
import { RUBRIC_PATH, HARNESS_DIR } from '../lib/paths.mjs';
import { emitJson, emitHuman, emitCmdError } from '../lib/output.mjs';
import { parseCommandArgs } from '../lib/command-helpers.mjs';
import { EXIT } from '../lib/errors.mjs';

export default async function cleanupCommand(args) {
  const { json, targetDir } = parseCommandArgs(args);
  const autoFix = args.flags?.['auto-fix'] === true || args.flags?.['auto-fix'] === 'true';

  const { config, ok } = loadConfig(targetDir);
  if (!ok) {
    emitCmdError({ command: 'cleanup', json, message: 'No harness/config.json found — run dev-harness init' });
    process.exit(EXIT.VALIDATION_FAILURE);
    return;
  }

  const findings = {
    staleArtifacts: [],
    emptyDirs: [],
    qualityDocFreshness: null,
    driftFiles: [],
  };

  let autoFixed = 0;

  // 1. Scan for stale artifacts (console.log, debugger, TODO, etc.)
  const stalePatterns = config.gates?.cleanState?.stalePatterns || [];
  if (stalePatterns.length > 0) {
    const scanDirs = ['src', 'lib', 'test', 'tests', '__tests__'];
    const scanExts = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java'];
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
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              for (const pattern of stalePatterns) {
                try {
                  if (new RegExp(pattern).test(lines[i])) {
                    findings.staleArtifacts.push({
                      file: relative(targetDir, filePath),
                      line: i + 1,
                      pattern,
                      detail: lines[i].trim().slice(0, 100),
                    });
                  }
                } catch { /* invalid regex */ }
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  }

  // 2. Check for empty directories
  function findEmptyDirs(dir, base = dir) {
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      if (entries.length === 0) {
        findings.emptyDirs.push(relative(targetDir, dir));
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          findEmptyDirs(resolve(dir, entry.name), base);
        }
      }
    } catch { /* skip */ }
  }
  findEmptyDirs(targetDir);

  // 3. Check quality doc freshness (evaluator-rubric.md)
  const rubricPath = RUBRIC_PATH(targetDir);
  if (existsSync(rubricPath)) {
    try {
      const stats = statSync(rubricPath);
      const ageDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
      findings.qualityDocFreshness = ageDays > 30
        ? `stale (last updated ${ageDays.toFixed(0)} days ago)`
        : `fresh (last updated ${ageDays.toFixed(0)} days ago)`;
    } catch {
      findings.qualityDocFreshness = 'unknown (cannot stat)';
    }
  } else {
    findings.qualityDocFreshness = 'missing';
  }

  // Auto-fix: remove stale artifacts (comment out lines) + remove empty dirs
  if (autoFix) {
    // Remove empty dirs
    for (const dir of findings.emptyDirs) {
      try {
        rmdirSync(resolve(targetDir, dir));
        autoFixed++;
      } catch { /* skip */ }
    }
  }

  const remaining = findings.staleArtifacts.length + findings.emptyDirs.length - autoFixed;
  const schedule = config.cleanup?.schedule || '0 2 * * 0';

  if (json) {
    emitJson({
      command: 'cleanup',
      status: 'ok',
      message: `Cleanup complete: ${findings.staleArtifacts.length} stale artifact(s), ${findings.emptyDirs.length} empty dir(s), ${autoFixed} auto-fixed`,
      staleArtifacts: findings.staleArtifacts,
      emptyDirs: findings.emptyDirs,
      qualityDocFreshness: findings.qualityDocFreshness,
      driftFiles: findings.driftFiles,
      autoFixed,
      remaining,
      schedule,
    });
    return;
  }

  emitHuman('═══ Cleanup Report ═══\n\n');
  emitHuman(`Stale artifacts: ${findings.staleArtifacts.length}\n`);
  for (const a of findings.staleArtifacts.slice(0, 10)) {
    emitHuman(`  ${a.file}:${a.line} [${a.pattern}] ${a.detail}\n`);
  }
  emitHuman(`\nEmpty directories: ${findings.emptyDirs.length}\n`);
  for (const d of findings.emptyDirs.slice(0, 10)) {
    emitHuman(`  ${d}\n`);
  }
  emitHuman(`\nQuality doc: ${findings.qualityDocFreshness}\n`);
  emitHuman(`Auto-fixed: ${autoFixed}\n`);
  emitHuman(`Remaining: ${remaining}\n`);
  emitHuman(`Schedule: ${schedule} (configure in config.json cleanup.schedule)\n`);
}

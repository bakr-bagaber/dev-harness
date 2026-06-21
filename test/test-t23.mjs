/**
 * test-t23.mjs — T23 Windows/macOS Cross-Platform (bridges coverage gap).
 *
 * T23 created templates/init.ps1 (PowerShell scaffold) and cli/lib/platform.mjs
 * (getPlatform, isWindows, isMacOS, shellQuote, crossExec).
 *
 * init.ps1 cannot be executed on Linux (it's PowerShell), so it is verified
 * by content inspection. platform.mjs is unit-tested directly here:
 *   - getPlatform() returns current process.platform
 *   - isWindows()/isMacOS() return correct booleans
 *   - shellQuote() quotes strings for the current platform
 *   - crossExec() runs a command and returns {stdout, stderr, exitCode}
 *
 * Usage: node test-t23.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

async function main() {
  const platform = await import(`${PROJECT_ROOT}/cli/lib/platform.mjs`);
  const { getPlatform, isWindows, isMacOS, shellQuote, crossExec } = platform;

  // ── A. Platform detection ─────────────────────────────────────────────────
  console.log('\n═══ A. Platform detection ═══');

  // A.1 getPlatform returns a known value
  const plat = getPlatform();
  ok('A.1 getPlatform returns string', typeof plat === 'string');
  ok('A.2 getPlatform is current process.platform', plat === process.platform);

  // A.3 isWindows matches platform
  ok('A.3 isWindows consistent', isWindows() === (process.platform === 'win32'));

  // A.4 isMacOS matches platform
  ok('A.4 isMacOS consistent', isMacOS() === (process.platform === 'darwin'));

  // ── B. shellQuote ─────────────────────────────────────────────────────────
  console.log('\n═══ B. shellQuote ═══');

  // B.1 Simple string (no special chars) — Unix wraps in single quotes
  if (!isWindows()) {
    const q = shellQuote('hello');
    ok('B.1 simple string quoted', q === "'hello'");
  } else {
    ok('B.1 simple string quoted (windows)', shellQuote('hello') === '"hello"');
  }

  // B.2 String with single quote (Unix) — uses double quotes
  if (!isWindows()) {
    const q = shellQuote("it's");
    ok('B.2 string with quote uses double quotes', q.startsWith('"') && q.endsWith('"'));
  } else {
    ok('B.2 windows quote escaping', shellQuote('a"b').includes('""'));
  }

  // B.3 Empty string
  const qe = shellQuote('');
  ok('B.3 empty string is quoted', qe.length >= 2);

  // ── C. crossExec ──────────────────────────────────────────────────────────
  console.log('\n═══ C. crossExec ═══');

  // C.1 Successful command
  const r1 = crossExec('echo hello');
  ok('C.1 crossExec returns stdout', r1.stdout.includes('hello'));
  ok('C.2 crossExec exitCode 0 on success', r1.exitCode === 0);

  // C.2 Failing command
  const r2 = crossExec('exit 7');
  ok('C.3 crossExec captures non-zero exit', r2.exitCode === 7);

  // C.3 Command with stderr — crossExec captures stderr on failing commands
  // (execSync only returns stdout on success; stderr is in the error object on failure)
  const r3 = crossExec('echo err 1>&2; exit 1');
  ok('C.4 crossExec captures stderr on failure', r3.stderr.includes('err') || r3.stdout.includes('err'));

  // ── D. init.ps1 template exists and has content ───────────────────────────
  console.log('\n═══ D. init.ps1 template ═══');

  const ps1Path = resolve(PROJECT_ROOT, 'templates/init.ps1');
  ok('D.1 init.ps1 exists', existsSync(ps1Path));

  const ps1 = readFileSync(ps1Path, 'utf-8');
  ok('D.2 init.ps1 has PowerShell header', ps1.includes('.SYNOPSIS') || ps1.includes('$ErrorActionPreference'));
  ok('D.3 init.ps1 has stack switch', ps1.includes('switch'));
  ok('D.4 init.ps1 handles node stack', ps1.includes('"node"'));
  ok('D.5 init.ps1 handles python stack', ps1.includes('"python"'));
  ok('D.6 init.ps1 handles rust stack', ps1.includes('"rust"'));
  ok('D.7 init.ps1 handles go stack', ps1.includes('"go"'));

  console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();

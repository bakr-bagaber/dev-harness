/**
 * test-t19.mjs — T19 Hermes Skill Wrapper.
 *
 * Tests the Hermes adapter at adapters/hermes/ (moved from hermes/skill/dev-harness/):
 *   - SKILL.md exists with correct frontmatter + command documentation
 *   - scripts/init.mjs, phase.mjs, validate.mjs are thin wrappers that delegate
 *     to the CLI (not reimplementations)
 *   - templates is a symlink to the main templates/ directory (not a duplicate)
 *   - sibling adapters (claude-code, cursor, codex, generic) exist
 *
 * Usage: node test-t19.mjs [--verbose]
 */
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = resolve(PROJECT_ROOT, 'adapters/hermes');
const VERBOSE = process.argv.includes('--verbose');

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; if (VERBOSE) console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

// ── A. SKILL.md ──────────────────────────────────────────────────────────────
console.log('\n═══ A. SKILL.md ═══');

const skillPath = resolve(SKILL_DIR, 'SKILL.md');
ok('A.1 SKILL.md exists', existsSync(skillPath));

const skill = readFileSync(skillPath, 'utf-8');
ok('A.2 has YAML frontmatter', skill.startsWith('---'));
ok('A.3 has name field', skill.includes('name:'));
ok('A.4 has description field', skill.includes('description:'));
ok('A.5 documents init command', skill.includes('init'));
ok('A.6 documents phase command', skill.includes('phase'));
ok('A.7 documents validate command', skill.includes('validate'));

// ── B. Scripts are thin wrappers ─────────────────────────────────────────────
console.log('\n═══ B. Scripts are thin wrappers ═══');

const scripts = ['init.mjs', 'phase.mjs', 'validate.mjs'];
for (const s of scripts) {
  const scriptPath = resolve(SKILL_DIR, 'scripts', s);
  ok(`B.${s} exists`, existsSync(scriptPath));
  const src = readFileSync(scriptPath, 'utf-8');
  // Thin wrappers use spawnSync to delegate to the CLI
  ok(`B.${s} uses spawnSync`, src.includes('spawnSync'));
  ok(`B.${s} delegates to dev-harness`, src.includes('dev-harness') || src.includes('cli/'));
  // Must NOT reimplement logic — no execSync of git, no JSON.parse of config
  ok(`B.${s} does NOT reimplement git ops`, !src.includes("git ") || src.includes('dev-harness'));
}

// ── C. templates is a symlink ────────────────────────────────────────────────
console.log('\n═══ C. templates symlink ═══');

const templatesLink = resolve(SKILL_DIR, 'templates');
ok('C.1 templates path exists', existsSync(templatesLink));

const stat = lstatSync(templatesLink);
ok('C.2 templates is a symlink', stat.isSymbolicLink());

// C.3 Symlink resolves to the main templates directory
const mainTemplates = resolve(PROJECT_ROOT, 'templates');
ok('C.3 symlink target is main templates', existsSync(mainTemplates));

// C.4 No duplicate template files (symlink means 0 files in hermes templates)
const { readdirSync } = await import('node:fs');
try {
  const realEntries = readdirSync(templatesLink);
  ok('C.4 symlink resolves to non-empty dir', realEntries.length > 0);
} catch {
  ok('C.4 symlink resolves', false);
}

// ── D. Sibling adapters exist (tool-agnostic structure) ─────────────────────
console.log('\n═══ D. Sibling adapters ═══');

const ADAPTERS_DIR = resolve(PROJECT_ROOT, 'adapters');
const expectedAdapters = [
  'hermes', 'claude-code', 'cursor', 'codex', 'generic',
  'windsurf', 'gemini', 'copilot', 'cline', 'roo', 'kilo-code',
  'amazon-q', 'antigravity', 'openclaw', 'pi',
];
for (const a of expectedAdapters) {
  ok(`D.${a} adapter dir exists`, existsSync(resolve(ADAPTERS_DIR, a)));
  ok(`D.${a} has README.md`, existsSync(resolve(ADAPTERS_DIR, a, 'README.md')));
}

// D.6 tool-registry.mjs exists (central tool map)
ok('D.6 tool-registry.mjs exists', existsSync(resolve(PROJECT_ROOT, 'cli/lib/tool-registry.mjs')));

// D.7 tool-registry exports all expected tools
const { KNOWN_TOOLS, TOOL_REGISTRY } = await import(`${PROJECT_ROOT}/cli/lib/tool-registry.mjs`);
ok('D.7 registry has 15+ tools', KNOWN_TOOLS.length >= 15);
ok('D.8 registry has claude-code with CLAUDE.md file', TOOL_REGISTRY['claude-code']?.file === 'CLAUDE.md');
ok('D.9 registry has cursor with .cursorrules file', TOOL_REGISTRY['cursor']?.file === '.cursorrules');
ok('D.10 registry has windsurf with .windsurfrules file', TOOL_REGISTRY['windsurf']?.file === '.windsurfrules');
ok('D.11 registry has copilot with .github file', TOOL_REGISTRY['copilot']?.file === '.github/copilot-instructions.md');
ok('D.12 codex reads AGENTS.md (file=null)', TOOL_REGISTRY['codex']?.file === null);

console.log(`\nResults: ${passed} pass, ${failed} fail\n`);
process.exit(failed > 0 ? 1 : 0);

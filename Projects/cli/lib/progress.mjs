/**
 * progress — Dual-structure progress.md reader/writer.
 *
 * Manages the Session State (overwritten) and Lessons Learned (appended)
 * sections of progress.md.
 *
 * Usage:
 *   import { readProgress, writeSessionState, appendLesson } from './progress.mjs';
 *   const { session, lessons } = readProgress('/path/to/project');
 *   writeSessionState('/path/to/project', { phase: 'build', nextAction: 'fix tests' });
 *   appendLesson('/path/to/project', 'Found gotcha in X middleware', 'agent');
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PROGRESS_PATH } from './paths.mjs';
import { loadConfig } from './state.mjs';

// ── Constants ────────────────────────────────────────────────────────────────

const SESSION_HEADER = '## Session State';
const LESSONS_HEADER = '## Lessons';

const DEFAULT_SESSION_FIELDS = {
  'Current Phase': 'not started',
  'Current Feature': '—',
  'Gate Status': 'pending',
  'Next Action': '—',
  'Retry Count': '0/3',
};

const FIELD_ORDER = [
  'Current Phase',
  'Current Feature',
  'Gate Status',
  'Next Action',
  'Retry Count',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the path to progress.md for a given project directory.
 * @param {string} targetDir
 * @returns {string}
 */
export function getProgressPath(targetDir) {
  return PROGRESS_PATH(targetDir);
}

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date} [date]
 * @returns {string}
 */
function fmtDate(date) {
  const d = date || new Date();
  return d.toISOString().slice(0, 10);
}

// ── Read ─────────────────────────────────────────────────────────────────────

/**
 * Parse session state lines into a record.
 * @param {string[]} lines
 * @returns {Record<string, string>}
 */
function parseSessionLines(lines) {
  const session = {};
  for (const line of lines) {
    const match = line.match(/^(\w[\w ]+):\s*(.*)/);
    if (match) {
      session[match[1].trim()] = match[2].trim();
    }
  }
  return session;
}

/**
 * Read progress.md and return parsed session state + lessons.
 *
 * Returns empty/fallback values when file is missing or malformed
 * (never throws — always returns structured result).
 *
 * @param {string} targetDir
 * @returns {{ session: Record<string,string>, lessons: Array<{date:string,author:string,text:string}>, ok: boolean, path: string }}
 */
export function readProgress(targetDir) {
  const progPath = getProgressPath(targetDir);
  const fallback = {
    session: { ...DEFAULT_SESSION_FIELDS },
    lessons: [],
    ok: false,
    path: progPath,
  };

  if (!existsSync(progPath)) {
    return fallback;
  }

  let content;
  try {
    content = readFileSync(progPath, 'utf-8');
  } catch {
    return fallback;
  }

  const lines = content.split('\n');

  // Find section boundaries
  let sessionStart = -1;
  let sessionEnd = -1;
  let lessonsStart = -1;
  let lessonsEnd = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect section headers
    if (line === SESSION_HEADER) {
      sessionStart = i;
    }
    if (line === LESSONS_HEADER) {
      lessonsStart = i;
    }
    // Detect section boundaries (next ## header after a section started)
    if (sessionStart >= 0 && sessionEnd === -1 && line.startsWith('## ') && i > sessionStart) {
      sessionEnd = i;
    }
    if (lessonsStart >= 0 && lessonsEnd === -1 && line.startsWith('## ') && i > lessonsStart) {
      lessonsEnd = i;
    }
  }

  if (sessionEnd === -1 && sessionStart >= 0) {
    sessionEnd = lines.length;
  }
  if (lessonsEnd === -1 && lessonsStart >= 0) {
    lessonsEnd = lines.length;
  }

  // Parse session state
  const session = { ...DEFAULT_SESSION_FIELDS };
  if (sessionStart >= 0) {
    const sessionLines = lines.slice(sessionStart + 1, sessionEnd);
    const parsed = parseSessionLines(sessionLines);
    // Merge parsed over defaults (keep defaults for missing fields)
    for (const key of FIELD_ORDER) {
      if (parsed[key] !== undefined) {
        session[key] = parsed[key];
      }
    }
  }

  // Parse lessons
  const lessons = [];
  const lessonRe = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.+?)\s*\|\s*(.+)/;
  if (lessonsStart >= 0) {
    const lessonLines = lines.slice(lessonsStart + 1, lessonsEnd);
    for (const line of lessonLines) {
      const m = line.match(lessonRe);
      if (m) {
        lessons.push({
          date: m[1],
          author: m[2].trim(),
          text: m[3].trim(),
        });
      }
    }
  }

  return { session, lessons, ok: true, path: progPath };
}

// ── Write session state ──────────────────────────────────────────────────────

/**
 * Overwrite the Session State section of progress.md.
 *
 * If the file doesn't exist, creates it with the minimal structure.
 * If the ## Session State header doesn't exist, inserts it.
 *
 * @param {string} targetDir
 * @param {Record<string,string>} fields — partial or full session state
 * @returns {{ ok: boolean, error: string|null }}
 */
export function writeSessionState(targetDir, fields) {
  const progPath = getProgressPath(targetDir);

  // Build the full session state block
  const merged = { ...DEFAULT_SESSION_FIELDS, ...fields };
  const stateBlockLines = [
    SESSION_HEADER,
    '',
    ...FIELD_ORDER.map(k => `${k}: ${merged[k] ?? DEFAULT_SESSION_FIELDS[k]}`),
    '',
  ];

  const stateBlock = stateBlockLines.join('\n') + '\n';

  // Read existing content
  let content;
  if (existsSync(progPath)) {
    try {
      content = readFileSync(progPath, 'utf-8');
    } catch {
      content = '';
    }
  } else {
    content = '';
  }

  const lines = content.split('\n');

  // Find Session State section boundaries
  let sessionIdx = -1;
  let sessionEndIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === SESSION_HEADER) {
      sessionIdx = i;
    } else if (sessionIdx >= 0 && sessionEndIdx === -1 && line.startsWith('## ') && i > sessionIdx) {
      sessionEndIdx = i;
      break;
    }
  }
  if (sessionIdx >= 0 && sessionEndIdx === -1) {
    sessionEndIdx = lines.length;
  }

  let newContent;
  if (sessionIdx >= 0) {
    // Replace existing session state section
    const before = lines.slice(0, sessionIdx).join('\n');
    const after = lines.slice(sessionEndIdx).join('\n');
    newContent = (before ? before + '\n' : '') + stateBlock + (after ? after + '\n' : '');
  } else {
    // No session state section — prepend to file
    if (lines.length > 0 && lines[0].trim() !== '') {
      // File has content — insert after the title
      newContent = content.replace(/\n## /, '\n' + stateBlock + '\n## ');
      if (newContent === content) {
        // Fallback: append
        newContent = content + '\n' + stateBlock;
      }
    } else {
      // Empty or nearly empty — start fresh
      newContent = '# Progress\n\n' + stateBlock;
    }
  }

  // Ensure trailing newline and write
  try {
    mkdirSync(dirname(progPath), { recursive: true });
    writeFileSync(progPath, newContent.replace(/\n*$/, '\n'), 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Append lesson ────────────────────────────────────────────────────────────

/**
 * Append a lesson line to the Lessons section of progress.md.
 *
 * Creates ## Lessons section if it doesn't exist.
 *
 * @param {string} targetDir
 * @param {string} text — lesson text
 * @param {string} [author] — defaults to config.agentTool or 'agent'
 * @param {Date} [date] — defaults to today
 * @returns {{ ok: boolean, error: string|null }}
 */
export function appendLesson(targetDir, text, author, date) {
  const progPath = getProgressPath(targetDir);
  // Resolve author: explicit param > config.agentTool > 'agent' (tool-agnostic default)
  const resolvedAuthor = author || (() => {
    try {
      const { config, ok } = loadConfig(targetDir);
      return ok && config.agentTool ? config.agentTool : 'agent';
    } catch {
      return 'agent';
    }
  })();
  const lessonLine = `${fmtDate(date)} | ${resolvedAuthor} | ${text}`;

  let content;
  if (existsSync(progPath)) {
    try {
      content = readFileSync(progPath, 'utf-8');
    } catch {
      content = '';
    }
  } else {
    content = '';
  }

  const lines = content.split('\n');

  // Find Lessons section
  let lessonsIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === LESSONS_HEADER) {
      lessonsIdx = i;
      break;
    }
  }

  let newContent;
  if (lessonsIdx >= 0) {
    // Find where to insert — after the last lesson line or after the header
    let insertAfter = lessonsIdx;
    for (let i = lessonsIdx + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '' || line.match(/^(\d{4}-\d{2}-\d{2})\s*\|/)) {
        insertAfter = i;
      } else if (line.startsWith('## ')) {
        break;
      }
    }
    const before = lines.slice(0, insertAfter + 1).join('\n');
    const after = lines.slice(insertAfter + 1).join('\n');
    newContent = (before ? before + '\n' : '') + lessonLine + '\n' + (after ? after + '\n' : '');
  } else {
    // No Lessons section — append at end
    newContent = content.replace(/\n*$/, '') + '\n\n' + LESSONS_HEADER + '\n\n' + lessonLine + '\n';
  }

  try {
    mkdirSync(dirname(progPath), { recursive: true });
    writeFileSync(progPath, newContent.replace(/\n*$/, '\n'), 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Convenience read of just the session state fields.
 * Returns defaults for any field not found in the file.
 * @param {string} targetDir
 * @returns {Record<string,string>}
 */
export function readSessionState(targetDir) {
  const { session } = readProgress(targetDir);
  return session;
}

/**
 * Convenience read of just the lessons list.
 * @param {string} targetDir
 * @returns {Array<{date:string,author:string,text:string}>}
 */
export function readLessons(targetDir) {
  const { lessons } = readProgress(targetDir);
  return lessons;
}

/**
 * file-io — Centralized JSON and text file I/O helpers.
 *
 * Standardizes the readFileSync + JSON.parse + try/catch pattern duplicated
 * across state.mjs, contract.mjs, detect-stack.mjs, ralph-inner.mjs, etc.
 * All helpers return result objects ({ ok, data, error }) and never throw.
 *
 * Usage:
 *   import { readJson, writeJson, readText, writeText } from './file-io.mjs';
 *   const { ok, data, error } = readJson('/path/to/config.json');
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Read and parse a JSON file. Never throws.
 * @param {string} filePath — absolute path
 * @returns {{ ok: boolean, data: object|null, error: string|null }}
 */
export function readJson(filePath) {
  if (!existsSync(filePath)) {
    return { ok: false, data: null, error: `Not found: ${filePath}` };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: `Invalid JSON in ${filePath}: ${err.message}` };
  }
}

/**
 * Serialize and write a JSON file (pretty-printed, 2-space indent, trailing newline).
 * Creates parent directories if needed. Never throws.
 * @param {string} filePath
 * @param {object} data
 * @returns {{ ok: boolean, error: string|null }}
 */
export function writeJson(filePath, data) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Read a text file. Never throws.
 * @param {string} filePath
 * @returns {{ ok: boolean, data: string|null, error: string|null }}
 */
export function readText(filePath) {
  if (!existsSync(filePath)) {
    return { ok: false, data: null, error: `Not found: ${filePath}` };
  }
  try {
    const data = readFileSync(filePath, 'utf-8');
    return { ok: true, data, error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
}

/**
 * Write a text file. Creates parent directories if needed. Never throws.
 * @param {string} filePath
 * @param {string} text
 * @returns {{ ok: boolean, error: string|null }}
 */
export function writeText(filePath, text) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, text, 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Check whether a file exists.
 * @param {string} filePath
 * @returns {boolean}
 */
export function fileExists(filePath) {
  return existsSync(filePath);
}

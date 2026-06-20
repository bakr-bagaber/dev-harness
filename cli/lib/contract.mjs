/**
 * contract — Sprint Contract management.
 *
 * Manages the generator-evaluator negotiation loop for pre-build agreement.
 * The contract is stored in sprint-contract.md in the project root.
 *
 * Status flow:
 *   pending → in-negotiation → agreed (or needs-revision → back to in-negotiation)
 *
 * Usage:
 *   import { proposeContract, reviewContract, getContractStatus, validateContract } from './contract.mjs';
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CONTRACT_PATH } from './paths.mjs';
import { MAX_NEGOTIATION_ROUNDS } from './constants.mjs';

// ── Status detection ─────────────────────────────────────────────────────────

/**
 * Read the agreement status from a sprint-contract.md file.
 * Returns the current status, or null if file doesn't exist.
 * @param {string} targetDir
 * @returns {{ status: string|null, rounds: number, path: string }}
 */
export function getContractStatus(targetDir) {
  const path = CONTRACT_PATH(targetDir);
  if (!existsSync(path)) {
    return { status: null, rounds: 0, path };
  }

  try {
    const content = readFileSync(path, 'utf-8');
    const lines = content.split('\n');

    let status = null;
    let rounds = 0;

    for (const line of lines) {
      const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
      if (statusMatch) {
        const raw = statusMatch[1].trim();
        // Strip HTML comments from status value
        const cleanRaw = raw.replace(/<!--.*?-->/g, '').trim();
        // Map to canonical values
        if (cleanRaw.toLowerCase().includes('agreed')) {status = 'agreed';}
        else if (cleanRaw.toLowerCase().includes('needs revision')) {status = 'needs-revision';}
        else if (cleanRaw.toLowerCase().includes('revision')) {status = 'needs-revision';}
        else if (cleanRaw.toLowerCase().includes('escalated')) {status = 'escalated';}
        else if (cleanRaw.length > 0) {status = 'pending';}
      }

      // Handle both `rounds: 0/5` and `rounds:** 0/5` (bold formatting)
      const roundsMatch = line.match(/rounds?:\s*\*{0,2}\s*(\d+)\/(\d+)/);
      if (roundsMatch) {
        rounds = parseInt(roundsMatch[1], 10);
      }
    }

    // If file was parsed but no status set, default to pending
    if (status === null) {status = 'pending';}

    return { status, rounds, path };
  } catch {
    return { status: 'error', rounds: 0, path };
  }
}

/**
 * Check if the contract is agreed (status === 'agreed').
 * @param {string} targetDir
 * @returns {boolean}
 */
export function isContractAgreed(targetDir) {
  const { status } = getContractStatus(targetDir);
  return status === 'agreed';
}

// ── Propose ──────────────────────────────────────────────────────────────────

/**
 * Propose or update a sprint contract.
 *
 * Writes sprint-contract.md with the Generator's proposed scope and criteria.
 * If the file already exists, preserves the Evaluator Review section
 * and only overwrites the Scope + Verification Criteria sections.
 *
 * @param {string} targetDir
 * @param {object} proposal
 * @param {string} proposal.scope — what will be built
 * @param {string} [proposal.exclusions] — what will NOT be built
 * @param {string[]} [proposal.criteria] — verification criteria
 * @returns {{ ok: boolean, error: string|null }}
 */
export function proposeContract(targetDir, proposal) {
  const path = CONTRACT_PATH(targetDir);

  let existingReview = '';
  let existingStatus = '';

  // Preserve evaluator review and status from existing contract
  if (existsSync(path)) {
    try {
      const existing = readFileSync(path, 'utf-8');
      const reviewMatch = existing.match(/## Evaluator Review[\s\S]*?(?=## Agreement|$)/);
      if (reviewMatch) {existingReview = reviewMatch[0];}

      const statusMatch = existing.match(/## Agreement Status[\s\S]*?(?=#|$)/);
      if (statusMatch) {existingStatus = statusMatch[0];}
    } catch {
      // Ignore read errors
    }
  }

  const criteriaList = (proposal.criteria || ['']).map(c => `${c}`).join('\n');

  const content = `# Sprint Contract

## Scope (Generator proposes)

**I will build:**
${proposal.scope || '<!-- Describe what will be built -->'}

**I will NOT build:**
${proposal.exclusions || '<!-- Explicit exclusions -->'}

## Verification Criteria (Generator proposes)

${criteriaList || '1. ...'}

${existingReview || `## Evaluator Review (Evaluator fills in)

- [ ] Scope is clear and bounded: <!-- yes/no — if no, explain -->
- [ ] Verification criteria are sufficient: <!-- yes/no — if no, explain -->
- [ ] Exclusions are reasonable: <!-- yes/no — if no, explain -->

**Review notes:**
<!-- Evaluator's feedback to Generator if revision is needed -->`}

${existingStatus || `## Agreement Status

**Status:** <!-- Agreed / Needs Revision -->
**Negotiation rounds:** 0/${MAX_NEGOTIATION_ROUNDS}`}
`;

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Review ───────────────────────────────────────────────────────────────────

/**
 * Review the current contract and update its status.
 *
 * Increments negotiation rounds and sets status to 'agreed' or 'needs-revision'.
 * If rounds >= 5 and still not agreed, automatically escalates.
 *
 * @param {string} targetDir
 * @param {'agreed'|'needs-revision'} decision
 * @param {string} [notes] — evaluator's feedback
 * @returns {{ ok: boolean, error: string|null, escalated: boolean }}
 */
export function reviewContract(targetDir, decision, notes) {
  const path = CONTRACT_PATH(targetDir);
  if (!existsSync(path)) {
    return { ok: false, error: 'No sprint-contract.md found. Run: harness-dev contract propose first', escalated: false };
  }

  try {
    let content = readFileSync(path, 'utf-8');
    const { rounds } = getContractStatus(targetDir);
    // Agreement is not a negotiation round — only increment on revision.
    const newRounds = (decision === 'agreed') ? rounds : rounds + 1;
    const escalated = newRounds >= MAX_NEGOTIATION_ROUNDS && decision !== 'agreed';

    // Update agreement status
    const displayStatus = escalated
      ? 'Escalated — awaiting human adjudication'
      : (decision === 'agreed' ? 'Agreed' : 'Needs Revision');
    const escapedDecision = displayStatus;

    content = content.replace(
      /\*\*Status:\*\*.*/,
      `**Status:** ${escapedDecision}`,
    );
    content = content.replace(
      /(rounds?:\s*\*{0,2}\s*)\d+\/\d+/,
      `$1${newRounds}/${MAX_NEGOTIATION_ROUNDS}`,
    );

    // Update review notes if provided
    if (notes) {
      const notesSection = `**Review notes:**\n${notes}\n`;
      content = content.replace(
        /\*\*Review notes:\*\*[\s\S]*?(?=\n##|$)/,
        notesSection,
      );
    }

    // Auto-escalation: append escalation section to file
    if (escalated) {
      // Remove old escalation section if present
      if (content.includes('## Escalation')) {
        content = content.replace(/\n## Escalation[\s\S]*$/, '');
      }
      content += `\n\n## Escalation\n\n**Reason:** Agents could not reach agreement after ${newRounds} rounds\n\n**Escalated at:** ${new Date().toISOString()}`;
    }

    writeFileSync(path, content, 'utf-8');

    return { ok: true, error: null, escalated };
  } catch (err) {
    return { ok: false, error: err.message, escalated: false };
  }
}

// ── Escalate ─────────────────────────────────────────────────────────────────

/**
 * Escalate a stalled contract negotiation to human.
 * Sets status to 'escalated' and records the escalation reason.
 * @param {string} targetDir
 * @param {string} reason
 * @returns {{ ok: boolean, error: string|null }}
 */
export function escalateContract(targetDir, reason) {
  const path = CONTRACT_PATH(targetDir);
  if (!existsSync(path)) {
    return { ok: false, error: 'No sprint-contract.md found. Nothing to escalate.' };
  }

  try {
    let content = readFileSync(path, 'utf-8');

    content = content.replace(
      /\*\*Status:\*\*.*/,
      `**Status:** Escalated — awaiting human adjudication`,
    );

    const escalationNote = `\n\n## Escalation\n\n**Reason:** ${reason || `Agents could not reach agreement after ${MAX_NEGOTIATION_ROUNDS} rounds`}\n\n**Escalated at:** ${new Date().toISOString()}`;

    // Append escalation section before the end
    if (content.includes('## Escalation')) {
      content = content.replace(
        /## Escalation[\s\S]*$/,
        escalationNote.trim(),
      );
    } else {
      content += escalationNote;
    }

    writeFileSync(path, content, 'utf-8');
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Validation (for gates) ───────────────────────────────────────────────────

/**
 * Validate contract for gate checking.
 * Returns pass/fail with detail message.
 * @param {string} targetDir
 * @returns {{ name: string, pass: boolean, detail: string }}
 */
export function validateContract(targetDir) {
  const { status, rounds } = getContractStatus(targetDir);

  if (status === null) {
    return {
      name: 'contract-agreed',
      pass: false,
      detail: 'Sprint contract not yet proposed. Run: harness-dev contract propose',
    };
  }

  if (status === 'agreed') {
    return {
      name: 'contract-agreed',
      pass: true,
      detail: `Sprint contract agreed after ${rounds} round(s)`,
    };
  }

  if (status === 'escalated') {
    return {
      name: 'contract-agreed',
      pass: false,
      detail: 'Sprint contract escalated to human. Awaiting resolution.',
    };
  }

  // needs-revision or pending
  const noun = status === 'needs-revision' ? 'needs revision' : 'pending';
  return {
    name: 'contract-agreed',
    pass: false,
    detail: `Sprint contract ${noun} (round ${rounds}/${MAX_NEGOTIATION_ROUNDS}). Run: harness-dev contract review`,
  };
}

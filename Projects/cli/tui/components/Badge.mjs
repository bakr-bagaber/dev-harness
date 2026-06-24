/**
 * Badge — status indicator (pass/fail/pending/running).
 *
 * Props:
 *   status: 'pass'|'fail'|'pending'|'running'|'info'
 *   text?: string (override badge text)
 */
import { Text } from 'ink';
import React from 'react';

const h = React.createElement;

const BADGES = {
  pass:    { icon: '✓', color: 'green', label: 'PASS' },
  fail:    { icon: '✗', color: 'red', label: 'FAIL' },
  pending: { icon: '○', color: 'yellow', label: 'PENDING' },
  running: { icon: '●', color: 'cyan', label: 'RUNNING' },
  info:    { icon: 'ℹ', color: 'blue', label: 'INFO' },
};

export function Badge({ status, text }) {
  const badge = BADGES[status] || BADGES.info;
  return h(Text, { color: badge.color, bold: true },
    `${badge.icon} ${text || badge.label}`);
}

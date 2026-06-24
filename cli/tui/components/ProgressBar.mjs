/**
 * ProgressBar — progress indicator for long operations.
 *
 * Props:
 *   value: number (0-1 or 0-100)
 *   max?: number (default 1, or 100 if value > 1)
 *   label?: string
 *   width?: number (default 30)
 */
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function ProgressBar({ value, max, label, width = 30 }) {
  const maxVal = max || (value > 1 ? 100 : 1);
  const pct = Math.min(1, value / maxVal);
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const pctNum = Math.round(pct * 100);

  return h(Box, { flexDirection: 'column' },
    label ? h(Text, null, label) : null,
    h(Box, null,
      h(Text, { color: 'green' }, '█'.repeat(filled)),
      h(Text, { color: 'gray' }, '░'.repeat(empty)),
      h(Text, { bold: true }, ` ${pctNum}%`),
    ),
  );
}

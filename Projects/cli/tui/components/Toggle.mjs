/**
 * Toggle — boolean toggle component (yes/no).
 *
 * Props:
 *   value: boolean
 *   onChange: (value) => void
 *   label?: string
 *   onText?: string (default "On")
 *   offText?: string (default "Off")
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function Toggle({ value, onChange, label, onText = 'On', offText = 'Off' }) {
  useInput((input, key) => {
    if (key.return || input === ' ' || input === 't') {
      onChange(!value);
    } else if (input === 'y' || input === 'Y') {
      onChange(true);
    } else if (input === 'n' || input === 'N') {
      onChange(false);
    }
  });

  return h(Box, null,
    label ? h(Text, { bold: true }, `${label}: `) : null,
    h(Text, { color: value ? 'green' : 'gray', bold: value },
      value ? `● ${onText}` : `○ ${offText}`),
    h(Text, { dimColor: true }, '  [Enter/space] toggle'),
  );
}

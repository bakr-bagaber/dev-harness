/**
 * StatusBar — bottom bar with context-aware keybindings.
 *
 * Props:
 *   keys: array<{ key: string, label: string }>
 *   message?: string — optional status message
 */
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function StatusBar({ keys, message }) {
  return h(Box, { flexDirection: 'column', marginTop: 1 },
    h(Text, { dimColor: true }, '─'.repeat(70)),
    h(Box, { flexWrap: 'wrap', gap: 2 },
      ...keys.map((k, i) =>
        h(Text, { key: i },
          h(Text, { bold: true, color: 'cyan' }, k.key),
          h(Text, { dimColor: true }, ` ${k.label}`),
        ),
      ),
    ),
    message ? h(Text, { dimColor: true, italic: true }, message) : null,
  );
}

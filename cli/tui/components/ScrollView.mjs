/**
 * ScrollView — scrollable content area for long text.
 *
 * Props:
 *   content: string (multi-line text)
 *   height?: number (visible lines, default 15)
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React, { useState } from 'react';

const h = React.createElement;

export function ScrollView({ content, height = 15 }) {
  const [offset, setOffset] = useState(0);
  const lines = content.split('\n');
  const maxOffset = Math.max(0, lines.length - height);

  useInput((input, key) => {
    if (key.downArrow || input === 'j') {
      setOffset(o => Math.min(o + 1, maxOffset));
    } else if (key.upArrow || input === 'k') {
      setOffset(o => Math.max(o - 1, 0));
    } else if (key.pageDown) {
      setOffset(o => Math.min(o + height, maxOffset));
    } else if (key.pageUp) {
      setOffset(o => Math.max(o - height, 0));
    } else if (input === 'g') {
      setOffset(0);
    } else if (input === 'G') {
      setOffset(maxOffset);
    }
  });

  const visible = lines.slice(offset, offset + height);

  return h(Box, { flexDirection: 'column' },
    h(Box, { flexDirection: 'column' },
      visible.map((line, i) =>
        h(Text, { key: i, wrap: 'truncate' }, line),
      ),
    ),
    h(Text, { dimColor: true }, `Lines ${offset + 1}-${offset + visible.length} of ${lines.length}  [↑↓/j/k scroll, g/G top/bottom]`),
  );
}

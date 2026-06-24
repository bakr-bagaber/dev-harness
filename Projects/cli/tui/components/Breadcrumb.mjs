/**
 * Breadcrumb — screen navigation trail.
 *
 * Props:
 *   trail: array<string> — screen names from root to current
 */
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function Breadcrumb({ trail }) {
  if (!trail || trail.length === 0) return null;
  return h(Box, null,
    trail.map((name, i) => h(Box, { key: i },
      i > 0 ? h(Text, { dimColor: true }, ' › ') : null,
      h(Text, { bold: i === trail.length - 1, dimColor: i !== trail.length - 1 },
        name),
    )),
  );
}

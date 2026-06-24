/**
 * SearchBar — filter input for long lists.
 *
 * Props:
 *   query: string
 *   onQueryChange: (query) => void
 *   placeholder?: string
 *   onFocus?: () => void
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function SearchBar({ query, onQueryChange, placeholder = 'Search...', onFocus }) {
  useInput((input, key) => {
    if (key.backspace || key.delete) {
      onQueryChange(query.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta && !key.upArrow && !key.downArrow && !key.return && !key.escape) {
      if (onFocus) onFocus();
      onQueryChange(query + input);
    }
  });

  return h(Box, null,
    h(Text, { dimColor: true }, '🔍 '),
    h(Text, { color: query ? 'white' : 'gray' },
      query || placeholder,
      query ? '_' : ''),
  );
}

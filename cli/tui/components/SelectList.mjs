/**
 * SelectList — arrow-key navigable list component.
 *
 * Renders a list of options with labels + optional descriptions.
 * Supports search/filter, arrow keys, Enter to select, Esc to cancel.
 *
 * Props:
 *   items: array<{ label: string, description?: string, value: any }>
 *   onSelect: (item) => void
 *   onCancel: () => void  (Esc)
 *   searchable?: boolean (default true)
 *   title?: string
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React, { useState } from 'react';

const h = React.createElement;

export function SelectList({ items, onSelect, onCancel, searchable = true, title, initialCursor = 0 }) {
  const [cursor, setCursor] = useState(initialCursor);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const filtered = searchable && query
    ? items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(query.toLowerCase()))
    : items;

  const safeCursor = filtered.length > 0 ? Math.min(cursor, filtered.length - 1) : 0;

  useInput((input, key) => {
    if (searching) {
      if (key.escape || key.return) {
        setSearching(false);
        setQuery('');
        return;
      }
      if (key.backspace || key.delete) {
        setQuery(q => q.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery(q => q + input);
        return;
      }
      return;
    }
    if (key.upArrow) {
      setCursor(c => (c > 0 ? c - 1 : filtered.length - 1));
    } else if (key.downArrow) {
      setCursor(c => (c < filtered.length - 1 ? c + 1 : 0));
    } else if (key.return) {
      if (filtered[safeCursor]) {
        onSelect(filtered[safeCursor]);
      }
    } else if (key.escape) {
      if (onCancel) onCancel();
    } else if (input === '/' && searchable) {
      setSearching(true);
    }
  });

  return h(Box, { flexDirection: 'column' },
    title ? h(Text, { bold: true }, title) : null,
    searching
      ? h(Text, { dimColor: true }, `Search: ${query}_`)
      : searchable
        ? h(Text, { dimColor: true }, 'Press / to search')
        : null,
    h(Box, { flexDirection: 'column', marginTop: 1 },
      filtered.length === 0
        ? h(Text, { dimColor: true }, 'No matches')
        : filtered.slice(0, 15).map((item, i) => {
            const idx = i;
            const isSelected = idx === safeCursor;
            return h(Box, { key: idx },
              h(Text, { color: isSelected ? 'cyan' : undefined },
                isSelected ? '❯ ' : '  '),
              h(Text, { bold: isSelected, color: isSelected ? 'cyan' : undefined },
                item.label),
              item.description
                ? h(Text, { dimColor: true }, ` — ${item.description}`)
                : null,
            );
          }),
    ),
  );
}

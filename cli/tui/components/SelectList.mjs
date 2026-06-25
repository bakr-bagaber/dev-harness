/**
 * SelectList — arrow-key navigable list component.
 *
 * Renders a list of options with labels + optional descriptions.
 * Supports search/filter, arrow keys, Enter to select, Esc to cancel.
 * Implements windowed scrolling: shows a viewport of items that follows
 * the cursor, so long lists (31+ stacks, 18+ tools) are fully navigable.
 *
 * Props:
 *   items: array<{ label: string, description?: string, value: any }>
 *   onSelect: (item) => void
 *   onCancel: () => void  (Esc)
 *   searchable?: boolean (default true)
 *   title?: string
 *   viewportHeight?: number (default 15 — max items visible at once)
 *   initialCursor?: number
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React, { useState } from 'react';

const h = React.createElement;
const DEFAULT_VIEWPORT = 15;

export function SelectList({ items, onSelect, onCancel, searchable = true, title, initialCursor = 0, viewportHeight = DEFAULT_VIEWPORT }) {
  const [cursor, setCursor] = useState(initialCursor);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const filtered = searchable && query
    ? items.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(query.toLowerCase()))
    : items;

  const safeCursor = filtered.length > 0 ? Math.min(cursor, filtered.length - 1) : 0;

  // Windowed scrolling: compute the visible slice based on cursor position.
  // The viewport follows the cursor, scrolling down when cursor passes the
  // bottom edge and up when it passes the top edge.
  const total = filtered.length;
  const half = Math.floor(viewportHeight / 2);
  let start = Math.max(0, safeCursor - half);
  let end = Math.min(total, start + viewportHeight);
  // Re-adjust start if we hit the bottom (show as many as possible)
  start = Math.max(0, end - viewportHeight);
  const visible = filtered.slice(start, end);

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
    // Scroll indicators
    start > 0
      ? h(Text, { dimColor: true }, `  ↑ ${start} more above`)
      : null,
    h(Box, { flexDirection: 'column', marginTop: 0 },
      filtered.length === 0
        ? h(Text, { dimColor: true }, 'No matches')
        : visible.map((item, i) => {
            const idx = start + i;
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
    end < total
      ? h(Text, { dimColor: true }, `  ↓ ${total - end} more below`)
      : null,
  );
}

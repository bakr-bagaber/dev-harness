/** ActionMenu — Context-aware grouped action menu with arrow-key navigation.
 *
 *  Wraps SelectList with support for grouped items and separators.
 *  Items: array of { label, icon?, action, group?, visible?, description? }
 *  - visible !== false items are shown
 *  - group separators (───) rendered between groups
 *  - ↑↓ navigate, Enter select, / search, Esc cancel
 *
 *  Used by the redesigned dashboard to replace 25 single-letter hotkeys.
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React, { useState } from 'react';

const h = React.createElement;
const DEFAULT_VIEWPORT = 18;

export function ActionMenu({ items, onSelect, onCancel, title, viewportHeight = DEFAULT_VIEWPORT }) {
  const [cursor, setCursor] = useState(0);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  // Filter visible items
  const visibleItems = items.filter(it => it.visible !== false && it.type !== 'separator');

  // Apply search filter
  const filtered = searching && query
    ? visibleItems.filter(it =>
        (it.label || '').toLowerCase().includes(query.toLowerCase()) ||
        (it.description || '').toLowerCase().includes(query.toLowerCase()))
    : visibleItems;

  const safeCursor = filtered.length > 0 ? Math.min(cursor, filtered.length - 1) : 0;

  // Build render list with group separators
  // Determine which filtered items to show (windowed scrolling)
  const total = filtered.length;
  const half = Math.floor(viewportHeight / 2);
  let start = Math.max(0, safeCursor - half);
  let end = Math.min(total, start + viewportHeight);
  start = Math.max(0, end - viewportHeight);
  const visibleSlice = filtered.slice(start, end);

  // Build render rows: insert separator when group changes
  const rows = [];
  let lastGroup = null;
  for (let i = 0; i < visibleSlice.length; i++) {
    const item = visibleSlice[i];
    const idx = start + i;
    if (item.group && item.group !== lastGroup) {
      rows.push({ type: 'separator', label: item.group, key: `sep-${item.group}-${i}` });
      lastGroup = item.group;
    }
    rows.push({ type: 'item', item, idx, key: `item-${idx}` });
  }

  useInput((input, key) => {
    if (searching) {
      if (key.escape || key.return) {
        setSearching(false);
        setQuery('');
        if (key.return && filtered[safeCursor]) {
          onSelect(filtered[safeCursor]);
        }
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
    } else if (input === '/') {
      setSearching(true);
    } else if (input === 'q' && !searching) {
      // Quick quit shortcut
      if (onCancel) onCancel();
    }
  });

  return h(Box, { flexDirection: 'column' },
    title ? h(Text, { bold: true, dimColor: true }, title) : null,
    searching
      ? h(Text, { dimColor: true }, `Search: ${query}_`)
      : h(Text, { dimColor: true }, '↑↓ navigate  Enter select  / search  Esc/q back'),
    start > 0
      ? h(Text, { dimColor: true }, `  ↑ ${start} more above`)
      : null,
    h(Box, { flexDirection: 'column' },
      filtered.length === 0
        ? h(Text, { dimColor: true }, 'No actions available')
        : rows.map(row =>
            row.type === 'separator'
              ? h(Text, { key: row.key, dimColor: true }, `  ── ${row.label} ──`)
              : h(Box, { key: row.key },
                  h(Text, { color: row.idx === safeCursor ? 'cyan' : undefined },
                    row.idx === safeCursor ? '❯ ' : '  '),
                  h(Text, { bold: row.idx === safeCursor, color: row.idx === safeCursor ? 'cyan' : undefined },
                    row.item.icon ? `${row.item.icon} ` : ''),
                  h(Text, { bold: row.idx === safeCursor, color: row.idx === safeCursor ? 'cyan' : undefined },
                    row.item.label),
                  row.item.description
                    ? h(Text, { dimColor: true }, ` — ${row.item.description}`)
                    : null,
                ),
          ),
    ),
    end < total
      ? h(Text, { dimColor: true }, `  ↓ ${total - end} more below`)
      : null,
  );
}

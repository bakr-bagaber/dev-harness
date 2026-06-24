/**
 * MultiLineInput — multi-line text area for longer text (scope, exclusions).
 *
 * Props:
 *   value: string
 *   onChange: (value) => void
 *   onSubmit: (value) => void  (Ctrl+Enter or Esc+Enter)
 *   onCancel: () => void  (Esc)
 *   placeholder?: string
 *   label?: string
 *   maxLines?: number (default 5)
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function MultiLineInput({ value, onChange, onSubmit, onCancel, placeholder = '', label, maxLines = 5 }) {
  useInput((input, key) => {
    if (key.return && key.shift) {
      // Shift+Enter = newline (Ink may not support this well)
      onChange(value + '\n');
      return;
    }
    if (key.return) {
      // Enter = submit
      if (onSubmit) onSubmit(value);
      return;
    }
    if (key.escape) {
      if (onCancel) onCancel();
      return;
    }
    if (key.backspace || key.delete) {
      onChange(value.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      onChange(value + input);
    }
  });

  const lines = value.split('\n');
  const showPlaceholder = !value && placeholder;

  return h(Box, { flexDirection: 'column' },
    label ? h(Text, { bold: true }, label) : null,
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
      showPlaceholder
        ? h(Text, { color: 'gray' }, placeholder)
        : lines.slice(-maxLines).map((line, i) =>
            h(Text, { key: i }, line || ' ')),
      h(Text, { dimColor: true }, '_'),
    ),
    h(Text, { dimColor: true }, '[Enter] submit  [Esc] cancel'),
  );
}

/**
 * TextInput — single-line text input with cursor.
 *
 * Props:
 *   value: string
 *   onChange: (value) => void
 *   onSubmit: (value) => void  (Enter)
 *   onCancel: () => void  (Esc)
 *   placeholder?: string
 *   label?: string
 *   password?: boolean (mask input)
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React from 'react';

const h = React.createElement;

export function TextInput({ value, onChange, onSubmit, onCancel, placeholder = '', label, password = false }) {
  useInput((input, key) => {
    if (key.return) {
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
    if (input && !key.ctrl && !key.meta && !key.shift) {
      onChange(value + input);
    }
  });

  const displayValue = password ? '*'.repeat(value.length) : value;
  const showPlaceholder = !value && placeholder;

  return h(Box, null,
    label ? h(Text, { bold: true }, `${label}: `) : null,
    h(Text, { color: showPlaceholder ? 'gray' : 'white' },
      showPlaceholder ? placeholder : displayValue,
      '_',
    ),
  );
}

/**
 * ConfirmDialog — "Are you sure?" confirmation for destructive actions.
 *
 * Props:
 *   message: string
 *   onConfirm: () => void
 *   onCancel: () => void
 *   confirmText?: string (default "Yes")
 *   cancelText?: string (default "No")
 */
import { useInput } from 'ink';
import { Text, Box } from 'ink';
import React, { useState } from 'react';

const h = React.createElement;

export function ConfirmDialog({ message, onConfirm, onCancel, confirmText = 'Yes', cancelText = 'No' }) {
  const [selected, setSelected] = useState(1); // default to "No" for safety

  useInput((input, key) => {
    if (key.leftArrow || input === 'h') {
      setSelected(0);
    } else if (key.rightArrow || input === 'l') {
      setSelected(1);
    } else if (key.return) {
      if (selected === 0) onConfirm();
      else onCancel();
    } else if (input === 'y' || input === 'Y') {
      onConfirm();
    } else if (input === 'n' || input === 'N' || key.escape) {
      onCancel();
    }
  });

  return h(Box, { flexDirection: 'column', borderStyle: 'round', borderColor: 'yellow', paddingX: 2, paddingY: 1 },
    h(Text, { color: 'yellow', bold: true }, '⚠ Confirmation'),
    h(Text, null, message),
    h(Box, { marginTop: 1, gap: 4 },
      h(Text, { bold: selected === 0, color: selected === 0 ? 'green' : undefined },
        selected === 0 ? '❯ ' : '  ', confirmText),
      h(Text, { bold: selected === 1, color: selected === 1 ? 'red' : undefined },
        selected === 1 ? '❯ ' : '  ', cancelText),
    ),
  );
}

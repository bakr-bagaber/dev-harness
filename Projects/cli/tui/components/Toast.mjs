/**
 * Toast — transient status notification (auto-dismiss).
 *
 * Reads from the screen registry toast state.
 * Renders at bottom of screen, auto-dismisses after timeout.
 */
import { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import React from 'react';
import { getToast, clearToast } from '../screens.mjs';

const h = React.createElement;

const TOAST_COLORS = {
  info: 'blue',
  success: 'green',
  error: 'red',
  warning: 'yellow',
};

export function Toast() {
  const [toast, setToast] = useState(getToast());

  useEffect(() => {
    const interval = setInterval(() => {
      setToast(getToast());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (!toast) return null;

  return h(Box, { marginTop: 1 },
    h(Text, { color: TOAST_COLORS[toast.type] || 'blue', bold: true },
      `${toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'} ${toast.message}`),
  );
}

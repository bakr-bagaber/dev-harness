/**
 * Form — multi-field form with Tab navigation.
 *
 * Renders a sequence of fields (TextInput, Toggle, SelectList).
 * Tab/Shift+Tab cycles between fields. Enter on last field submits.
 *
 * Props:
 *   fields: array<{ name: string, label: string, type: 'text'|'toggle'|'select', value: any, options?: array, placeholder?: string }>
 *   onSubmit: (values: object) => void
 *   onCancel: () => void
 *   submitLabel?: string (default "Submit")
 */
import { useState, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { TextInput } from './TextInput.mjs';
import { Toggle } from './Toggle.mjs';
import { SelectList } from './SelectList.mjs';

export function Form({ fields, onSubmit, onCancel, submitLabel = 'Submit' }) {
  const [activeField, setActiveField] = useState(0);
  const [values, setValues] = useState(
    Object.fromEntries(fields.map(f => [f.name, f.value])),
  );

  useInput((input, key) => {
    if (key.tab) {
      if (key.shift) {
        setActiveField(f => (f > 0 ? f - 1 : fields.length));
      } else {
        setActiveField(f => (f < fields.length ? f + 1 : 0));
      }
      return;
    }
    if (key.escape) {
      if (onCancel) onCancel();
      return;
    }
    if (key.return && activeField === fields.length) {
      onSubmit(values);
      return;
    }
  });

  return h(Box, { flexDirection: 'column' },
    fields.map((field, i) => {
      const isActive = i === activeField;
      const setValue = (val) => setValues(v => ({ ...v, [field.name]: val }));

      return h(Box, { key: field.name, flexDirection: 'column', marginBottom: 1 },
        h(Text, { bold: isActive, color: isActive ? 'cyan' : undefined },
          `${isActive ? '❯ ' : '  '}${field.label}`),
        field.type === 'toggle'
          ? h(Toggle, {
              value: values[field.name],
              onChange: setValue,
            })
          : field.type === 'select'
            ? h(SelectList, {
                items: field.options || [],
                onSelect: (item) => setValue(item.value),
                searchable: false,
              })
            : h(TextInput, {
                value: values[field.name] || '',
                onChange: setValue,
                placeholder: field.placeholder || '',
              }),
      );
    }),
    // Submit button
    h(Box, { marginTop: 1 },
      h(Text, { bold: activeField === fields.length, color: activeField === fields.length ? 'green' : undefined },
        `${activeField === fields.length ? '❯ ' : '  '}[${submitLabel}]`),
      h(Text, { dimColor: true }, '  [Tab] next field  [Esc] cancel'),
    ),
  );
}

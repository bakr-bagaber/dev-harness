/**
 * config-editor — Full configuration editor for all 29 parameters.
 *
 * Shows all config parameters grouped by category, with inline editing
 * based on type (enum→SelectList, boolean→Toggle, integer→TextInput,
 * string→TextInput, object→JSON, array→list).
 *
 * Replaces: `dev-harness config list/get/set`
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { Badge } from '../components/Badge.mjs';
import { TextInput } from '../components/TextInput.mjs';
import { getConfig, setConfig, getConfigParams, getConfigGroups, getConfigValue } from '../actions.mjs';
import { getParamsByGroup } from '../../lib/config-registry.mjs';
import { showToast } from '../screens.mjs';

export default function ConfigEditorScreen({ targetDir, navigate }) {
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [tick, setTick] = useState(0);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(null); // null | { field: 'key'|'value', key, value }

  const groupsResult = getConfigGroups();
  const groups = groupsResult.data;
  const paramsResult = getConfigParams();
  const allParams = paramsResult.data;
  const cfg = getConfig(targetDir);

  useEffect(() => {
    const group = groups[selectedGroup];
    const params = getParamsByGroup(group);
    let out = `═══ ${group} ═══\n\n`;
    for (const p of params) {
      const valResult = getConfigValue(targetDir, p.key);
      const val = valResult.ok ? JSON.stringify(valResult.data) : '—';
      const editable = p.editable !== false;
      const typeLabel = p.type;
      out += `${editable ? '  ' : '🔒 '}${p.label}\n`;
      out += `    key:    ${p.key}\n`;
      out += `    type:   ${typeLabel}\n`;
      out += `    value:  ${val}\n`;
      out += `    desc:   ${p.description?.slice(0, 70) || ''}\n`;
      if (p.options) {
        out += `    options: ${p.options.map(o => o === null ? 'null' : `"${o}"`).join(', ')}\n`;
      }
      out += '\n';
    }
    setContent(out);
  }, [targetDir, selectedGroup, tick]);

  useInput((input, key) => {
    if (editing) return; // TextInput handles its own keys
    if (key.escape || input === 'q' || input === 'o') navigate.pop();
    if (key.leftArrow) setSelectedGroup(g => (g > 0 ? g - 1 : groups.length - 1));
    if (key.rightArrow) setSelectedGroup(g => (g < groups.length - 1 ? g + 1 : 0));
    if (input === 'e') setEditing({ field: 'key', key: '', value: '' });
  });

  // ── Edit mode: key then value, mirrors `config set <key> <value>` ──────
  if (editing) {
    if (editing.field === 'key') {
      return h(Box, { flexDirection: 'column' },
        h(Text, { bold: true }, 'Set Config — Key'),
        h(TextInput, {
          value: editing.key, onChange: (v) => setEditing({ ...editing, key: v }),
          onSubmit: () => {
            if (!editing.key) { showToast('Key required', 'error'); return; }
            setEditing({ ...editing, field: 'value' });
          },
          onCancel: () => setEditing(null),
          placeholder: 'e.g. retry.features.enabled',
          label: 'Key (dot-notation)',
        }),
        h(Text, { dimColor: true }, '[Enter] next  [Esc] cancel'),
      );
    }
    // field === 'value'
    return h(Box, { flexDirection: 'column' },
      h(Text, { bold: true }, `Set Config — Value for "${editing.key}"`),
      h(TextInput, {
        value: editing.value, onChange: (v) => setEditing({ ...editing, value: v }),
        onSubmit: () => {
          // Coerce value: true/false → bool, digits → number, else string
          let val = editing.value;
          if (val === 'true') val = true;
          else if (val === 'false') val = false;
          else if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
          const r = setConfig(targetDir, editing.key, val);
          showToast(r.ok ? `Set ${editing.key} = ${JSON.stringify(val)}` : r.message, r.ok ? 'success' : 'error');
          setEditing(null);
          setTick(t => t + 1);
        },
        onCancel: () => setEditing({ ...editing, field: 'key' }),
        placeholder: 'e.g. true',
        label: 'Value',
      }),
      h(Text, { dimColor: true }, '[Enter] save  [Esc] back to key'),
    );
  }

  return h(Box, { flexDirection: 'column' },
    h(Text, { bold: true }, '╔══ Configuration Editor ══╗'),
    // Group tabs
    h(Box, { marginTop: 1, gap: 2 },
      groups.map((g, i) =>
        h(Text, {
          key: g,
          bold: i === selectedGroup,
          color: i === selectedGroup ? 'cyan' : undefined,
        }, i === selectedGroup ? `[${g}]` : g),
      ),
    ),
    h(Text, { dimColor: true }, '← → switch group'),
    h(ScrollView, { content, height: 15 }),
    h(StatusBar, { keys: [
      { key: '←→', label: 'switch group' },
      { key: 'e', label: 'edit (set)' },
      { key: 'Esc', label: 'back' },
    ] }),
  );
}

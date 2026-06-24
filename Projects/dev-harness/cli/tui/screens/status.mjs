/**
 * status — Full status screen.
 *
 * Shows comprehensive project state: phase, stack, mode, gates,
 * features, git state, recent lessons, next action.
 *
 * Replaces: `dev-harness status`
 */
import { useState, useEffect, useInput, createElement as h } from 'react';
import { Text, Box } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { getPipelineStatus, getConfig, getLessons } from '../actions.mjs';
import { detectStack } from '../../lib/detect-stack.mjs';
import { basename } from 'node:path';

export default function StatusScreen({ targetDir, navigate }) {
  const [content, setContent] = useState('Loading...');

  useEffect(() => {
    const build = () => {
      const st = getPipelineStatus(targetDir);
      const cfg = getConfig(targetDir);
      const lessons = getLessons(targetDir);
      const stack = detectStack(targetDir);

      let out = '═══ Harness Status ═══\n\n';
      out += `Project:    ${basename(targetDir)}\n`;
      out += `Stack:      ${stack.label}${stack.name !== 'generic' ? '' : ' (not detected)'}\n`;
      if (st.ok) {
        out += `Mode:       ${st.data.mode}\n`;
        out += `Phase:      ${st.data.phase || 'not started'}\n`;
        out += `Gates:      ${st.data.gatesEnabled ? 'enabled' : 'disabled'}\n`;
        out += `Paused:     ${st.data.paused ? 'yes' : 'no'}\n`;
        out += `Retries:    ${st.data.retryCount || 0}/${st.data.maxRetries || 10}\n`;
        out += `Task retry: ${st.data.taskRetryCount || 0}/${st.data.maxRetries || 10}\n`;
        out += `Iteration:  ${st.data.pipelineIteration || 0}\n`;
        if (st.data.feature) {
          out += `Feature:    ${st.data.feature.name} (${st.data.feature.id})\n`;
        }
        if (st.data.task) {
          out += `Task:       ${st.data.task.description} (${st.data.task.id})\n`;
        }
      }
      out += '\n';

      if (cfg.ok) {
        const c = cfg.data;
        out += `Git:\n`;
        out += `  Branch:    ${c.git?.branch || '—'}\n`;
        out += `  Clean:     ${c.git?.clean ? 'yes' : 'no'}\n`;
        out += `  Upstream:  ${c.git?.hasUpstream ? 'yes' : 'no'}\n`;
        out += `  AutoCommit: ${c.git?.autoCommit ? 'yes' : 'no'}\n`;
        out += '\n';
        out += `Features:\n`;
        out += `  Remaining: ${c.features?.remaining || 0}\n`;
        out += `  Passing:   ${c.features?.passing || 0}\n`;
        out += `  Total:     ${c.features?.total || 0}\n`;
      }

      if (lessons.ok && lessons.data?.length > 0) {
        out += '\nRecent lessons:\n';
        for (const l of lessons.data.slice(-3)) {
          out += `  ${l.date} | ${l.text}\n`;
        }
      }

      setContent(out);
    };
    build();
    const timer = setInterval(build, 2000);
    return () => clearInterval(timer);
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q' || input === 's') {
      navigate.pop();
    }
  });

  return h(Box, { flexDirection: 'column' },
    h(ScrollView, { content, height: 18 }),
    h(StatusBar, { keys: [{ key: 'Esc', label: 'back' }, { key: 'q', label: 'back' }] }),
  );
}

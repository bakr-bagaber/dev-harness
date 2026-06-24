/**
 * agent-run — Agent orchestration screen.
 *
 * Launches the supervisor to spawn an agent per task, shows live
 * output, auto-validates on exit, and handles phase advancement.
 *
 * Replaces: `dev-harness run`
 */
import { useState, useEffect, createElement as h } from 'react';
import { Text, Box, useInput } from 'ink';
import { ScrollView } from '../components/ScrollView.mjs';
import { StatusBar } from '../components/StatusBar.mjs';
import { Badge } from '../components/Badge.mjs';
import { getConfig, getPipelineStatus } from '../actions.mjs';
import { showToast } from '../screens.mjs';

export default function AgentRunScreen({ targetDir, navigate }) {
  const [status, setStatus] = useState('idle');
  const [output, setOutput] = useState([]);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Check pre-flight
    const cfg = getConfig(targetDir);
    const st = getPipelineStatus(targetDir);
    if (!cfg.ok) { setError('No harness config found'); return; }
    if (!cfg.data.agentTool) { setError('No agent tool configured. Press t from dashboard.'); return; }
    if (!cfg.data.currentPhase) { setError('No current phase. Press n from dashboard to start.'); return; }
    if (cfg.data.paused) { setError('Pipeline paused. Press r from dashboard to resume.'); return; }

    setPipelineStatus(st.data);

    // Start supervisor
    (async () => {
      try {
        const { startSupervisor } = await import('../../lib/supervisor.mjs');
        const { getToolEntry } = await import('../../lib/tool-registry.mjs');

        // Load spawn adapter
        const tool = cfg.data.agentTool;
        const SPAWNABLE = ['hermes', 'openclaw', 'claude-code'];
        if (!SPAWNABLE.includes(tool)) {
          setError(`Tool "${tool}" does not support spawning. Use Tier-1 tool (hermes, openclaw, claude-code).`);
          return;
        }

        const adapterLoaders = {
          'hermes': () => import('../../adapters/hermes/spawn.mjs'),
          'openclaw': () => import('../../adapters/openclaw/spawn.mjs'),
          'claude-code': () => import('../../adapters/claude-code/spawn.mjs'),
        };
        const adapterMod = await adapterLoaders[tool]();
        const adapter = adapterMod.default || adapterMod;

        if (adapter.isAvailable && !adapter.isAvailable()) {
          setError(`'${tool}' not found on PATH. Install it first.`);
          return;
        }

        setStatus('running');
        setOutput(prev => [...prev, `🚀 Starting orchestrator with ${tool}...`]);

        const result = await startSupervisor(targetDir, {
          agentTool: tool,
          adapter,
          json: false,
          verbose: true,
          useTui: true,
          apiRetries: cfg.data.supervisor?.apiRetries ?? 5,
          backoffMs: cfg.data.supervisor?.backoffMs ?? 60000,
          onTransition: () => {},
        });

        setStatus(result.status);
        setOutput(prev => [...prev, '', result.message]);
      } catch (err) {
        setError(`Orchestrator error: ${err.message}`);
        setStatus('error');
      }
    })();
  }, [targetDir]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      navigate.pop();
    }
  });

  if (error) {
    return h(Box, { flexDirection: 'column' },
      h(Badge, { status: 'fail' }),
      h(Text, { color: 'red' }, error),
      h(Text, { dimColor: true, marginTop: 1 }, 'Press Esc to go back'),
    );
  }

  return h(Box, { flexDirection: 'column' },
    h(Box, null,
      h(Badge, { status: status === 'running' ? 'running' : status === 'complete' ? 'pass' : 'pending' }),
      h(Text, { dimColor: true }, `  ${pipelineStatus?.phase || ''}  |  ${pipelineStatus?.mode || ''}`),
    ),
    h(Box, { marginTop: 1, flexDirection: 'column' },
      h(Text, { bold: true }, 'Agent Output:'),
      h(ScrollView, { content: output.join('\n'), height: 15 }),
    ),
    h(StatusBar, { keys: [
      { key: 'p', label: 'pause' },
      { key: 'Esc', label: 'back' },
      { key: 'q', label: 'quit' },
    ] }),
  );
}

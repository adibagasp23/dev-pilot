import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import type { Process } from '@/types';
import FlutterQuickActions from '../components/FlutterQuickActions';
import TerminalInput from '../components/TerminalInput';
import { toast } from '../components/Snackbar';

interface RunningProcess extends Process {
  project_name: string;
  project_type: string;
}

export default function Monitor() {
  const navigate = useNavigate();
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [logs, setLogs] = useState<Record<number, string>>({});
  const preRefs = useRef<Record<number, HTMLPreElement | null>>({});
  const userScrolled = useRef<Record<number, boolean>>({});

  // Fetch running processes
  const fetchProcesses = async () => {
    try {
      const data = await api.getRunningProcesses();
      setProcesses(data.processes);
    } catch {}
  };

  // Initial fetch
  useEffect(() => {
    fetchProcesses();
  }, []);

  // Poll for running processes
  useEffect(() => {
    const interval = setInterval(fetchProcesses, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll logs for all running processes
  useEffect(() => {
    const interval = setInterval(() => {
      const pids = processes.map((p) => p.id);
      if (pids.length === 0) return;

      pids.forEach((pid) => {
        api.getLogs(pid).then((data) => {
          const all = data.lines.map((l: { t: string }) => l.t).join('');
          setLogs((prev) => ({
            ...prev,
            [pid]: all || '',
          }));
          if (data.status && data.status !== 'running') {
            setProcesses((prev) =>
              prev.map((p) =>
                p.id === pid ? { ...p, status: data.status as 'running' | 'stopped' | 'error' } : p
              )
            );
          }
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [processes]);

  // Auto-scroll log panels
  useEffect(() => {
    Object.entries(preRefs.current).forEach(([pid, pre]) => {
      if (!pre) return;
      if (!userScrolled.current[parseInt(pid)]) {
        pre.scrollTop = pre.scrollHeight;
      }
    });
  }, [logs]);

  const handleLogScroll = (pid: number, pre: HTMLPreElement) => {
    const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 50;
    userScrolled.current[pid] = !atBottom;
  };

  const handleStop = async (pid: number) => {
    try {
      await api.stopProcess(pid);
      await api.clearLogs(pid);
      setProcesses((prev) => prev.filter((p) => p.id !== pid));
      setLogs((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
    } catch {}
  };

  const handleClear = (pid: number) => {
    setLogs((prev) => ({ ...prev, [pid]: '' }));
    api.clearLogs(pid).catch(() => {});
  };

  if (processes.length === 0) {
    return (
      <div className="flex-1 p-8 text-center text-gray-500 mt-20">
        <div className="text-4xl mb-4">📡</div>
        <h2 className="text-xl font-semibold mb-2">No Running Processes</h2>
        <p className="text-sm">
          Start a process from{' '}
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="text-emerald-400 underline">
            All Projects
          </a>{' '}
          to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-white">
          📊 Monitor — {processes.length} running
        </h2>
        <button
          onClick={fetchProcesses}
          className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {processes.map((proc) => (
        <div
          key={proc.id}
          className="rounded border overflow-hidden"
          style={{ borderColor: '#30363d' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ backgroundColor: '#161b22' }}
          >
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm font-medium text-white">{proc.project_name}</span>
              <span className="text-xs text-gray-400">/</span>
              <span className="text-sm text-gray-300">{proc.label}</span>
              {proc.port ? (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#0d1117', border: '1px solid #4ade80', color: '#4ade80' }}>
                  :{proc.port}
                </span>
              ) : null}
              <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded" style={{ border: '1px solid #30363d' }}>
                {proc.project_type}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const cmd = proc.command.replace(/{PORT}/g, proc.port ? String(proc.port) : '');
                  navigator.clipboard.writeText(cmd);
                  toast('Command copied!');
                }}
                className="text-gray-500 hover:text-emerald-400 transition text-xs"
                title="Copy command"
              >
                📋
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(logs[proc.id] || '');
                  toast('Log copied!');
                }}
                className="text-xs text-gray-500 hover:text-emerald-400 transition"
                title="Copy all log"
              >
                📋 All
              </button>
              <button
                onClick={() => handleClear(proc.id)}
                className="text-xs text-gray-500 hover:text-red-400 transition"
                title="Clear terminal"
              >
                🗑 Clear
              </button>
              <button
                onClick={() => handleStop(proc.id)}
                className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600 transition"
              >
                Stop
              </button>
            </div>
          </div>

          {/* Log area */}
          <pre
            ref={(el) => { preRefs.current[proc.id] = el; }}
            onScroll={(e) => handleLogScroll(proc.id, e.currentTarget)}
            className="text-xs p-4 overflow-auto max-h-[30vh] min-h-[8rem] font-mono leading-relaxed select-text"
            style={{
              backgroundColor: '#0d1117',
              color: '#4ade80',
            }}
          >
            {logs[proc.id] || 'Waiting for output...'}
          </pre>

          {/* Quick actions + Input */}
          <div
            className="px-3 py-2 space-y-2"
            style={{
              backgroundColor: '#0d1117',
              borderTop: '1px solid #21262d',
            }}
          >
            {proc.project_type === 'flutter' && (
              <FlutterQuickActions
                processId={proc.id}
                onSend={(pid, key) => api.sendInput(pid, key).catch(() => {})}
              />
            )}
            <TerminalInput
              processId={proc.id}
              onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

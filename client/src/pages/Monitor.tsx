import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import type { Process } from '@/types';
import FlutterQuickActions from '../components/FlutterQuickActions';
import TerminalInput from '../components/TerminalInput';
import { toast } from '../components/Snackbar';
import { getFlutterDevice } from '@/utils/flutterDevice';

interface RunningProcess extends Process {
  project_name: string;
  project_type: string;
}

type Tab = 'running' | 'recent';

export default function Monitor() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('running');
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [recentProcesses, setRecentProcesses] = useState<RunningProcess[]>([]);
  const [logs, setLogs] = useState<Record<number, string>>({});
  const preRefs = useRef<Record<number, HTMLPreElement | null>>({});
  const userScrolled = useRef<Record<number, boolean>>({});
  const [recentFilter, setRecentFilter] = useState<string>('flutter');

  // Fetch running processes
  const fetchProcesses = async () => {
    try {
      const data = await api.getRunningProcesses();
      setProcesses(data.processes);
    } catch {}
  };

  // Fetch recent processes
  const fetchRecent = async (type?: string) => {
    try {
      const data = await api.getRecentProcesses(type);
      setRecentProcesses(data.processes);
    } catch {}
  };

  // Initial fetch
  useEffect(() => {
    fetchProcesses();
    fetchRecent('flutter');
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

  // Group processes by their parent folder
  const groups = useMemo(() => {
    const map = new Map<string, RunningProcess[]>();
    for (const proc of processes) {
      const segs = proc.project_name.replace(/^~\//, '').split('/');
      const group = segs.length > 1 ? segs.slice(0, -1).join(' / ') : 'general';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(proc);
    }
    // Sort groups: multi-folder groups first, then singles, by name
    const sorted = [...map.entries()].sort((a, b) => {
      const aMulti = a[1].length > 1 ? 0 : 1;
      const bMulti = b[1].length > 1 ? 0 : 1;
      if (aMulti !== bMulti) return aMulti - bMulti;
      return a[0].localeCompare(b[0]);
    });
    return sorted;
  }, [processes]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin}m yang lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}j yang lalu`;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === 'recent') {
      fetchRecent(recentFilter === 'all' ? undefined : recentFilter);
    } else {
      fetchProcesses();
    }
  };

  const handleFilterChange = (type: string) => {
    setRecentFilter(type);
    fetchRecent(type === 'all' ? undefined : type);
  };

  const tabs = [
    { key: 'running' as Tab, label: '▶ Running', count: processes.length },
    { key: 'recent' as Tab, label: '📋 Recent', count: recentProcesses.length },
  ];

  const typeFilters = [
    { key: 'flutter', label: '📱 Flutter' },
    { key: 'all', label: '📦 All' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t text-sm font-medium transition ${
              tab === t.key
                ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-400'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Running Tab */}
      {tab === 'running' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">
              📊 Monitor — {processes.length} running
            </h2>
            <div className="flex gap-2">
              {processes.length > 1 && (
                <button
                  onClick={async () => {
                    await api.stopAllProcesses();
                    setProcesses([]);
                    setLogs({});
                    toast('All processes stopped');
                  }}
                  className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded hover:bg-red-500/30 transition border border-red-500/30"
                >
                  ⏹ Stop All
                </button>
              )}
              <button
                onClick={fetchProcesses}
                className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {processes.length === 0 ? (
            <div className="flex-1 p-8 text-center text-gray-500 mt-10">
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
          ) : (
            groups.map(([groupName, procs]) => (
              <div key={groupName}>
                {/* Group header */}
                <a
                  href={`/?group=${encodeURIComponent(groupName)}`}
                  onClick={(e) => { e.preventDefault();
                    if (procs[0]) navigate(`/project/${procs[0].project_id}`);
                  }}
                  className="flex items-center gap-2 px-1 py-2 mb-1 group cursor-pointer"
                >
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest group-hover:text-emerald-400 transition">
                    {groupName}
                  </span>
                  <span className="text-[10px] text-gray-600 font-mono">({procs.length})</span>
                  <div className="flex-1 border-b border-white/5" />
                  <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition">
                    📂
                  </span>
                </a>

                {procs.map((proc) => {
                  const deviceInfo =
                    proc.project_type === 'flutter' ? getFlutterDevice(logs[proc.id] || '') : null;
                  return (
                  <div
                    key={proc.id}
                    className="rounded border overflow-hidden mb-3"
                    style={{ borderColor: '#30363d' }}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center justify-between px-4 py-2"
                      style={{ backgroundColor: '#161b22' }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <a
                              href={`/project/${proc.project_id}`}
                              onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); }}
                              className="text-sm font-medium text-white hover:text-emerald-400 transition cursor-pointer"
                            >
                              {proc.project_name.split('/').pop()}
                            </a>
                            <span className="text-xs text-gray-400">/</span>
                            <span className="text-sm text-gray-300">{proc.label}</span>
                            {deviceInfo && (
                              <span
                                title={`Running on ${deviceInfo.device}`}
                                className="text-xs font-mono px-1.5 py-0.5 rounded"
                                style={{
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  border: '1px solid #38bdf8',
                                  color: '#7dd3fc',
                                  boxShadow: '0 0 8px rgba(56, 189, 248, 0.35)',
                                }}
                              >
                                {deviceInfo.icon} {deviceInfo.device}
                              </span>
                            )}
                            {proc.port ? (
                              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#0d1117', border: '1px solid #4ade80', color: '#4ade80' }}>
                                :{proc.port}
                              </span>
                            ) : null}
                            <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded" style={{ border: '1px solid #30363d' }}>
                              {proc.project_type}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{proc.project_name.replace(/^~\//, '')}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cmd = proc.command.replace(/{PORT}/g, proc.port ? String(proc.port) : '');
                            const fullCmd = `cd ${proc.project_name.replace(/^~/, '$HOME')} && ${cmd}`;
                            navigator.clipboard.writeText(fullCmd);
                            toast('Copied: ' + fullCmd.slice(0, 60) + (fullCmd.length > 60 ? '…' : ''));
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
                        <a
                          href={`/project/${proc.project_id}`}
                          onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); }}
                          className="text-xs text-gray-500 hover:text-emerald-400 transition"
                          title="Open project"
                        >
                          📂
                        </a>
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
                          onOpenDevTools={(pid) => {
                            const logText = logs[pid] || '';
                            const devToolsMatch = logText.match(/https?:\/\/[^\s]+\/devtools\/\?uri=ws:[^\s]+/);
                            const vmMatch = logText.match(/https?:\/\/127\.0\.0\.1:\d+\/[^\s/]+\//);
                            if (devToolsMatch) {
                              window.open(devToolsMatch[0], '_blank');
                              toast('🔧 Opening DevTools...');
                            } else if (vmMatch) {
                              window.open(vmMatch[0], '_blank');
                              toast('🔧 Opening VM Service (DevTools URL belum terdeteksi)...');
                            } else {
                              toast('⚠️ DevTools URL belum muncul. Tunggu sampai Flutter selesai build.');
                            }
                          }}
                        />
                      )}
                      <TerminalInput
                        processId={proc.id}
                        onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            ))
          )}
        </>
      )}

      {/* Recent Tab */}
      {tab === 'recent' && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-white">
              📋 Recent Processes
            </h2>
            <div className="flex gap-2">
              {/* Type filter: Flutter / All */}
              <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
                {typeFilters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => handleFilterChange(f.key)}
                    className={`text-xs px-3 py-1.5 rounded-md transition ${
                      recentFilter === f.key
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchRecent(recentFilter === 'all' ? undefined : recentFilter)}
                className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded hover:bg-gray-600 transition"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {recentProcesses.length === 0 ? (
            <div className="flex-1 p-8 text-center text-gray-500 mt-10">
              <div className="text-4xl mb-4">📭</div>
              <h2 className="text-xl font-semibold mb-2">No Recent Runs</h2>
              <p className="text-sm">
                Processes that have been run will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentProcesses.map((proc) => (
                <div
                  key={proc.id}
                  className="rounded border overflow-hidden"
                  style={{ borderColor: '#30363d' }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ backgroundColor: '#161b22' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Status icon */}
                      <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${
                        proc.status === 'running' ? 'bg-green-500' :
                        proc.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate max-w-[200px]">
                            {proc.project_name.split('/').pop()}
                          </span>
                          <span className="text-xs text-gray-400">/</span>
                          <span className="text-sm text-gray-300 truncate">{proc.label}</span>
                          <span className="text-xs text-gray-500 px-1.5 py-0.5 rounded" style={{ border: '1px solid #30363d' }}>
                            {proc.project_type}
                          </span>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                            proc.status === 'stopped' ? 'bg-gray-700 text-gray-400' :
                            proc.status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {proc.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{proc.project_name.replace(/^~\//, '')}</span>
                          {proc.started_at && (
                            <span className="flex items-center gap-1">
                              <span>▶</span>
                              <span>{formatTime(proc.started_at)}</span>
                            </span>
                          )}
                          {proc.stopped_at && (
                            <span className="flex items-center gap-1">
                              <span>⏹</span>
                              <span>{formatTime(proc.stopped_at)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          const cmd = proc.command.replace(/{PORT}/g, proc.port ? String(proc.port) : '');
                          const fullCmd = `cd ${proc.project_name.replace(/^~/, '$HOME')} && ${cmd}`;
                          navigator.clipboard.writeText(fullCmd);
                          toast('Copied: ' + fullCmd.slice(0, 60) + (fullCmd.length > 60 ? '…' : ''));
                        }}
                        className="text-xs text-gray-500 hover:text-emerald-400 transition"
                        title="Copy command"
                      >
                        📋
                      </button>
                      <a
                        href={`/project/${proc.project_id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); }}
                        className="text-xs text-gray-500 hover:text-emerald-400 transition"
                        title="Open project"
                      >
                        📂
                      </a>
                      <button
                        onClick={async () => {
                          try {
                            await api.startProcess(proc.id);
                            toast(`▶ Started ${proc.label}`);
                            // Refresh after a moment
                            setTimeout(() => fetchRecent(recentFilter === 'all' ? undefined : recentFilter), 1000);
                          } catch (err: any) {
                            toast(`❌ ${err.message}`);
                          }
                        }}
                        className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-500/30 transition border border-emerald-500/30"
                      >
                        ▶ Run Again
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

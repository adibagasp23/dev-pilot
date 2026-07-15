import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Project, Process } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '../components/Snackbar';
import FlutterQuickActions from '../components/FlutterQuickActions';
import TerminalInput from '../components/TerminalInput';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [port, setPort] = useState('');
  const [editPort, setEditPort] = useState<Record<number, string>>({});
  const [logs, setLogs] = useState<Record<number, string>>({});
  const [openLogs, setOpenLogs] = useState<Record<number, boolean>>({});
  const dragItem = useRef<number | null>(null);
  const canDrag = useRef(false);
  const processesRef = useRef<Process[]>([]);
  const preRefs = useRef<Record<number, HTMLPreElement | null>>({});
  const userScrolled = useRef<Record<number, boolean>>({});

  const load = useCallback(() => {
    if (!id) return;
    api.getProject(parseInt(id)).then((data) => {
      setProject(data.project);
      setProcesses(data.processes);
      processesRef.current = data.processes;

      // Auto-open log for running processes
      const running = data.processes.filter((p: Process) => p.status === 'running');
      if (running.length > 0) {
        const logState: Record<number, boolean> = {};
        running.forEach((p: Process) => { logState[p.id] = true; });
        setOpenLogs((prev) => ({ ...prev, ...logState }));

        running.forEach((p: Process) => {
          api.getLogs(p.id).then((logData) => {
            const all = logData.lines.map(l => l.t).join('');
            setLogs((prev2) => ({ ...prev2, [p.id]: all || 'Waiting for output...' }));
          });
        });
      }
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-scroll log panels to bottom when new data arrives (unless user scrolled up)
  useEffect(() => {
    Object.entries(preRefs.current).forEach(([pid, pre]) => {
      if (!pre) return;
      const wasUserScroll = userScrolled.current[parseInt(pid)];
      if (!wasUserScroll) {
        pre.scrollTop = pre.scrollHeight;
      }
    });
  }, [logs]);

  const handleLogScroll = (pid: number, pre: HTMLPreElement) => {
    const atBottom = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 50;
    userScrolled.current[pid] = !atBottom;
  };

  // Poll logs for open panels
  useEffect(() => {
    const interval = setInterval(() => {
      const openIds = Object.entries(openLogs)
        .filter(([, v]) => v)
        .map(([k]) => parseInt(k));

      if (openIds.length === 0) return;

      openIds.forEach((pid) => {
        api.getLogs(pid).then((data) => {
          const all = data.lines.map(l => l.t).join('');
          setLogs((prev) => ({
            ...prev,
            [pid]: all || (prev[pid] === undefined ? 'Waiting for output...' : ''),
          }));
          // Sync process status from log endpoint
          if (data.status) {
            setProcesses((prev) =>
              prev.map((p) => (p.id === pid ? { ...p, status: data.status as 'running' | 'stopped' | 'error' } : p))
            );
          }
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [openLogs]);

  const handleStart = async (procId: number) => {
    const updated = await api.startProcess(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    // Auto-open terminal log
    if (!openLogs[procId]) {
      setOpenLogs((prev) => ({ ...prev, [procId]: true }));
      api.getLogs(procId).then((data) => {
        const all = data.lines.map(l => l.t).join('');
        setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
      });
    }
  };

  const handleRestart = async (procId: number) => {
    await api.stopProcess(procId);
    await api.clearLogs(procId);
    await new Promise((r) => setTimeout(r, 300));
    const updated = await api.startProcess(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    // Auto-open terminal
    if (!openLogs[procId]) {
      setOpenLogs((prev) => ({ ...prev, [procId]: true }));
      api.getLogs(procId).then((data) => {
        const all = data.lines.map(l => l.t).join('');
        setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
      });
    }
  };

  const handleStop = async (procId: number) => {
    const updated = await api.stopProcess(procId);
    await api.clearLogs(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    // Close terminal panel + cleanup log state to prevent memory leak
    setOpenLogs((prev) => {
      const next = { ...prev };
      delete next[procId];
      return next;
    });
    setLogs((prev) => {
      const next = { ...prev };
      delete next[procId];
      return next;
    });
  };

  const handleAdd = async () => {
    if (!label || !command || !id) return;
    try {
      const proc = await api.addProcess(parseInt(id), label, command, port);
      setProcesses((prev) => {
        const next = [...prev, proc];
        processesRef.current = next;
        return next;
      });
      setLabel('');
      setCommand('');
      setPort('');
      toast('Command added!');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleSavePort = async (procId: number) => {
    const val = editPort[procId];
    try {
      const updated = await api.updateProcess(procId, { port: val || null });
      setProcesses((prev) => prev.map((p) => (p.id === procId ? { ...p, port: updated.port } : p)));
      setEditPort((prev) => {
        const next = { ...prev };
        delete next[procId];
        return next;
      });
      toast(val ? `Port set to ${val}` : 'Port removed');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const copyVisibleLog = (procId: number) => {
    const pre = preRefs.current[procId];
    if (!pre) return;
    const text = pre.textContent || '';
    const lines = text.split('\n');

    // Calculate which lines are visible based on scroll position
    const lineCount = lines.length;
    if (lineCount <= 1) {
      navigator.clipboard.writeText(text);
      toast('Copied!');
      return;
    }

    const lineHeight = pre.scrollHeight / lineCount;
    const start = Math.max(0, Math.floor(pre.scrollTop / lineHeight) - 1);
    const end = Math.min(lineCount, Math.ceil((pre.scrollTop + pre.clientHeight) / lineHeight) + 1);
    const visible = lines.slice(start, end).join('\n');

    navigator.clipboard.writeText(visible);
    toast('Visible log copied!');
  };

  const toggleLog = (procId: number) => {
    setOpenLogs((prev) => {
      const next = { ...prev, [procId]: !prev[procId] };
      // Fetch log on open
      if (next[procId]) {
        api.getLogs(procId).then((data) => {
          const all = data.lines.map(l => l.t).join('');
          setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
        });
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, procId: number) => {
    if (!canDrag.current) {
      e.preventDefault();
      return;
    }
    canDrag.current = false;
    dragItem.current = procId;
  };

  const handleDragOver = (e: React.DragEvent, procId: number) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === procId) return;

    const newList = [...processesRef.current];
    const fromIdx = newList.findIndex((p) => p.id === dragItem.current);
    const toIdx = newList.findIndex((p) => p.id === procId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    processesRef.current = newList;
    setProcesses(newList);
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || !id) return;
    const order = processesRef.current.map((p) => p.id).join(',');
    await api.reorder(parseInt(id), order);
    dragItem.current = null;
  };

  if (!project) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Dashboard
        </Link>
        <h2 className="text-2xl font-bold text-gray-800 mt-1">{project.name}</h2>
        <div className="flex items-center gap-1.5 text-sm">
          <p className="text-gray-500">{project.path}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(project.path);
              toast('Path copied!');
            }}
            className="text-gray-400 hover:text-emerald-500 transition text-xs cursor-pointer"
            title="Copy path"
          >
            📋
          </button>
        </div>
        <Badge
          className={`mt-1 ${
            project.type === 'flutter'
              ? 'bg-blue-100 text-blue-700'
              : project.type === 'next'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-orange-100 text-orange-700'
          }`}
        >
          {project.type.charAt(0).toUpperCase() + project.type.slice(1)}
        </Badge>
      </div>

      {/* Add command */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-700 mb-3">Tambah Command Baru</h3>
          <div className="flex gap-2">
            <Input
              placeholder="Label (e.g., Custom Server)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Command (e.g., node server.js)"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Port"
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
              style={{ width: '60px', minWidth: '60px' }}
              type="text"
              inputMode="numeric"
            />
            <button
              onClick={handleAdd}
              className="bg-emerald-500 text-white px-3 py-1 rounded text-sm hover:bg-emerald-600 whitespace-nowrap"
            >
              Tambah
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Process list */}
      <div className="space-y-1">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-700">Commands</h3>
          <span className="text-xs text-gray-400">↕ drag to sort</span>
        </div>

        {processes.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada command.</p>
        ) : (
          <div className="space-y-2">
            {processes.map((proc) => (
              <Card
                key={proc.id}
                className="draggable"
                draggable
                onDragStart={(e) => handleDragStart(e, proc.id)}
                onDragOver={(e) => handleDragOver(e, proc.id)}
                onDragEnd={handleDragEnd}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span
                      className="drag-handle cursor-grab text-gray-400 hover:text-gray-600 text-lg select-none"
                      onMouseDown={() => { canDrag.current = true; }}
                    >
                      ⠿
                    </span>
                    <div>
                      <p className="font-medium text-gray-800">{proc.label}</p>
                      <div className="flex items-center gap-1.5">
                        <code className="text-xs text-gray-500">{proc.command}</code>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const cmd = proc.command.replace(/{PORT}/g, proc.port ? String(proc.port) : '');
                            navigator.clipboard.writeText(cmd);
                            toast('Command copied!');
                          }}
                          className="text-gray-400 hover:text-emerald-500 transition text-xs cursor-pointer"
                          title="Copy command"
                        >
                          📋
                        </button>
                        {editPort[proc.id] !== undefined ? (
                          <span className="inline-flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editPort[proc.id]}
                              onChange={(e) =>
                                setEditPort((prev) => ({
                                  ...prev,
                                  [proc.id]: e.target.value.replace(/\D/g, '').slice(0, 5),
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSavePort(proc.id);
                                if (e.key === 'Escape') {
                                  setEditPort((prev) => {
                                    const next = { ...prev };
                                    delete next[proc.id];
                                    return next;
                                  });
                                }
                              }}
                              onBlur={() => handleSavePort(proc.id)}
                              className="w-16 text-xs px-1 py-0.5 rounded font-mono outline-none"
                              style={{
                                background: '#0d1117',
                                border: '1px solid #4ade80',
                                color: '#4ade80',
                              }}
                              autoFocus
                            />
                          </span>
                        ) : (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPort((prev) => ({
                                ...prev,
                                [proc.id]: proc.port ? String(proc.port) : '',
                              }));
                            }}
                            className="text-xs text-green-400 bg-gray-900 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-gray-800 transition"
                            title="Click to edit port"
                          >
                            {proc.port ? `:${proc.port}` : '+ port'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full inline-block ${
                          proc.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          proc.status === 'running' ? 'text-green-600' : 'text-gray-600'
                        }`}
                      >
                        {proc.status.charAt(0).toUpperCase() + proc.status.slice(1)}
                      </span>
                      {proc.status === 'running' ? (
                        <>
                          <button
                            onClick={() => handleStop(proc.id)}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition"
                          >
                            Stop
                          </button>
                          <button
                            onClick={() => handleRestart(proc.id)}
                            className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-500 transition"
                          >
                            Restart
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleStart(proc.id)}
                          className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition"
                        >
                          Start
                        </button>
                      )}
                      {proc.pid && (
                        <span className="text-xs text-gray-400">PID: {proc.pid}</span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleLog(proc.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1 transition"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Log panel */}
                {openLogs[proc.id] && (
                  <div className="border-t border-gray-200 p-3">
                    <div
                      className="rounded-lg overflow-hidden shadow-lg"
                      style={{ border: '1px solid #374151' }}
                    >
                      {/* Terminal header */}
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{
                          backgroundColor: '#0d1117',
                          borderBottom: '1px solid #374151',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span className="text-xs text-gray-500 ml-2">terminal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(logs[proc.id] || '');
                              toast('Full log copied!');
                            }}
                            className="text-xs text-gray-500 hover:text-emerald-400 transition cursor-pointer"
                            title="Copy full log"
                          >
                            📋 All
                          </button>
                          <button
                            onClick={() => copyVisibleLog(proc.id)}
                            className="text-xs text-gray-500 hover:text-emerald-400 transition cursor-pointer"
                            title="Copy visible area"
                          >
                            👁 View
                          </button>
                          <button
                            onClick={() => {
                              setLogs((prev) => ({ ...prev, [proc.id]: '' }));
                              api.clearLogs(proc.id).catch(() => {});
                              toast('Terminal cleared!');
                            }}
                            className="text-xs text-gray-500 hover:text-red-400 transition cursor-pointer"
                            title="Clear terminal"
                          >
                            🗑 Clear
                          </button>
                        </div>
                      </div>
                      {/* Output */}
                      <pre
                        ref={(el) => { preRefs.current[proc.id] = el; }}
                        onScroll={(e) => handleLogScroll(proc.id, e.currentTarget)}
                        className="text-xs p-4 overflow-auto max-h-[70vh] min-h-[20rem] font-mono leading-relaxed select-text"
                        style={{
                          backgroundColor: '#0d1117',
                          color: '#4ade80',
                          userSelect: 'text',
                        }}
                      >
                        {logs[proc.id] || 'Waiting for output...'}
                      </pre>
                      {/* Quick action buttons */}
                      <div
                        className="flex gap-1 px-3 py-1.5 flex-wrap"
                        style={{
                          backgroundColor: '#0d1117',
                          borderTop: '1px solid #21262d',
                        }}
                      >
                        {project.type === 'flutter' && (
                        <FlutterQuickActions
                          processId={proc.id}
                          onSend={(pid, key) => api.sendInput(pid, key).catch(() => {})}
                        />
                      )}
                      </div>
                      <TerminalInput
                        processId={proc.id}
                        onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

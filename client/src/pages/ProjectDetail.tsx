import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import KanbanBoard from '../components/KanbanBoard';
import { api, tasksApi, taskStatusesApi, type Task, type TaskStatus } from '../api';
import type { Project, Process } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '../components/Snackbar';
import ProcessLogPanel from '../components/ProcessLogPanel';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [port, setPort] = useState('');
  const [editPort, setEditPort] = useState<Record<number, string>>({});
  const [logs, setLogs] = useState<Record<number, string>>({});
  const [openLogs, setOpenLogs] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [siblings, setSiblings] = useState<{ id: number; name: string; type: string; is_active: boolean }[]>([]);
  const dragItem = useRef<number | null>(null);
  const canDrag = useRef(false);
  const processesRef = useRef<Process[]>([]);

  // Tasks state
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'commands' | 'tasks'>('commands');

  const load = useCallback(() => {
    if (!id) return;
    setActiveTab('commands');
    api.getProject(parseInt(id)).then((data) => {
      setProject(data.project);
      setSiblings(data.siblings || []);
      // Sort: favorites first, then by sort_order
      const sorted = [...data.processes].sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      setProcesses(sorted);
      processesRef.current = sorted;

      // Auto-start if ?autoStart=true
      if (searchParams.get('autoStart') === 'true' && data.processes.length > 0) {
        const firstProc = data.project.default_process_id
          ? data.processes.find((p: Process) => p.id === data.project.default_process_id) || data.processes[0]
          : data.processes[0];
        api.startProcess(firstProc.id).then(() => {
          setOpenLogs((prev) => ({ ...prev, [firstProc.id]: true }));
          load(); // reload to get running status
        }).catch(() => {});
      }

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

      // Load project tasks from all sibling projects
      const projectIds = [data.project.id, ...(data.siblings || []).map((s: any) => s.id)];
      const uniqueIds = [...new Set(projectIds)];
      Promise.all([
        ...uniqueIds.map(pid => tasksApi.list({ project_id: pid, status: 'todo' })),
        ...uniqueIds.map(pid => tasksApi.list({ project_id: pid, status: 'in_progress' })),
      ]).then((results) => {
        const all = results.flatMap(r => r.tasks).slice(0, 10);
        setProjectTasks(all);
        // Load task statuses
        taskStatusesApi.list().then(d => setTaskStatuses(d.statuses)).catch(() => {});
      }).catch(() => {});
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load])  // Poll logs for open panels
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
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    toast('Process stopped');
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
        <div className="flex items-center gap-2 mt-1">
          <h2 className="text-2xl font-bold text-gray-800">{project.name}</h2>
        </div>
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
        {/* Sibling + Tab nav */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {siblings.map((s) => (
            <a
              key={s.id}
              href={`/project/${s.id}`}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                s.is_active && activeTab !== 'tasks'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                style={{
                  backgroundColor:
                    s.type === 'flutter' ? '#3b82f6' :
                    s.type === 'laravel' ? '#f97316' :
                    s.type === 'next' ? '#6b7280' :
                    s.type === 'agent' ? '#8b5cf6' :
                    s.type === 'rust' ? '#ef4444' :
                    s.type === 'strapi' ? '#10b981' :
                    '#9ca3af'
                }}
              />
              {s.name.replace(/^.*\//, '')}
            </a>
          ))}
          <span className="w-px h-5 bg-gray-300 mx-1" />
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              activeTab === 'tasks'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📝 Tasks
            {projectTasks.length > 0 && (
              <span className="ml-1 text-xs opacity-80">({projectTasks.length})</span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'commands' && (
        <>
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

          {/* Search & Commands header */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-700">Commands</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Cari command…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-6 pr-6 py-1 rounded border border-gray-300 focus:outline-none focus:border-emerald-400 w-48"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400">↕ drag to sort</span>
            </div>
          </div>

          {processes.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada command.</p>
          ) : (
            <div className="space-y-2">
              {processes
                .filter((proc) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    proc.label.toLowerCase().includes(q) ||
                    proc.command.toLowerCase().includes(q) ||
                    (proc.port && String(proc.port).includes(q))
                  );
                })
                .map((proc) => (
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (proc.id !== project.default_process_id) {
                            api.setDefaultProcess(project.id, proc.id).then(({ project: p }) => {
                              setProject(p);
                              toast('Default command set!');
                            }).catch((err: any) => toast(err.message));
                          }
                        }}
                        className={`text-sm transition cursor-pointer ${
                          proc.id === project.default_process_id
                            ? 'text-red-500 hover:text-red-400'
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                        title={proc.id === project.default_process_id ? 'Default command' : 'Set as default'}
                      >
                        {proc.id === project.default_process_id ? '★' : '☆'}
                      </button>
                      <span
                        className="drag-handle cursor-grab text-gray-400 hover:text-gray-600 text-lg select-none"
                        onMouseDown={() => { canDrag.current = true; }}
                      >
                        ⠿
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const fav = !proc.is_favorite;
                          await api.toggleProcessFavorite(proc.id, fav);
                          proc.is_favorite = fav;
                          // Re-sort: move favorites to top
                          const reSorted = [...processes].sort((a, b) => {
                            if (a.is_favorite && !b.is_favorite) return -1;
                            if (!a.is_favorite && b.is_favorite) return 1;
                            return (a.sort_order || 0) - (b.sort_order || 0);
                          });
                          setProcesses(reSorted);
                          processesRef.current = reSorted;
                          window.dispatchEvent(new Event('favorites-changed'));
                          toast(fav ? 'Pinned 📌' : 'Unpinned');
                        }}
                        className={`text-xs transition cursor-pointer ${
                          proc.is_favorite ? 'opacity-100' : 'opacity-30 hover:opacity-100'
                        }`}
                        title={proc.is_favorite ? 'Unpin command' : 'Pin command'}
                      >
                        📌
                      </button>
                      <div>
                        <p className="font-medium text-gray-800">
                          {proc.label}
                        </p>
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
                      <ProcessLogPanel
                        processId={proc.id}
                        log={logs[proc.id] || ''}
                        projectType={project.type}
                        onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
                        onCopyAll={() => {
                          navigator.clipboard.writeText(logs[proc.id] || '');
                          toast('Full log copied!');
                        }}
                        onCopyVisible={() => {
                          navigator.clipboard.writeText(logs[proc.id] || '');
                          toast('Log copied!');
                        }}
                        onClear={() => {
                          setLogs((prev) => ({ ...prev, [proc.id]: '' }));
                          api.clearLogs(proc.id).catch(() => {});
                          toast('Terminal cleared!');
                        }}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newTaskTitle.trim()) {
                  try {
                    const task = await tasksApi.create({ title: newTaskTitle.trim(), project_id: project.id, priority: 'medium' });
                    setProjectTasks(prev => [task, ...prev]);
                    setNewTaskTitle('');
                  } catch {}
                }
              }}
              placeholder="Add task…"
              className="flex-1 bg-gray-50 text-sm px-3 py-2 rounded border border-gray-300 outline-none focus:border-emerald-400"
            />
            <button
              onClick={async () => {
                if (!newTaskTitle.trim()) return;
                try {
                  const task = await tasksApi.create({ title: newTaskTitle.trim(), project_id: project.id, priority: 'medium' });
                  setProjectTasks(prev => [task, ...prev]);
                  setNewTaskTitle('');
                } catch {}
              }}
              className="text-sm bg-emerald-500 text-white px-3 py-1.5 rounded hover:bg-emerald-600 transition"
            >
              Add
            </button>
          </div>

          {projectTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No ongoing tasks.</p>
          ) : (
            <KanbanBoard
              tasks={projectTasks}
              statuses={taskStatuses}
              onStatusChange={async (taskId, newStatus) => {
                setProjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
                try {
                  const updated = await tasksApi.update(taskId, { status: newStatus });
                  setProjectTasks(prev => prev.map(t => t.id === taskId ? updated : t));
                } catch {
                  toast('Failed to update status');
                }
              }}
              onTaskClick={(task) => task.project_id && navigate(`/project/${task.project_id}`)}
              onDelete={async (id) => {
                try {
                  await tasksApi.remove(id);
                  setProjectTasks(prev => prev.filter(t => t.id !== id));
                  toast('Task deleted');
                } catch {}
              }}
              filterProjectId={project.id}
            />
          )}
        </>
      )}

    </div>
  );
}

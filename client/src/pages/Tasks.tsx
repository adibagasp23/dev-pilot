import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tasksApi, taskStatusesApi, type Task, type TaskStatus } from '../api';
import KanbanBoard from '../components/KanbanBoard';
import { toast } from '../components/Snackbar';

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [editStatusName, setEditStatusName] = useState('');
  const [editStatusId, setEditStatusId] = useState<number | null>(null);

  const load = async () => {
    try {
      const [taskData, projData, statusData] = await Promise.all([
        tasksApi.list(),
        fetch('/api/projects').then(r => r.json()),
        taskStatusesApi.list(),
      ]);
      setTasks(taskData.tasks);
      setProjects(projData.projects || []);
      setStatuses(statusData.statuses);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const task = await tasksApi.create({ title, project_id: newProjectId, priority: newPriority });
      setTasks(prev => [task, ...prev]);
      setNewTitle('');
      toast('Task added');
    } catch {}
  };

  const handleStatusChange = async (taskId: number, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    try {
      const updated = await tasksApi.update(taskId, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
    } catch {
      load();
      toast('Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tasksApi.remove(id);
      setTasks(prev => prev.filter(t => t.id !== id));
      toast('Task deleted');
    } catch {}
  };

  const handleAddStatus = async () => {
    const name = editStatusName.trim();
    if (!name) return;
    try {
      if (editStatusId !== null) {
        await taskStatusesApi.update(editStatusId, { name });
      } else {
        await taskStatusesApi.create({ name, sort_order: statuses.length });
      }
      setEditStatusName('');
      setEditStatusId(null);
      const statusData = await taskStatusesApi.list();
      setStatuses(statusData.statuses);
      toast(editStatusId !== null ? 'Status updated' : 'Status added');
    } catch (e: any) {
      toast(e.error || 'Failed');
    }
  };

  const handleDeleteStatus = async (id: number) => {
    try {
      await taskStatusesApi.remove(id);
      const statusData = await taskStatusesApi.list();
      setStatuses(statusData.statuses);
      toast('Status deleted');
    } catch (e: any) {
      toast(e.error || 'Failed');
    }
  };

  const handleMoveStatus = async (id: number, direction: 'up' | 'down') => {
    const idx = statuses.findIndex(s => s.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= statuses.length) return;
    const current = statuses[idx];
    const neighbor = statuses[newIdx];
    await taskStatusesApi.update(current.id, { sort_order: neighbor.sort_order });
    await taskStatusesApi.update(neighbor.id, { sort_order: current.sort_order });
    const statusData = await taskStatusesApi.list();
    setStatuses(statusData.statuses);
  };

  const totalStats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'done').length;
    return { total, done };
  }, [tasks]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-800">📝 Task Board</h2>
          {totalStats.total > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">{totalStats.done}/{totalStats.total}</span>
              <div className="w-20 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalStats.done / totalStats.total) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <button onClick={() => setShowStatusModal(true)} className="text-xs text-gray-400 hover:text-emerald-400 transition border border-gray-700 px-2.5 py-1 rounded">
          Manage Statuses
        </button>
      </div>

      <div className="rounded border p-3" style={{ borderColor: '#30363d', backgroundColor: '#161b22' }}>
        <div className="flex gap-2">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a new task..."
            className="flex-1 bg-[#0d1117] text-white text-sm px-3 py-2 rounded border outline-none focus:border-emerald-500/50" style={{ borderColor: '#30363d' }} />
          <select value={newProjectId ?? ''} onChange={e => setNewProjectId(e.target.value ? Number(e.target.value) : null)}
            className="bg-[#0d1117] text-gray-300 text-xs px-2 py-2 rounded border outline-none focus:border-emerald-500/50" style={{ borderColor: '#30363d' }}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name.split('/').pop()}</option>)}
          </select>
          <select value={newPriority} onChange={e => setNewPriority(e.target.value as 'low' | 'medium' | 'high')}
            className="bg-[#0d1117] text-gray-300 text-xs px-2 py-2 rounded border outline-none focus:border-emerald-500/50" style={{ borderColor: '#30363d' }}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button onClick={handleAdd} className="text-sm bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-500 transition">Add</button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 mt-10">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center text-gray-500 mt-10">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-sm">No tasks yet. Add one above!</p>
        </div>
      ) : (
        <KanbanBoard tasks={tasks} statuses={statuses} onStatusChange={handleStatusChange}
          onTaskClick={(task) => task.project_id && navigate(`/project/${task.project_id}`)} onDelete={handleDelete} />
      )}

      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowStatusModal(false)}>
          <div className="bg-[#161b22] rounded-xl border border-gray-700 p-5 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Manage Statuses</h3>
            <div className="flex gap-2 mb-3">
              <input value={editStatusName} onChange={e => setEditStatusName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddStatus()} placeholder="Status name..."
                className="flex-1 bg-[#0d1117] text-white text-sm px-2.5 py-1.5 rounded border outline-none focus:border-emerald-500/50" style={{ borderColor: '#30363d' }} />
              <button onClick={handleAddStatus} className="text-sm bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-500 transition">
                {editStatusId !== null ? 'Update' : 'Add'}
              </button>
              {editStatusId !== null && (
                <button onClick={() => { setEditStatusName(''); setEditStatusId(null); }} className="text-sm text-gray-400 px-2 py-1.5 rounded hover:text-white transition">✕</button>
              )}
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {statuses.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[#0d1117]">
                  <span className="flex-1 text-sm text-gray-300">{s.name}</span>
                  <button onClick={() => handleMoveStatus(s.id, 'up')} disabled={idx === 0} className="text-xs text-gray-500 hover:text-white disabled:opacity-30">↑</button>
                  <button onClick={() => handleMoveStatus(s.id, 'down')} disabled={idx === statuses.length - 1} className="text-xs text-gray-500 hover:text-white disabled:opacity-30">↓</button>
                  <button onClick={() => { setEditStatusName(s.name); setEditStatusId(s.id); }} className="text-xs text-gray-500 hover:text-emerald-400 transition">✏️</button>
                  <button onClick={() => handleDeleteStatus(s.id)} className="text-xs text-gray-500 hover:text-red-400 transition">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => setShowStatusModal(false)} className="mt-3 w-full text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded transition">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

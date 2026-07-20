import { useState, useRef, useCallback } from 'react';
import type { Task, TaskStatus } from '../api';
import DatePicker from './DatePicker';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'from-red-500 to-rose-600',
  medium: 'from-amber-400 to-orange-500',
  low: 'from-sky-400 to-blue-500',
};

const PRIORITY_BG: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-sky-500/10 text-sky-400',
};

interface KanbanBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  onStatusChange: (taskId: number, newStatus: string) => void;
  onTaskClick: (task: Task) => void;
  onUpdate: (taskId: number, data: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'due_date' | 'status'>>) => Promise<Task | undefined>;
  onDelete: (id: number) => void;
  onReorder?: (status: string, taskIds: number[]) => Promise<void>;
}

export default function KanbanBoard({ tasks, statuses, onStatusChange, onTaskClick, onUpdate, onDelete, onReorder }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragData = useRef<{ id: number; status: string } | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const startAutoScroll = useCallback((direction: 'left' | 'right') => {
    stopAutoScroll();
    const el = scrollRef.current;
    if (!el) return;

    const scroll = () => {
      if (!el) return;
      const amount = 8;
      if (direction === 'right') {
        el.scrollLeft += amount;
        if (el.scrollLeft < el.scrollWidth - el.clientWidth) {
          autoScrollRef.current = requestAnimationFrame(scroll);
        }
      } else {
        el.scrollLeft -= amount;
        if (el.scrollLeft > 0) {
          autoScrollRef.current = requestAnimationFrame(scroll);
        }
      }
    };
    autoScrollRef.current = requestAnimationFrame(scroll);
  }, [stopAutoScroll]);

  // Listen for drag end anywhere to stop auto-scroll
  const onDragEndGlobal = useCallback(() => {
    stopAutoScroll();
    dragData.current = null;
  }, [stopAutoScroll]);

  const openEdit = () => {
    if (!selectedTask) return;
    setEditTitle(selectedTask.title);
    setEditDescription(selectedTask.description || '');
    setEditPriority(selectedTask.priority);
    setEditDueDate(selectedTask.due_date || '');
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedTask) return;
    const title = editTitle.trim();
    if (!title) return;
    setSaving(true);
    const updated = await onUpdate(selectedTask.id, {
      title,
      description: editDescription || null,
      priority: editPriority,
      due_date: editDueDate || null,
    });
    setSaving(false);
    setIsEditing(false);
    if (updated) {
      setSelectedTask(updated);
    } else {
      setSelectedTask(prev => prev ? { ...prev, title, description: editDescription || null, priority: editPriority, due_date: editDueDate || null } : null);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, status: task.status }));
    e.dataTransfer.effectAllowed = 'move';
    dragData.current = { id: task.id, status: task.status };
    // Attach global dragend listener
    document.addEventListener('dragend', onDragEndGlobal, { once: true });
  };

  const handleDragOver = (e: React.DragEvent, statusName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(statusName);

    // Auto-scroll when dragging near edges
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const threshold = 80;
    if (e.clientX > rect.right - threshold) {
      startAutoScroll('right');
    } else if (e.clientX < rect.left + threshold) {
      startAutoScroll('left');
    } else {
      stopAutoScroll();
    }
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    // Also handle auto-scroll from container-level dragover
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const threshold = 80;
    if (e.clientX > rect.right - threshold) {
      startAutoScroll('right');
    } else if (e.clientX < rect.left + threshold) {
      startAutoScroll('left');
    } else {
      stopAutoScroll();
    }
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (!dragData.current) return;
    const data = dragData.current;
    dragData.current = null;
    if (data.status !== targetStatus) {
      onStatusChange(data.id, targetStatus);
    } else if (onReorder) {
      // Reorder within same column — swap with the card under cursor
      const colDiv = e.currentTarget as HTMLElement;
      const cards = colDiv.querySelectorAll('[data-task-id]');
      // Find which card the cursor is on
      let dropOnIdx = -1;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY < rect.bottom) {
          dropOnIdx = i;
          break;
        }
      }
      if (dropOnIdx !== -1) {
        const colTasks = tasks.filter(t => t.status === targetStatus);
        const allIds = colTasks.map(t => t.id);
        const fromIdx = allIds.indexOf(data.id);
        if (fromIdx !== -1 && fromIdx !== dropOnIdx) {
          // Swap the two positions
          [allIds[fromIdx], allIds[dropOnIdx]] = [allIds[dropOnIdx], allIds[fromIdx]];
          onReorder(targetStatus, allIds);
        }
      }
    }
  };

  const statusKey = (name: string) => name.toLowerCase().replace(/\s+/g, '_');

  const columns = statuses.map(s => ({
    ...s,
    tasks: tasks.filter(t => t.status === statusKey(s.name)),
  }));

  if (statuses.length === 0) {
    return <div className="text-center text-gray-500 py-10">No statuses configured.</div>;
  }

  return (
    <>
      <div ref={scrollRef} onDragOver={handleContainerDragOver} className="flex flex-wrap gap-4 pb-4 min-h-[300px]">
      {columns.map(col => (
        <div
          key={col.id}
          onDragOver={(e) => handleDragOver(e, statusKey(col.name))}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, statusKey(col.name))}
          className={`flex-shrink-0 w-80 rounded-xl border transition-all duration-200 ${
            dragOverCol === statusKey(col.name)
              ? 'border-emerald-500/60 bg-black shadow-lg shadow-emerald-500/5'
              : 'border-gray-700/60 bg-black'
          }`}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-200 tracking-wide">{col.name}</span>
            <span className="text-xs font-medium text-gray-400 bg-gray-800/80 px-2 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>
          <div className="p-2.5 space-y-2.5 min-h-[100px]">
            {col.tasks.map(task => {
              const priorityGradient = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => setSelectedTask(task)}
                  data-task-id={task.id}
                  className={`relative group rounded-xl border bg-[#0d1117] p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:border-gray-500/80 overflow-hidden ${
                    statusKey(col.name) === 'done'
                      ? 'border-gray-700/40 opacity-60'
                      : 'border-gray-700/60 hover:border-gray-500/80'
                  }`}
                >
                  {/* Priority left accent bar */}
                  <div className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b ${priorityGradient}`} />

                  <p className={`text-sm leading-snug pr-5 ${
                    statusKey(col.name) === 'done' ? 'line-through text-gray-500' : 'text-gray-100 font-medium'
                  }`}>
                    {task.title}
                  </p>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${PRIORITY_BG[task.priority] || PRIORITY_BG.medium}`}>
                      {task.priority}
                    </span>
                    {task.project_name && (
                      <span className="text-[10px] text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-md border border-gray-700/30 inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                        </svg>
                        {task.project_name.startsWith('~/') ? task.project_name.replace(/^~\//, '').split('/').slice(-2).join('/') : task.project_name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border ${new Date(task.due_date) < new Date() ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
                        {new Date(task.due_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Done overlay */}
                  {statusKey(col.name) === 'done' && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-lg text-xs text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setSelectedTask(null)}>
          <div
            className="bg-[#161b22] rounded-xl border border-gray-700/60 w-[500px] max-w-[90vw] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 pb-3 border-b border-gray-700/30">
              <div className="flex-1 min-w-0 pr-4">
                {isEditing ? (
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-[#0d1117] text-gray-100 text-lg font-semibold px-2.5 py-1.5 rounded border border-gray-700 outline-none focus:border-emerald-500/50"
                  />
                ) : (
                  <h3 className="text-lg font-semibold text-gray-100 leading-snug">{selectedTask.title}</h3>
                )}
              </div>
              <button
                onClick={() => { setSelectedTask(null); setIsEditing(false); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Priority & Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {isEditing ? (
                  <select value={editPriority} onChange={e => setEditPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="bg-[#0d1117] text-gray-300 text-xs px-2 py-1.5 rounded border border-gray-700 outline-none focus:border-emerald-500/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                ) : (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${PRIORITY_BG[selectedTask.priority] || PRIORITY_BG.medium}`}>
                    {selectedTask.priority}
                  </span>
                )}
                <span className="text-xs font-medium text-gray-400 bg-gray-800/80 px-2.5 py-1 rounded-md border border-gray-700/30">
                  {selectedTask.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Project info */}
              {selectedTask.project_name && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-widest">Project</p>
                  <div className="flex items-center gap-2 text-sm text-gray-300 bg-[#0d1117] px-3 py-2 rounded-lg border border-gray-700/30">
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                    </svg>
                    <span className="truncate">{selectedTask.project_name.startsWith('~/') ? selectedTask.project_name.replace(/^~\//, '') : selectedTask.project_name}</span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-widest">Description</p>
                {isEditing ? (
                  <textarea
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0d1117] text-gray-300 text-sm px-2.5 py-1.5 rounded border border-gray-700 outline-none focus:border-emerald-500/50 resize-none"
                  />
                ) : selectedTask.description ? (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selectedTask.description}</p>
                ) : (
                  <p className="text-sm text-gray-500 italic">No description</p>
                )}
              </div>

              {/* Due Date */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-widest">Due Date</p>
                {isEditing ? (
                  <DatePicker value={editDueDate} onChange={setEditDueDate} />
                ) : selectedTask.due_date ? (
                  <p className={`text-sm ${new Date(selectedTask.due_date) < new Date() ? 'text-red-400' : 'text-emerald-400'}`}>
                    {new Date(selectedTask.due_date).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : (
                  <p className="text-sm text-gray-500 italic">Not set</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700/30">
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Created</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(selectedTask.created_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Updated</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(selectedTask.updated_at + 'Z').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-black/30 border-t border-gray-700/30 flex justify-end gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={cancelEdit}
                    className="text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-1.5 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !editTitle.trim()}
                    className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-500 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <>
                  {selectedTask.project_id && (
                    <button
                      onClick={() => { onTaskClick(selectedTask); setSelectedTask(null); }}
                      className="text-sm text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 px-4 py-1.5 rounded-lg transition"
                    >
                      View Project →
                    </button>
                  )}
                  <button
                    onClick={openEdit}
                    className="text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-1.5 rounded-lg transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setSelectedTask(null)}
                    className="text-sm text-gray-400 hover:text-white border border-gray-700 px-4 py-1.5 rounded-lg transition"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

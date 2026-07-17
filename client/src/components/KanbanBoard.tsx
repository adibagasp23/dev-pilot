import { useState } from 'react';
import type { Task, TaskStatus } from '../api';

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
  onDelete: (id: number) => void;
  filterProjectId?: number;
}

export default function KanbanBoard({ tasks, statuses, onStatusChange, onTaskClick, onDelete, filterProjectId }: KanbanBoardProps) {
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: task.id, status: task.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, statusName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(statusName);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverCol(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.status !== targetStatus) {
        onStatusChange(data.id, targetStatus);
      }
    } catch {}
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
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[300px]">
      {columns.map(col => (
        <div
          key={col.id}
          onDragOver={(e) => handleDragOver(e, statusKey(col.name))}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, statusKey(col.name))}
          className={`flex-shrink-0 w-64 rounded-xl border transition-all duration-200 ${
            dragOverCol === statusKey(col.name)
              ? 'border-emerald-500/60 bg-emerald-500/8 shadow-lg shadow-emerald-500/5'
              : 'border-gray-700/60 bg-[#161b22]/80 backdrop-blur-sm'
          }`}
        >
          <div className="px-4 py-3 border-b border-gray-700/40 flex items-center justify-between">
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
                  onClick={() => onTaskClick(task)}
                  className={`relative group rounded-xl border bg-black p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 hover:border-gray-500/80 overflow-hidden ${
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

                  <div className="border-t border-gray-700/30 my-2" />

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${PRIORITY_BG[task.priority] || PRIORITY_BG.medium}`}>
                      {task.priority}
                    </span>
                    {!filterProjectId && task.project_name && (
                      <span className="text-[10px] text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-md border border-gray-700/30">
                        {task.project_name.split('/').pop()}
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
  );
}

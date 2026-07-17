import { useState } from 'react';
import type { Task, TaskStatus } from '../api';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
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
    <div className="flex gap-3 overflow-x-auto pb-4 min-h-[300px]">
      {columns.map(col => (
        <div
          key={col.id}
          onDragOver={(e) => handleDragOver(e, statusKey(col.name))}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, statusKey(col.name))}
          className={`flex-shrink-0 w-64 rounded-lg border transition-colors ${
            dragOverCol === statusKey(col.name)
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-gray-700 bg-[#161b22]'
          }`}
        >
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">{col.name}</span>
            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{col.tasks.length}</span>
          </div>
          <div className="p-2 space-y-2 min-h-[100px]">
            {col.tasks.map(task => (
              <div
                key={task.id}
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                onClick={() => onTaskClick(task)}
                className="relative group rounded-lg border border-gray-700 bg-[#0d1117] p-3 cursor-pointer hover:border-gray-500 transition active:cursor-grabbing"
                style={{ opacity: statusKey(col.name) === 'done' ? 0.6 : 1 }}
              >
                <p className={`text-sm mb-2 ${
                  statusKey(col.name) === 'done' ? 'line-through text-gray-500' : 'text-white'
                }`}>
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium}`}>
                    {task.priority}
                  </span>
                  {!filterProjectId && task.project_name && (
                    <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      {task.project_name.split('/').pop()}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                  className="absolute top-1.5 right-1.5 text-xs text-gray-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

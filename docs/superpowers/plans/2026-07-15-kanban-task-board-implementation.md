# Kanban Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the task list into a Kanban board with configurable status columns on both the `/tasks` page and project detail Tasks tab.

**Architecture:** New `task_statuses` database table for configurable statuses. Shared `KanbanBoard` React component used by both pages. Native HTML5 Drag & Drop for moving cards between columns.

**Tech Stack:** SQLite, Express.js, React, Tailwind CSS, HTML5 Drag & Drop API

## Global Constraints

- All existing task features (priority, project badge, delete, status toggle) must remain
- The `/tasks` page becomes full Kanban (no folder grouping)
- Project detail Tasks tab becomes Kanban filtered to project + siblings
- Statuses are configurable via a new modal on `/tasks` page
- Default statuses: Todo, In Progress, Done
- Drag & drop uses native HTML5 API (no external library)
- Migration `011_add_task_statuses.js` seeds the 3 default statuses

---
### Task 1: Database Migration — `task_statuses` table

**Files:**
- Create: `database/migrations/011_add_task_statuses.js`
- Modify: `database/db.js` (update migration list if needed)

**Interfaces:**
- Consumes: existing `db.js` migration framework
- Produces: `task_statuses` table with `id`, `name`, `sort_order`, `created_at`, `updated_at`

- [ ] **Step 1: Create migration file**

```javascript
// database/migrations/011_add_task_statuses.js
exports.up = function(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS task_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default statuses
  const count = db.prepare('SELECT COUNT(*) as c FROM task_statuses').get();
  if (count.c === 0) {
    db.prepare('INSERT INTO task_statuses (name, sort_order) VALUES (?, ?)').run('Todo', 0);
    db.prepare('INSERT INTO task_statuses (name, sort_order) VALUES (?, ?)').run('In Progress', 1);
    db.prepare('INSERT INTO task_statuses (name, sort_order) VALUES (?, ?)').run('Done', 2);
  }
};

exports.down = function(db) {
  db.exec('DROP TABLE IF EXISTS task_statuses');
};
```

- [ ] **Step 2: Run migration manually to verify**

Run: `node -e "const db = require('./database/db'); db.migrate().then(() => { console.log('migrated'); const r = db.db.prepare('SELECT * FROM task_statuses').all(); console.log(r); process.exit(0); }).catch(e => { console.error(e); process.exit(1); })"` from `~/process-manager`

Expected: prints array of 3 status rows.

- [ ] **Step 3: Commit**

```bash
git add database/migrations/011_add_task_statuses.js
git commit -m "feat: add task_statuses migration with defaults"
```

---
### Task 2: API Endpoints — `task_statuses` CRUD

**Files:**
- Modify: `routes/api.js`

**Interfaces:**
- Consumes: `db.js` for database access
- Produces: `GET /api/task-statuses`, `POST /api/task-statuses`, `PUT /api/task-statuses/:id`, `DELETE /api/task-statuses/:id`

- [ ] **Step 1: Add task-statuses routes in `routes/api.js`**

Add these routes after the existing tasks routes:

```javascript
// --- Task Statuses ---
router.get('/api/task-statuses', (req, res) => {
  try {
    const statuses = db.db.prepare('SELECT * FROM task_statuses ORDER BY sort_order ASC').all();
    res.json({ statuses });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/task-statuses', (req, res) => {
  try {
    const { name, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const stmt = db.db.prepare('INSERT INTO task_statuses (name, sort_order) VALUES (?, ?)');
    const result = stmt.run(name.trim(), sort_order || 0);
    const status = db.db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(result.lastInsertRowid);
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/task-statuses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, sort_order } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim()); }
    if (sort_order !== undefined) { fields.push('sort_order = ?'); values.push(sort_order); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    db.db.prepare(`UPDATE task_statuses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);
    const status = db.db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id);
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/task-statuses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const status = db.db.prepare('SELECT * FROM task_statuses WHERE id = ?').get(id);
    if (!status) return res.status(404).json({ error: 'Status not found' });
    const taskCount = db.db.prepare('SELECT COUNT(*) as c FROM tasks WHERE status = ?').get(status.name.toLowerCase().replace(/\s+/g, '_'));
    if (taskCount.c > 0) return res.status(400).json({ error: `Cannot delete: ${taskCount.c} task(s) use this status` });
    db.db.prepare('DELETE FROM task_statuses WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add routes/api.js
git commit -m "feat: add task-statuses CRUD endpoints"
```

---
### Task 3: API Client — `taskStatusesApi`

**Files:**
- Modify: `client/src/api.ts`
- Modify: `client/src/types.ts`

**Interfaces:**
- Consumes: existing API client pattern
- Produces: `taskStatusesApi.list()`, `.create()`, `.update()`, `.remove()` — same pattern as `tasksApi`

- [ ] **Step 1: Add TaskStatus type to `client/src/types.ts`**

Add after the Task interface:

```typescript
export interface TaskStatus {
  id: number;
  name: string;
  sort_order: number;
}
```

- [ ] **Step 2: Add `taskStatusesApi` to `client/src/api.ts`**

Add after the `tasksApi` definition:

```typescript
export const taskStatusesApi = {
  list: (): Promise<{ statuses: TaskStatus[] }> =>
    fetch('/api/task-statuses').then(r => r.json()),
  create: (data: { name: string; sort_order?: number }): Promise<{ status: TaskStatus }> =>
    fetch('/api/task-statuses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  update: (id: number, data: { name?: string; sort_order?: number }): Promise<{ status: TaskStatus }> =>
    fetch(`/api/task-statuses/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json()),
  remove: (id: number): Promise<{ success: boolean }> =>
    fetch(`/api/task-statuses/${id}`, { method: 'DELETE' }).then(r => r.json()),
};
```

- [ ] **Step 3: Commit**

```bash
git add client/src/api.ts client/src/types.ts
git commit -m "feat: add taskStatusesApi client"
```

---
### Task 4: `KanbanBoard` Component

**Files:**
- Create: `client/src/components/KanbanBoard.tsx`

**Interfaces:**
- Consumes: `Task[]`, `TaskStatus[]`, callbacks `onStatusChange`, `onTaskClick`, `onDelete`
- Produces: a reusable Kanban board with draggable cards

- [ ] **Step 1: Create `client/src/components/KanbanBoard.tsx`**

```typescript
import { useState } from 'react';
import type { Task, TaskStatus } from '../types';

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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/KanbanBoard.tsx
git commit -m "feat: add KanbanBoard component with drag-and-drop"
```

---
### Task 5: Rewrite `/tasks` Page to Kanban

**Files:**
- Modify: `client/src/pages/Tasks.tsx` (full rewrite)

**Consumes:** `KanbanBoard`, `taskStatusesApi`, `tasksApi`, `Task`, `TaskStatus`
**Produces:** Kanban board at `/tasks` with add form, status management modal

- [ ] **Step 1: Rewrite `Tasks.tsx`**

Replace entire file content with:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/Tasks.tsx
git commit -m "feat: rewrite /tasks page to Kanban board"
```

---
### Task 6: Update ProjectDetail Tasks Tab

**Files:**
- Modify: `client/src/pages/ProjectDetail.tsx` (replace Tasks tab content)

- [ ] **Step 1: Update Tasks tab in ProjectDetail.tsx**

Add import for `KanbanBoard`, `taskStatusesApi`, `TaskStatus` at the top:

```typescript
import KanbanBoard from '../components/KanbanBoard';
import { api, tasksApi, taskStatusesApi, type Task, type TaskStatus } from '../api';
```

Add state for task statuses alongside the existing task state (around line ~31):

```typescript
const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
```

Add loading in the `load` callback (after loading project tasks):

```typescript
// Load task statuses
taskStatusesApi.list().then(d => setTaskStatuses(d.statuses)).catch(() => {});
```

Replace the Tasks tab content block `{activeTab === 'tasks' && (` with:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/ProjectDetail.tsx
git commit -m "feat: update ProjectDetail Tasks tab to Kanban"
```

---
### Task 7: Verify & Restart

**Files:** None

- [ ] **Step 1: Build frontend**

Run: `cd ~/process-manager/client && npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Restart server**

Run: `launchctl unload ~/Library/LaunchAgents/com.process-manager.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/com.process-manager.plist 2>&1`

Expected: Server restarts.

- [ ] **Step 3: Test the Kanban**

- Open `http://localhost:9876/tasks` — show Kanban with Todo / In Progress / Done columns
- Create a task — appears in Todo column
- Drag task between columns — status updates
- Click task card — navigates to project detail
- Click "Manage Statuses" — modal opens, can add/rename/reorder/delete statuses
- Open project detail → Tasks tab — Kanban filtered to that project

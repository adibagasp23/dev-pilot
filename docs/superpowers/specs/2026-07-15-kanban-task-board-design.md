# Kanban Task Board Design

## Overview
Transform the existing task list (/tasks page + project detail Tasks tab) into a Kanban board with configurable status columns, drag-and-drop status updates, and persisted custom statuses.

## Architecture

### Database
New table `task_statuses`:
```sql
CREATE TABLE task_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Default seed data:
- `Todo` (sort_order: 0)
- `In Progress` (sort_order: 1)
- `Done` (sort_order: 2)

The `tasks` table keeps its existing `status` column as a TEXT field storing the status name (e.g., "todo", "in_progress", "done"), but the Kanban will use the configurable statuses from `task_statuses`. To bridge: the `tasks.status` values will be normalized to match the configurable status names (lowercased, underscored). When statuses are added/edited in the configurable table, the UI picks them up dynamically.

### API Endpoints

**Task Statuses CRUD:**
- `GET /api/task-statuses` — list all statuses ordered by `sort_order`
- `POST /api/task-statuses` — create a new status `{ name, sort_order }`
- `PUT /api/task-statuses/:id` — update name or sort_order
- `DELETE /api/task-statuses/:id` — delete a status (reassign tasks to first status or error if tasks exist)

**Existing Tasks API** stays the same, but `status` field now accepts any status name from `task_statuses`.

### Frontend

**Shared Kanban component** (`client/src/components/KanbanBoard.tsx`):
- Props: `tasks`, `statuses`, `onStatusChange(taskId, newStatus)`, `onTaskClick(task)`, `onDeleteTask(id)`, `filterProjectId?`
- Renders columns horizontally with scroll
- Each column: header (status name + count) + card list
- Cards show: title, priority badge, project badge (if not filtered to one project)
- Drag-and-drop: HTML5 Drag & Drop API (native, no library)

**Pages that use KanbanBoard:**
1. `/tasks` page — all tasks, grouped by status (no folder grouping)
2. ProjectDetail Tasks tab — tasks from current project + siblings, filtered

**Status Management:**
- Button/link "Manage Statuses" on `/tasks` page
- Opens a modal/dialog to: add, rename, reorder, delete statuses
- Reorder via simple up/down buttons or drag

### Drag & Drop Implementation
- `draggable="true"` on each card
- `onDragStart`: store card id + source status
- `onDragOver` on columns: allow drop (preventDefault)
- `onDrop`: call `onStatusChange` with task id and new status
- Optimistic UI update: immediately move card, revert on API error

### Project Detail Tasks Tab
- Same KanbanBoard component
- Tasks loaded from current project + siblings (same logic as before)
- Filtered to only show tasks relevant to this project group
- Quick-add input above the Kanban (same as now)

## Migration
- Migration `011_add_task_statuses.js`: create table, seed defaults
- Existing tasks keep their current status values (todo → "Todo", in_progress → "In Progress", done → "Done")

## Files to Change
- `database/migrations/011_add_task_statuses.js` (new)
- `routes/api.js` (add task-statuses endpoints)
- `client/src/pages/Tasks.tsx` (rewrite to Kanban)
- `client/src/pages/ProjectDetail.tsx` (replace Tasks tab content with Kanban)
- `client/src/components/KanbanBoard.tsx` (new)
- `client/src/api.ts` (add taskStatuses API methods)
- `client/src/types.ts` (add TaskStatus type)

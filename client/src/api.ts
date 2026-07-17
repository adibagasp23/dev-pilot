import type { Project, Process, ScanFolder, Logs, TaskStatus } from './types';

export type { TaskStatus };

const BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  getProjects: (type?: string) =>
    fetchJSON<{ projects: Project[]; countMap: Record<number, number> }>(
      `/projects${type ? `?type=${type}` : ''}`
    ),

  getProject: (id: number) =>
    fetchJSON<{ project: Project; processes: Process[]; siblings: { id: number; name: string; type: string; is_active: boolean }[] }>(`/projects/${id}`),

  startProcess: (id: number) =>
    fetchJSON<Process>(`/processes/${id}/start`, { method: 'POST' }),

  stopProcess: (id: number) =>
    fetchJSON<Process>(`/processes/${id}/stop`, { method: 'POST' }),

  stopAllProcesses: () =>
    fetchJSON<{ stopped: number }>('/processes/stop-all', { method: 'POST' }),

  toggleProcessFavorite: (processId: number, favorite: boolean) =>
    fetchJSON<{ process: Process }>(`/processes/${processId}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ favorite }),
    }),

  addProcess: (project_id: number, label: string, command: string, port?: string) =>
    fetchJSON<Process>('/processes', {
      method: 'POST',
      body: JSON.stringify({ project_id, label, command, port: port || null }),
    }),

  updateProcess: (id: number, data: { label?: string; command?: string; port?: string | null }) =>
    fetchJSON<Process>(`/processes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  reorder: (projectId: number, order: string) =>
    fetchJSON<{ ok: boolean }>(`/projects/${projectId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ order }),
    }),

  getLogs: (id: number) => fetchJSON<Logs>(`/processes/${id}/log`),

  sendInput: (id: number, input: string) =>
    fetchJSON<{ ok: boolean }>(`/processes/${id}/input`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  clearLogs: (id: number) =>
    fetchJSON<{ ok: boolean }>(`/processes/${id}/clear-logs`, {
      method: 'POST',
    }),

  deleteProcess: (id: number) =>
    fetchJSON<{ ok: boolean }>(`/processes/${id}`, { method: 'DELETE' }),

  getFolders: () =>
    fetchJSON<{ folders: ScanFolder[] }>('/settings/folders'),

  addFolder: (path: string) =>
    fetchJSON<{ folders: ScanFolder[] }>('/settings/folders', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  deleteFolder: (id: number) =>
    fetchJSON<{ ok: boolean }>(`/settings/folders/${id}`, { method: 'DELETE' }),

  createProject: (name: string, type: string, path?: string) =>
    fetchJSON<Project>('/create-project', {
      method: 'POST',
      body: JSON.stringify({ name, type, path }),
    }),

  setDefaultProcess: (projectId: number, processId: number) =>
    fetchJSON<{ project: Project }>(`/projects/${projectId}/default-process`, {
      method: 'PUT',
      body: JSON.stringify({ processId }),
    }),

  toggleFavorite: (projectId: number, favorite: boolean) =>
    fetchJSON<{ project: Project }>(`/projects/${projectId}/favorite`, {
      method: 'PUT',
      body: JSON.stringify({ favorite }),
    }),

  getFavorites: () =>
    fetchJSON<{ projects: Project[] }>('/favorites'),

  getFavoriteProcesses: () =>
    fetchJSON<{ processes: import('./types').FavoriteProcess[] }>('/favorites/processes'),

  getAppTypes: () =>
    fetchJSON<{ types: string[] }>('/settings/app-types'),

  setAppTypes: (types: string[]) =>
    fetchJSON<{ types: string[]; ok: boolean }>('/settings/app-types', {
      method: 'PUT',
      body: JSON.stringify({ types }),
    }),

  pushApk: (projectId: number) =>
    fetchJSON<{ ok: boolean; device: string; file: string; output: string }>('/push-apk', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    }),

  rescan: () =>
    fetchJSON<{ ok: boolean }>('/scan', { method: 'POST' }),

  getRunningProcesses: () =>
    fetchJSON<{ processes: (Process & { project_name: string; project_type: string })[] }>('/processes/running'),

  subscribeToLog: (id: number, onLine: (line: { s: string; t: string }) => void, onStatus: (status: string) => void, onInit: (lines: { s: string; t: string }[], status: string) => void) => {
    const es = new EventSource(`${BASE}/processes/${id}/log/stream`);
    es.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      if (onInit) onInit(data.lines, data.status);
    });
    es.addEventListener('line', (e) => {
      const data = JSON.parse(e.data);
      if (onLine) onLine(data);
    });
    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      if (onStatus) onStatus(data.status);
    });
    return es;
  },
};

export interface Task {
  id: number;
  project_id: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  project_name?: string;
  project_path?: string;
}

export const tasksApi = {
  list: (params?: { project_id?: number; status?: string }) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v != null).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return fetchJSON<{ tasks: Task[] }>('/tasks' + qs);
  },
  create: (data: { title: string; project_id?: number | null; priority?: string }) =>
    fetchJSON<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: Partial<Pick<Task, 'title' | 'status' | 'priority' | 'project_id'>>) =>
    fetchJSON<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: number) => fetchJSON<{ ok: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
};

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

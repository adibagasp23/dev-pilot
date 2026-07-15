import type { Project, Process, ScanFolder, Logs } from './types';

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
    fetchJSON<{ project: Project; processes: Process[] }>(`/projects/${id}`),

  startProcess: (id: number) =>
    fetchJSON<Process>(`/processes/${id}/start`, { method: 'POST' }),

  stopProcess: (id: number) =>
    fetchJSON<Process>(`/processes/${id}/stop`, { method: 'POST' }),

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

  rescan: () =>
    fetchJSON<{ ok: boolean }>('/scan', { method: 'POST' }),

  getRunningProcesses: () =>
    fetchJSON<{ processes: (Process & { project_name: string; project_type: string })[] }>('/processes/running'),
};

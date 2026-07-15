export interface Project {
  id: number;
  name: string;
  path: string;
  type: 'flutter' | 'laravel';
  created_at: string;
}

export interface Process {
  id: number;
  project_id: number;
  label: string;
  command: string;
  status: 'running' | 'stopped' | 'error';
  pid: number | null;
  port: number | null;
  started_at: string | null;
  stopped_at: string | null;
  sort_order: number;
}

export interface ScanFolder {
  id: number;
  path: string;
}

export interface LogLine {
  s: 'o' | 'e' | 'i';  // stream: o=stdout, e=stderr, i=input
  t: string;            // text
}

export interface Logs {
  lines: LogLine[];
  status?: 'running' | 'stopped' | 'error';
}

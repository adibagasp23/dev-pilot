import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '../components/Snackbar';
import ProcessLogPanel from '../components/ProcessLogPanel';

// ----- Tree -----
type TreeNode = {
  type: 'folder' | 'project';
  name: string;
  path: string;
  project?: Project;
  children?: TreeNode[];
  running?: number;
  expanded?: boolean;
};

function buildTree(projects: Project[], countMap: Record<number, number>, collapseEmpty?: boolean): TreeNode[] {
  const root: TreeNode[] = [];
  const map: Record<string, TreeNode> = {};

  for (const p of projects) {
    const parts = p.name.split('/');
    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (currentPath) currentPath += '/';
      currentPath += part;

      if (i === parts.length - 1) {
        current.push({
          type: 'project',
          name: part,
          path: currentPath,
          project: p,
          running: countMap[p.id] || 0,
        });
      } else {
        let folder = map[currentPath];
        if (!folder) {
          folder = {
            type: 'folder',
            name: part,
            path: currentPath,
            children: [],
            expanded: false,
          };
          map[currentPath] = folder;
          current.push(folder);
        }
        current = folder.children!;
      }
    }
  }

  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  };
  sortNodes(root);

  // Prune folders: remove nodes with 0 direct projects, promoting children up
  function pruneEmptyFolders(nodes: TreeNode[]): TreeNode[] {
    if (!collapseEmpty) return nodes;
    const result: TreeNode[] = [];
    for (const n of nodes) {
      if (n.type === 'folder' && n.children) {
        n.children = pruneEmptyFolders(n.children);
        const hasProjectChild = n.children.some(c => c.type === 'project');
        if (hasProjectChild) {
          // Keep this folder
          result.push(n);
        } else {
          // Collapse: promote children up
          result.push(...n.children);
        }
      } else {
        result.push(n);
      }
    }
    return result;
  }
  const pruned = pruneEmptyFolders(root);

  for (const n of pruned) {
    if (n.type === 'folder') n.expanded = true;
  }

  return pruned;
}

function FolderNode({
  node, depth, onNavigate, runningProjects, setRunningProject, runningLogs, setRunningLog, forceExpand,
}: {
  node: TreeNode;
  depth: number;
  onNavigate: (id: number) => void;
  runningProjects: Record<number, { processId: number; status: string; projectId: number }>;
  setRunningProject: (projectId: number, processId: number | null) => void;
  runningLogs: Record<number, string>;
  setRunningLog: (projectId: number, log: string) => void;
  forceExpand?: boolean;
}) {
  const [localExpanded, setLocalExpanded] = useState(node.expanded || false);
  const expanded = forceExpand || localExpanded;

  const toggle = useCallback(() => {
    setLocalExpanded(!localExpanded);
  }, [localExpanded]);

  const startInline = async (p: Project) => {
    if (!p.default_process_id) {
      toast('No default command set. Set one in project detail.');
      return;
    }
    try {
      await api.startProcess(p.default_process_id);
      setRunningProject(p.id, p.default_process_id);
      // Initial log fetch (global polling handles updates)
      const data = await api.getLogs(p.default_process_id);
      const all = data.lines.map(l => l.t).join('');
      setRunningLog(p.id, all || 'Waiting for output...');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const stopInline = async (p: Project, processId: number) => {
    try {
      await api.stopProcess(processId);
      await api.clearLogs(processId);
    } catch { /* ignore */ }
    setRunningProject(p.id, 0);
    setRunningLog(p.id, '');
  };

  if (node.type === 'project' && node.project) {
    const p = node.project;
    const running = runningProjects[p.id];
    const isRunning = running && running.processId > 0;
    const log = runningLogs[p.id] || '';

    return (
      <div>
        <div
          onClick={() => onNavigate(p.id)}
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-100 cursor-pointer group transition ml-6"
        >
          <span className="text-gray-400 text-sm w-4">
            {p.type === 'flutter' ? '🔵' : p.type === 'next' ? '⚫' : p.type === 'laravel' ? '🟠' : '🟣'}
          </span>
          <span className="text-gray-700 text-sm truncate">{node.name}</span>
          {p.path && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.path); toast('Path copied!'); }}
              className="text-gray-400 hover:text-emerald-500 transition text-xs ml-1 cursor-pointer"
              title="Copy path"
            >
              📋
            </button>
          )}
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            p.type === 'flutter' ? 'text-blue-600 bg-blue-50' : p.type === 'next' ? 'text-gray-600 bg-gray-100' : p.type === 'laravel' ? 'text-orange-600 bg-orange-50' : 'text-purple-600 bg-purple-50'
          }`}>
            {p.type === 'agent' ? 'AGENT' : p.type === 'next' ? 'Next.js' : p.type.charAt(0).toUpperCase() + p.type.slice(1)}
          </span>
          {/* Run button */}
          {p.type !== 'agent' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isRunning && running) {
                  stopInline(p, running.processId);
                } else {
                  startInline(p);
                }
              }}
              className={`text-xs px-2 py-1 rounded transition cursor-pointer ${
                isRunning
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {isRunning ? 'Stop' : '▶ Run'}
            </button>
          )}
        </div>
        {isRunning && log !== undefined && (
          <div className="ml-6 pl-2 pr-2 pb-2">
            <ProcessLogPanel
              processId={running!.processId}
              log={log}
              projectType={p.type}
              onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
              onCopyAll={() => {
                navigator.clipboard.writeText(log);
                toast('Full log copied!');
              }}
              onCopyVisible={() => {
                navigator.clipboard.writeText(log);
                toast('Log copied!');
              }}
              onClear={async () => {
                setRunningLog(p.id, '');
                await api.clearLogs(running!.processId).catch(() => {});
                toast('Terminal cleared!');
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // Folder node
  const count = node.children?.filter(c => c.type === 'project').length || 0;
  const totalChildren = node.children?.length || 0;

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-gray-100 cursor-pointer group transition"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={toggle}
      >
        <span className="text-gray-400 text-sm w-4 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>
          ▶
        </span>
        <span className="text-gray-500">{expanded ? '📂' : '📁'}</span>
        <span className="text-gray-800 text-sm font-medium">{node.name}</span>
        <span className="text-xs text-gray-400 ml-1">{count} project{count !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.path); toast('Path copied!'); }}
          className="text-gray-400 hover:text-emerald-500 transition text-xs ml-1 cursor-pointer"
          title="Copy path"
        >
          📋
        </button>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FolderNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onNavigate={onNavigate}
              runningProjects={runningProjects}
              setRunningProject={setRunningProject}
              runningLogs={runningLogs}
              setRunningLog={setRunningLog}
              forceExpand={forceExpand}
            />
          ))}
          {totalChildren === 0 && (
            <div className="text-xs text-gray-400 italic ml-8 py-1">(empty)</div>
          )}
        </div>
      )}
    </div>
  );
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [countMap, setCountMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeFilter = searchParams.get('type');
  const subtypeFilter = searchParams.get('subtype') || null;

  const setSubtypeFilter = useCallback((st: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (st) {
      next.set('subtype', st);
    } else {
      next.delete('subtype');
    }
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [runningFilter, setRunningFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [runningProjects, setRunningProjects] = useState<Record<number, { processId: number; status: string; projectId: number }>>({});
  const [runningLogs, setRunningLogs] = useState<Record<number, string>>({});

  const setRunningProject = useCallback((projectId: number, processId: number | null) => {
    setRunningProjects(prev => {
      const next = { ...prev };
      if (processId) {
        next[projectId] = { processId, status: 'running', projectId };
      } else {
        delete next[projectId];
      }
      return next;
    });
  }, []);

  const setRunningLog = useCallback((projectId: number, log: string) => {
    setRunningLogs(prev => ({ ...prev, [projectId]: log }));
  }, []);

  useEffect(() => {
    setRunningFilter('all');

    // Safety timeout: force clear loading after 15s
    const safetyTimer = setTimeout(() => setLoading(false), 15000);

    api.getProjects(typeFilter || undefined).then(async (data) => {
      setProjects(data.projects);
      setCountMap(data.countMap);

      // Populate runningProjects from server state
      try {
        const runningData = await api.getRunningProcesses();
        const rp: Record<number, { processId: number; status: string; projectId: number }> = {};
        for (const proc of runningData.processes) {
          rp[proc.project_id] = { processId: proc.id, status: 'running', projectId: proc.project_id };
        }
        setRunningProjects(rp);
      } catch {}

      setLoading(false);
      clearTimeout(safetyTimer);
    }).catch((err) => {
      console.error('Failed to load projects:', err);
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    return () => { clearTimeout(safetyTimer); };
  }, [typeFilter]);

  // Manage SSE subscriptions for all running projects
  const sseRefs = useRef<Record<number, EventSource>>({});

  useEffect(() => {
    const currentSSEs = sseRefs.current;
    const neededProcessIds = new Set(Object.values(runningProjects).map(r => r.processId).filter(Boolean));

    // Close SSE for processes no longer running
    for (const pidStr of Object.keys(currentSSEs)) {
      const pid = parseInt(pidStr);
      if (!neededProcessIds.has(pid)) {
        currentSSEs[pid].close();
        delete currentSSEs[pid];
      }
    }

    // Open SSE for new running processes
    for (const rp of Object.values(runningProjects)) {
      if (!rp || !rp.processId) continue;
      if (currentSSEs[rp.processId]) continue; // already subscribed

      const es = api.subscribeToLog(
        rp.processId,
        (line) => {
          // New line: append to log
          const pid = rp.projectId;
          setRunningLogs(prev => ({
            ...prev,
            [pid]: (prev[pid] || '') + line.t,
          }));
        },
        (status) => {
          const pid = rp.projectId;
          if (status !== 'running') {
            setRunningProjects(prev => {
              const next = { ...prev };
              delete next[pid];
              return next;
            });
          }
        },
        (lines, status) => {
          // Initial data
          const pid = rp.projectId;
          const all = lines.map(l => l.t).join('');
          setRunningLogs(prev => ({
            ...prev,
            [pid]: all !== '' ? all : 'Waiting for output...',
          }));
          if (status !== 'running') {
            setRunningProjects(prev => {
              const next = { ...prev };
              delete next[pid];
              return next;
            });
          }
        }
      );
      currentSSEs[rp.processId] = es;
    }

    return () => {
      // Close all SSEs on cleanup
      for (const es of Object.values(currentSSEs)) {
        es.close();
      }
    };
  }, [runningProjects]);

  const title = !typeFilter
    ? 'All Projects'
    : typeFilter.toUpperCase();

  // Subtype filter tabs — show for all views, include all types with projects
  const subtypeCounts = (() => {
    const counts: Record<string, number> = {};
    for (const p of projects) {
      counts[p.type] = (counts[p.type] || 0) + 1;
    }
    return counts;
  })();

  const filterLabels: Record<string, string> = {
    flutter: '🔵 Flutter',
    laravel: '🟠 Laravel',
    next: '⚫ Next.js',
    rust: '🟣 Rust',
    agent: '🤖 Agent',
  };

  // Apply subtype filter
  const displayedByType = subtypeFilter
    ? projects.filter(p => p.type === subtypeFilter)
    : projects;

  const totalRunning = Object.keys(countMap).filter(id => displayedByType.some(p => p.id === Number(id))).reduce((sum, id) => sum + (countMap[Number(id)] || 0), 0);

  const displayedProjects = runningFilter === 'running'
    ? displayedByType.filter(p => (countMap[p.id] || 0) > 0)
    : runningFilter === 'stopped'
      ? displayedByType.filter(p => (countMap[p.id] || 0) === 0)
      : displayedByType;
  const tree = buildTree(displayedProjects, countMap, !!subtypeFilter);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            <div className="flex items-center gap-2">
              {totalRunning > 0 && (
                <button
                  onClick={() => setRunningFilter(runningFilter === 'running' ? 'all' : 'running')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer ${
                    runningFilter === 'running'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {totalRunning} running
                </button>
              )}
              {displayedByType.length - totalRunning > 0 && (
                <button
                  onClick={() => setRunningFilter(runningFilter === 'stopped' ? 'all' : 'stopped')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer ${
                    runningFilter === 'stopped'
                      ? 'bg-gray-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {displayedByType.length - totalRunning} stopped
                </button>
              )}
            </div>
          </div>
          {subtypeCounts && (
            <div className="flex gap-1.5 mt-2">
              {Object.entries(subtypeCounts).map(([type, count]) => {
                const colorMap: Record<string, string> = {
                  flutter: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                  laravel: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
                  next: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                  rust: 'bg-purple-100 text-purple-700 hover:bg-purple-200',
                  agent: 'bg-green-100 text-green-700 hover:bg-green-200',
                };
                const colorActiveMap: Record<string, string> = {
                  flutter: 'bg-blue-500 text-white',
                  laravel: 'bg-orange-500 text-white',
                  next: 'bg-gray-500 text-white',
                  rust: 'bg-purple-500 text-white',
                  agent: 'bg-green-500 text-white',
                };
                return (
                  <button
                    key={type}
                    onClick={() => setSubtypeFilter(subtypeFilter === type ? null : type)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition cursor-pointer ${
                      subtypeFilter === type
                        ? colorActiveMap[type]
                        : colorMap[type]
                    }`}
                  >
                    {filterLabels[type] || type} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/settings')}
            className="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition text-sm"
          >
            + Add Folder
          </button>
          <button
            onClick={async () => {
              try {
                await api.createProject('Agent', 'agent');
                window.location.href = '/?type=agent';
                toast('Agent project created!');
              } catch (err: any) {
                toast(err.message);
              }
            }}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm"
          >
            🤖 New Agent
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-2">📂</p>
          <p className="text-lg">No projects yet</p>
          <p className="text-sm mt-1">Go to Settings to add scan folders</p>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-4 pb-2">
            {tree.map((node) => (
              <FolderNode
                key={node.path}
                node={node}
                depth={0}
                onNavigate={(id) => navigate(`/project/${id}`)}
                runningProjects={runningProjects}
                setRunningProject={setRunningProject}
                runningLogs={runningLogs}
                setRunningLog={setRunningLog}
                forceExpand={runningFilter !== 'all'}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

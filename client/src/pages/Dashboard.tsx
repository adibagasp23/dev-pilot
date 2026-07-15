import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '../components/Snackbar';

// ----- Inline Terminal Component -----
function InlineTerminal({ nodePath: _nodePath, projectId, onClose }: { nodePath: string; projectId: number; onClose: () => void }) {
  const [lines, setLines] = useState<string>('');
  const [input, setInput] = useState('');
  const [procId, setProcId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('starting');
  const preRef = useRef<HTMLPreElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start pi on mount
  useEffect(() => {
    let cancelled = false;
    api.getProject(projectId).then(async (data) => {
      if (cancelled) return;
      // Find or create a pi process
      let piProc = data.processes.find((p: any) => p.label === 'Pi Terminal');
      if (!piProc) {
        piProc = await api.addProcess(projectId, 'Pi Terminal', 'pi');
      }
      if (cancelled) return;
      api.startProcess(piProc.id).then(() => {
        setProcId(piProc.id);
        setStatus('running');
      }).catch((err) => {
        // If already running, use it anyway
        if (err.message?.includes('already running')) {
          setProcId(piProc.id);
          setStatus('running');
        } else {
          setStatus('stopped');
        }
      });
    });
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [projectId]);

  // Poll logs
  useEffect(() => {
    if (!procId) return;
    pollRef.current = setInterval(() => {
      api.getLogs(procId).then((logData) => {
        const all = logData.lines.map(l => l.t).join('');
        if (logData.status) setStatus(logData.status);
        if (all) {
          setLines(all);
        } else if (logData.status === 'running') {
          setLines('Pi is running. Type a command below and press Enter.\n');
        } else {
          setLines('');
        }
        // Auto-scroll
        if (preRef.current) {
          preRef.current.scrollTop = preRef.current.scrollHeight;
        }
      });
    }, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [procId]);

  const sendInput = () => {
    if (!procId) return;
    api.sendInput(procId, input + '\n').catch(() => {});
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendInput();
  };

  const handleClose = () => {
    if (procId) {
      api.stopProcess(procId).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="ml-12 mb-2 border border-gray-700 rounded-lg overflow-hidden" style={{ background: '#0d1117' }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: '#161b22', borderBottom: '1px solid #30363d' }}>
        <span className="text-xs text-gray-400">
          {status === 'running' ? '🟢' : '🔴'} Terminal
        </span>
        <button
          onClick={handleClose}
          className="text-xs text-gray-500 hover:text-red-400 transition"
        >
          ✕
        </button>
      </div>
      <pre
        ref={preRef}
        className="text-xs p-3 overflow-auto max-h-48 min-h-[6rem] font-mono leading-relaxed select-text"
        style={{ color: '#4ade80', background: '#0d1117' }}
        onClick={(e) => e.stopPropagation()}
      >
        {lines || 'Starting...'}
      </pre>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-700" style={{ background: '#0d1117' }}>
        <span className="text-green-400 text-xs">❯</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-green-400 text-xs outline-none border-none font-mono"
          placeholder="Type command..."
          onClick={(e) => e.stopPropagation()}
        />
        <button
          onClick={(e) => { e.stopPropagation(); sendInput(); }}
          className="text-xs px-2 py-0.5 rounded hover:bg-gray-700 transition"
          style={{ color: '#4ade80', border: '1px solid #4ade80' }}
        >
          Kirim
        </button>
      </div>
    </div>
  );
}

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

function buildTree(projects: Project[], countMap: Record<number, number>): TreeNode[] {
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

  for (const n of root) {
    if (n.type === 'folder') n.expanded = true;
  }

  return root;
}

function FolderNode({ node, depth, onToggleTerminal, terminalPaths }: {
  node: TreeNode;
  depth: number;
  onToggleTerminal: (path: string) => void;
  terminalPaths: Set<string>;
}) {
  const [expanded, setExpanded] = useState(node.expanded || false);

  const toggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  if (node.type === 'project' && node.project) {
    const p = node.project;
    const isTerminalOpen = terminalPaths.has(node.path);
    return (
      <div>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-100 group transition ml-6"
        >
          <span className="text-gray-400 text-sm w-4">
            {p.type === 'flutter' ? '🔵' : p.type === 'next' ? '⚫' : p.type === 'laravel' ? '🟠' : '🟣'}
          </span>
          <span className={`text-gray-700 text-sm truncate ${isTerminalOpen ? 'text-emerald-600 font-medium' : ''}`}>{node.name}</span>
          {p.path && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.path); toast('Path copied!'); }}
              className="text-gray-400 hover:text-emerald-500 transition text-xs ml-1 cursor-pointer"
              title="Copy path"
            >
              📋
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleTerminal(node.path); }}
            className={`text-xs ml-1 cursor-pointer transition ${isTerminalOpen ? 'text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}
            title={isTerminalOpen ? 'Close terminal' : 'Start terminal'}
          >
            {isTerminalOpen ? '⏹' : '▶'}
          </button>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            p.type === 'flutter' ? 'text-blue-600 bg-blue-50' : p.type === 'next' ? 'text-gray-600 bg-gray-100' : p.type === 'laravel' ? 'text-orange-600 bg-orange-50' : 'text-purple-600 bg-purple-50'
          }`}>
            {p.type === 'agent' ? 'AGENT' : p.type === 'next' ? 'Next.js' : p.type.charAt(0).toUpperCase() + p.type.slice(1)}
          </span>
        </div>
        {isTerminalOpen && (
          <InlineTerminal nodePath={node.path} projectId={p.id} onClose={() => onToggleTerminal(node.path)} />
        )}
      </div>
    );
  }

  // Folder node
  const count = node.children?.filter(c => c.type === 'project').length || 0;
  const totalChildren = node.children?.length || 0;
  const isTerminalOpen = terminalPaths.has(node.path);

  // Find first project inside folder for terminal
  let firstProjectId: number | null = null;
  const findFirst = (nodes: TreeNode[]): number | null => {
    for (const n of nodes) {
      if (n.type === 'project' && n.project) return n.project.id;
      if (n.children) {
        const found = findFirst(n.children);
        if (found) return found;
      }
    }
    return null;
  };
  if (node.children) firstProjectId = findFirst(node.children);

  return (
    <div>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded hover:bg-gray-100 group transition"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={toggle}
      >
        <span className="text-gray-400 text-sm w-4 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : '' }}>
          ▶
        </span>
        <span className="text-gray-500">{expanded ? '📂' : '📁'}</span>
        <span className={`text-gray-800 text-sm font-medium ${isTerminalOpen ? 'text-emerald-600' : ''}`}>{node.name}</span>
        <span className="text-xs text-gray-400 ml-1">{count} project{count !== 1 ? 's' : ''}</span>
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(node.path); toast('Path copied!'); }}
          className="text-gray-400 hover:text-emerald-500 transition text-xs ml-1 cursor-pointer"
          title="Copy path"
        >
          📋
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (firstProjectId) onToggleTerminal(node.path); }}
          className={`text-xs ml-1 cursor-pointer transition ${isTerminalOpen ? 'text-emerald-500' : 'text-gray-400 hover:text-emerald-500'}`}
          title="Start terminal"
        >
          {isTerminalOpen ? '⏹' : '▶'}
        </button>
      </div>
      {isTerminalOpen && firstProjectId && (
        <InlineTerminal nodePath={node.path} projectId={firstProjectId} onClose={() => onToggleTerminal(node.path)} />
      )}
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FolderNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggleTerminal={onToggleTerminal}
              terminalPaths={terminalPaths}
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
  const [openTerminals, setOpenTerminals] = useState<Set<string>>(new Set());
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const typeFilter = searchParams.get('type');

  useEffect(() => {
    api.getProjects(typeFilter || undefined).then((data) => {
      setProjects(data.projects);
      setCountMap(data.countMap);
      setLoading(false);
    });
  }, [typeFilter]);

  const handleToggleTerminal = useCallback((path: string) => {
    setOpenTerminals((prev) => {
      if (prev.has(path)) {
        const next = new Set(prev);
        next.delete(path);
        return next;
      }
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const title = !typeFilter
    ? 'All Projects'
    : typeFilter.toUpperCase();

  const subtitle = typeFilter === 'app'
    ? 'Flutter ' + projects.filter(p => p.type === 'flutter').length + ' · Laravel ' + projects.filter(p => p.type === 'laravel').length + ' · Next ' + projects.filter(p => p.type === 'next').length
    : projects.length + ' project(s) found';

  const tree = buildTree(projects, countMap);

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-gray-500 text-sm">{subtitle}</p>
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
                onToggleTerminal={handleToggleTerminal}
                terminalPaths={openTerminals}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

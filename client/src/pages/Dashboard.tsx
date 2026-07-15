import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '../components/Snackbar';

// Tree node types
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
        // Last segment = project
        current.push({
          type: 'project',
          name: part,
          path: currentPath,
          project: p,
          running: countMap[p.id] || 0,
        });
      } else {
        // Folder segment
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

  // Sort: folders first, then projects, alphabetically
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

  // Expand root-level folders by default
  for (const n of root) {
    if (n.type === 'folder') n.expanded = true;
  }

  return root;
}

function FolderNode({ node, depth, onNavigate }: {
  node: TreeNode;
  depth: number;
  onNavigate: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(node.expanded || false);

  const toggle = useCallback(() => {
    setExpanded(!expanded);
  }, [expanded]);

  if (node.type === 'project' && node.project) {
    const p = node.project;
    return (
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-100 cursor-pointer group transition ml-6"
        onClick={() => onNavigate(p.id)}
      >
        <span className="text-gray-400 text-sm w-4">
          {p.type === 'flutter' ? '🔵' : p.type === 'next' ? '⚫' : p.type === 'laravel' ? '🟠' : '🟣'}
        </span>
        <span className="text-gray-700 text-sm truncate flex-1">{node.name}</span>
        {p.path && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(p.path);
              toast('Path copied!');
            }}
            className="text-gray-400 hover:text-emerald-500 transition text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Copy path"
          >
            📋
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(p.id);
          }}
          className="text-gray-400 hover:text-emerald-500 transition text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Open terminal"
        >
          ▶
        </button>
        <span className={`text-xs px-1.5 py-0.5 rounded ${
          p.type === 'flutter' ? 'text-blue-600 bg-blue-50' : p.type === 'next' ? 'text-gray-600 bg-gray-100' : p.type === 'laravel' ? 'text-orange-600 bg-orange-50' : 'text-purple-600 bg-purple-50'
        }`}>
          {p.type === 'agent' ? 'AGENT' : p.type === 'next' ? 'Next.js' : p.type.charAt(0).toUpperCase() + p.type.slice(1)}
        </span>
        {p.path && (
          <span className="text-xs text-gray-400 hidden group-hover:inline ml-1 truncate max-w-[200px]">
            {p.path.replace('/Users/adibagaspratama', '~')}
          </span>
        )}
        <Badge variant="secondary" className="text-xs ml-1">
          {node.running || 0}
        </Badge>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            const fullPath = node.path;
            navigator.clipboard.writeText(fullPath);
            toast('Path copied!');
          }}
          className="text-gray-400 hover:text-emerald-500 transition text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
          title="Copy path"
        >
          📋
        </button>
        {node.children && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to first project inside
              const first = node.children?.find(c => c.type === 'project');
              if (first?.project) onNavigate(first.project.id);
            }}
            className="text-gray-400 hover:text-emerald-500 transition text-xs opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Open terminal"
          >
            ▶
          </button>
        )}
        <span className="text-xs text-gray-400 ml-1">{count} project{count !== 1 ? 's' : ''}</span>
      </div>
      {expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1} onNavigate={onNavigate} />
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
                onNavigate={(id) => navigate(`/project/${id}`)}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '../components/Snackbar';

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
    ? projects.filter(p => p.type === 'flutter').length + ' Flutter · ' + projects.filter(p => p.type === 'laravel').length + ' Laravel'
    : projects.length + ' project(s) found';

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-md transition border-l-4"
              style={{
                borderLeftColor: project.type === 'flutter' ? '#3b82f6' : project.type === 'agent' ? '#a855f7' : '#f97316',
              }}
              onClick={() => navigate(`/project/${project.id}`)}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-gray-800">{project.name}</CardTitle>
                    <CardDescription>
                      <span className={
                        project.type === 'flutter'
                          ? 'text-blue-500'
                          : project.type === 'laravel'
                            ? 'text-orange-500'
                            : 'text-purple-500'
                      }>
                        {project.type === 'agent' ? '🤖 AGENT' : project.type.charAt(0).toUpperCase() + project.type.slice(1)}
                      </span>
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {countMap[project.id] || 0} running
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 mb-3">
                  <p className="text-xs text-gray-400 truncate">{project.path}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      navigator.clipboard.writeText(project.path);
                      toast('Path copied!');
                    }}
                    className="text-gray-500 hover:text-emerald-500 transition text-xs flex-shrink-0 cursor-pointer"
                    title="Copy path"
                  >
                    📋
                  </button>
                </div>
                <span className="text-sm text-gray-600 hover:text-gray-800">
                  Open →
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

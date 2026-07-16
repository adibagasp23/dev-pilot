import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { FavoriteProcess } from '../types';

const links = [
  { label: 'All Projects', path: '/', filter: null },
  { label: '📱 APP', path: '/?type=app', filter: 'app' },
];

const TYPE_EMOJI: Record<string, string> = {
  flutter: '🔵', laravel: '🟠', next: '⚫', rust: '🟣', agent: '🤖', strapi: '📦',
};

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentFilter = searchParams.get('type') || 'all';
  const [favProcesses, setFavProcesses] = useState<FavoriteProcess[]>([]);

  const load = () => {
    api.getFavoriteProcesses().then((d) => setFavProcesses(d.processes)).catch(() => {});
  };

  useEffect(() => {
    load();
    window.addEventListener('favorites-changed', load);
    return () => window.removeEventListener('favorites-changed', load);
  }, []);

  return (
    <aside className="w-64 bg-gray-900 text-white h-screen overflow-y-auto p-4 flex-shrink-0">
      <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="text-emerald-400">⚡</span> PM
      </h1>

      <nav className="space-y-2">
        {links.map((link) => {
          const isActive = link.filter === null
            ? location.pathname === '/' && currentFilter === 'all'
            : currentFilter === link.filter;
          return (
            <a
              key={link.label}
              href={link.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(link.path);
              }}
              className={`block px-3 py-2 rounded transition ${
                isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
            >
              {link.label}
            </a>
          );
        })}

        <a
          href="/monitor"
          onClick={(e) => { e.preventDefault(); navigate('/monitor'); }}
          className={`block px-3 py-2 rounded transition ${
            location.pathname === '/monitor' ? 'bg-gray-700' : 'hover:bg-gray-700'
          }`}
        >
          📊 Monitor
        </a>

        <hr className="my-3 border-gray-700" />
        <a
          href="/settings"
          onClick={(e) => { e.preventDefault(); navigate('/settings'); }}
          className={`block px-3 py-2 rounded transition ${
            location.pathname === '/settings' ? 'bg-gray-700' : 'hover:bg-gray-700'
          }`}
        >
          ⚙ Settings
        </a>
        <a
          href="/scan"
          onClick={async (e) => {
            e.preventDefault();
            await fetch('/api/scan', { method: 'POST' });
            navigate('/');
          }}
          className="block px-3 py-2 rounded hover:bg-gray-700 transition"
        >
          🔍 Re-scan All
        </a>

        {/* Pinned Commands at bottom */}
        {favProcesses.length > 0 && (
          <>
            <hr className="my-3 border-gray-700" />
            <p className="px-3 text-xs text-gray-400 uppercase tracking-wider mb-1">Pinned</p>
            {favProcesses.map((proc) => (
              <a
                key={proc.id}
                href={`/project/${proc.project_id}`}
                onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); }}
                className="block px-3 py-1.5 rounded hover:bg-gray-700 transition text-sm truncate group"
              >
                <span className="text-gray-400 group-hover:text-white">
                  {TYPE_EMOJI[proc.project_type] || '📁'} {proc.project_name.replace(/^~\//, '')}
                </span>
                <span className="text-gray-500 group-hover:text-gray-300 text-xs block truncate">
                  📌 {proc.label}
                </span>
              </a>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}

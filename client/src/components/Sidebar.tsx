import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { FavoriteProcess } from '../types';

const links = [
  { label: 'All Projects', path: '/', filter: null, icon: '📋' },
  { label: 'APP', path: '/?type=app', filter: 'app', icon: '📱' },
  { label: 'Monitor', path: '/monitor', icon: '📊' },
  { label: 'Task List', path: '/tasks', icon: '📝' },
];

const bottomLinks = [
  { label: 'VPN', path: '/project/26', icon: '🔒' },
  { label: 'Push APK', path: '/push-apk', icon: '📤' },
  { label: 'Settings', path: '/settings', icon: '⚙' },
];

const TYPE_EMOJI: Record<string, string> = {
  flutter: '🔵', laravel: '🟠', next: '⚫', rust: '🟣', agent: '🤖', strapi: '📦',
};

const TYPE_BADGE: Record<string, string> = {
  flutter: 'bg-blue-500/10 text-blue-400',
  laravel: 'bg-orange-500/10 text-orange-400',
  next: 'bg-gray-500/10 text-gray-400',
  rust: 'bg-purple-500/10 text-purple-400',
  agent: 'bg-green-500/10 text-green-400',
  strapi: 'bg-indigo-500/10 text-indigo-400',
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

  const isActive = (path: string, filter?: string | null) => {
    if (filter !== undefined) {
      return location.pathname === '/' && currentFilter === (filter || 'all');
    }
    if (path === '/') return location.pathname === '/' && currentFilter === 'all';
    return location.pathname === path;
  };

  const NavItem = ({ label, path, icon, filter: f }: { label: string; path: string; icon: string; filter?: string | null }) => {
    const active = f !== undefined ? isActive(path, f) : isActive(path);
    return (
      <a
        href={path}
        onClick={(e) => { e.preventDefault(); navigate(path); }}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-white shadow-sm shadow-emerald-500/10'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full" />}
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </a>
    );
  };

  return (
    <aside className="w-64 h-screen flex flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-r border-white/5">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
            DP
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">Dev Pilot</h1>
            <p className="text-[11px] text-gray-500">Process Manager</p>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        <p className="px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Navigation</p>
        {links.map((link) => (
          <NavItem key={link.path} label={link.label} path={link.path} icon={link.icon} filter={link.filter} />
        ))}

        {/* Pinned Commands */}
        {favProcesses.length > 0 && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Pinned</p>
            </div>
            {favProcesses.map((proc) => (
              <a
                key={proc.id}
                href={`/project/${proc.project_id}`}
                onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); }}
                className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  location.pathname === `/project/${proc.project_id}`
                    ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {location.pathname === `/project/${proc.project_id}` && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full" />
                )}
                <span className="text-base mt-0.5">{TYPE_EMOJI[proc.project_type] || '📁'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{proc.project_name.split('/').pop()}</div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-1.5">
                    <span>📌 {proc.label}</span>
                    <span className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_BADGE[proc.project_type] || 'bg-gray-500/10 text-gray-400'}`}>
                      {proc.project_type}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </>
        )}
      </nav>

      {/* Bottom Links */}
      <div className="px-3 py-3 border-t border-white/5 bg-gray-900/50">
        <p className="px-3 text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1">Tools</p>
        <div className="space-y-1">
          {bottomLinks.map((link) => (
            <NavItem key={link.path} label={link.label} path={link.path} icon={link.icon} />
          ))}
        </div>
      </div>
    </aside>
  );
}

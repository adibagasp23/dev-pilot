import { useEffect, useState } from 'react';
import React from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '../components/Snackbar';
import { api } from '../api';
import type { FavoriteProcess } from '../types';
import { IconProjects, IconApp, IconMonitor, IconTasks, IconLock, IconMedia, IconUpload, IconSettings, IconFolder, IconPin, IconCircle, IconRobot, IconPackage, IconPlay, IconStop, IconTrash } from './Icons';

const links = [
  { label: 'All Projects', path: '/', filter: null, icon: IconProjects },
  { label: 'APP', path: '/?type=app', filter: 'app', icon: IconApp },
  { label: 'Monitor', path: '/monitor', icon: IconMonitor },
  { label: 'Task List', path: '/tasks', icon: IconTasks },
];

const bottomLinks = [
  { label: 'VPN', path: '/project/26', icon: IconLock },
  { label: 'Media', path: '/media', icon: IconMedia },
  { label: 'Push APK', path: '/push-apk', icon: IconUpload },
  { label: 'Settings', path: '/settings', icon: IconSettings },
];

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  flutter: () => <IconCircle className="w-3 h-3" color="#3B82F6" />,
  laravel: () => <IconCircle className="w-3 h-3" color="#F97316" />,
  next: () => <IconCircle className="w-3 h-3" color="#6B7280" />,
  rust: () => <IconCircle className="w-3 h-3" color="#A855F7" />,
  agent: () => <IconRobot className="w-3.5 h-3.5 text-green-400" />,
  strapi: () => <IconPackage className="w-3.5 h-3.5 text-indigo-400" />,
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
  const [isOpen, setIsOpen] = useState(false);

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

  const NavItem = ({ label, path, icon: IconComp, filter: f }: { label: string; path: string; icon: React.ComponentType<{ className?: string }>; filter?: string | null }) => {
    const active = f !== undefined ? isActive(path, f) : isActive(path);
    return (
      <a
        href={path}
        onClick={(e) => { e.preventDefault(); navigate(path); setIsOpen(false); }}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
          active
            ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-white shadow-sm shadow-emerald-500/10'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full" />}
        <IconComp className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </a>
    );
  };

  return (
    <>
      {/* Hamburger button — only show on mobile when sidebar is collapsed */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-3 left-3 z-[60] sm:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-gray-900 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      )}

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`
        w-64 h-screen flex flex-col bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950
        border-r border-white/5
        fixed sm:relative z-50 sm:z-auto
        transition-transform duration-200 sm:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header */}
        <div className="px-4 pt-5 pb-4 border-b border-white/5 flex items-center">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
              DP
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">Dev Pilot</h1>
              <p className="text-[11px] text-gray-500">Process Manager</p>
            </div>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className="sm:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                  onClick={(e) => { e.preventDefault(); navigate(`/project/${proc.project_id}`); setIsOpen(false); }}
                  className={`group relative flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    location.pathname === `/project/${proc.project_id}`
                      ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                {location.pathname === `/project/${proc.project_id}` && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-400 rounded-r-full" />
                )}
                {React.createElement(TYPE_ICON[proc.project_type] || (() => <IconFolder className="w-4 h-4" />), { className: 'w-4 h-4' })}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{proc.project_name.replace(/^~\//, '').split('/').slice(-2).join('/')}</div>
                  <div className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-1.5">
                    <IconPin className="w-3 h-3 text-gray-500" />
                    <span>{proc.label}</span>
                    <span className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_BADGE[proc.project_type] || 'bg-gray-500/10 text-gray-400'}`}>
                      {proc.project_type}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        if (proc.status === 'running') {
                          await api.stopProcess(proc.id);
                          toast(`⏹ ${proc.label} stopped`);
                        } else {
                          await api.startProcess(proc.id);
                          toast(`▶ ${proc.label} started`);
                        }
                        load();
                      } catch (err: any) {
                        toast(`❌ ${err.message}`);
                      }
                    }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition opacity-0 group-hover:opacity-100 hover:bg-white/10"
                    title={proc.status === 'running' ? 'Stop' : 'Start'}
                  >
                    {proc.status === 'running' ? (
                      <IconStop className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <IconPlay className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        await api.toggleProcessFavorite(proc.id, false);
                        toast(`Unpinned ${proc.label}`);
                        load();
                      } catch (err: any) {
                        toast(`❌ ${err.message}`);
                      }
                    }}
                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md transition opacity-0 group-hover:opacity-100 hover:bg-white/10"
                    title="Unpin"
                  >
                    <IconTrash className="w-3 h-3 text-gray-500 hover:text-red-400" />
                  </button>
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
    </>
  );
}

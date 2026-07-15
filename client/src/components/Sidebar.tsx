import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const links = [
  { label: 'All Projects', path: '/', filter: null },
  { label: '📱 APP', path: '/?type=app', filter: 'app' },
  { label: '🤖 AGENT', path: '/?type=agent', filter: 'agent' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentFilter = searchParams.get('type') || 'all';

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
      </nav>
    </aside>
  );
}

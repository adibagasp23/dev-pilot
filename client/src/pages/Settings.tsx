import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ScanFolder } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '../components/Snackbar';

const TYPE_EMOJI: Record<string, string> = {
  flutter: '🔵',
  laravel: '🟠',
  next: '⚫',
  rust: '🟣',
  agent: '🤖',
  strapi: '📦',
};

const TYPE_COLORS: Record<string, string> = {
  flutter: 'bg-blue-100 text-blue-700',
  laravel: 'bg-orange-100 text-orange-700',
  next: 'bg-gray-100 text-gray-600',
  rust: 'bg-purple-100 text-purple-700',
  agent: 'bg-green-100 text-green-700',
  strapi: 'bg-teal-100 text-teal-700',
};

export function Settings() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [path, setPath] = useState('');
  const [appTypes, setAppTypes] = useState<string[]>([]);
  const [newType, setNewType] = useState('');

  useEffect(() => {
    api.getFolders().then((data) => setFolders(data.folders)).catch(() => {});
    api.getAppTypes().then((data) => setAppTypes(data.types)).catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!path.trim()) return;
    const data = await api.addFolder(path.trim());
    setFolders(data.folders);
    setPath('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this folder and its projects?')) return;
    await api.deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddType = async () => {
    const t = newType.trim().toLowerCase();
    if (!t || appTypes.includes(t)) return;
    const updated = [...appTypes, t];
    await api.setAppTypes(updated);
    setAppTypes(updated);
    setNewType('');
    toast(`Added type: ${t}`);
  };

  const handleRemoveType = async (t: string) => {
    const updated = appTypes.filter((x) => x !== t);
    await api.setAppTypes(updated);
    setAppTypes(updated);
    toast(`Removed type: ${t}`);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙ Settings</h2>

      {/* APP Types Config */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-gray-700">APP Types</CardTitle>
          <p className="text-sm text-gray-500">
            Project types shown in the <strong>APP</strong> filter tab on the Dashboard.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-3">
            {appTypes.map((t) => (
              <Badge
                key={t}
                className={`${TYPE_COLORS[t] || 'bg-gray-100 text-gray-600'} text-sm px-3 py-1 flex items-center gap-1`}
              >
                {TYPE_EMOJI[t] || '📁'} {t}
                <button
                  onClick={() => handleRemoveType(t)}
                  className="ml-1 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                >
                  ✕
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., strapi"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
            />
            <button
              onClick={handleAddType}
              className="bg-emerald-500 text-white px-4 py-2 rounded text-sm hover:bg-emerald-600 whitespace-nowrap cursor-pointer"
            >
              Add Type
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Add Scan Folder */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-gray-700">Add Scan Folder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., /Users/name/projects"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="bg-emerald-500 text-white px-4 py-2 rounded text-sm hover:bg-emerald-600 whitespace-nowrap cursor-pointer"
            >
              Add & Scan
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Scan Folders List */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-gray-700">Scan Folders</CardTitle>
        </CardHeader>
        <CardContent>
          {folders.length === 0 ? (
            <p className="text-gray-400 text-sm">No folders added yet.</p>
          ) : (
            <ul className="divide-y">
              {folders.map((folder) => (
                <li
                  key={folder.id}
                  className="py-2 flex justify-between items-center"
                >
                  <span className="text-sm text-gray-700">{folder.path}</span>
                  <button
                    onClick={() => handleDelete(folder.id)}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

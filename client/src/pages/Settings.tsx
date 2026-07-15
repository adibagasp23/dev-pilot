import { useEffect, useState } from 'react';
import { api } from '../api';
import type { ScanFolder } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function Settings() {
  const [folders, setFolders] = useState<ScanFolder[]>([]);
  const [path, setPath] = useState('');

  useEffect(() => {
    api.getFolders().then((data) => setFolders(data.folders));
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

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙ Settings</h2>

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
              className="bg-emerald-500 text-white px-4 py-2 rounded text-sm hover:bg-emerald-600 whitespace-nowrap"
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

import { useEffect, useState, useRef } from 'react';
import { toast } from '../components/Snackbar';
import AdbDevicePanel from '../components/AdbDevicePanel';

export default function PushApk() {
  const [selectedDevice, setSelectedDevice] = useState('');
  const [filePath, setFilePath] = useState('');
  const [targetDir, setTargetDir] = useState('/sdcard/Application/');
  const [pushing, setPushing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [fileGroups, setFileGroups] = useState<{ project: string; files: { path: string; name: string; time: string }[] }[]>([]);
  const filePickerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  // Tutup file picker kalo klik di luar
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filePickerRef.current && !filePickerRef.current.contains(e.target as Node)) {
        setFilePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.apk')) {
        setUploadedFile(file);
        addLog(`📎 Drop file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      } else {
        addLog('⚠️ Hanya file .apk yang didukung');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      addLog(`📎 Pilih file: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    }
  };

  const handlePush = async () => {
    if (!selectedDevice) {
      addLog('❌ Pilih device tujuan');
      return;
    }
    if (!filePath && !uploadedFile) {
      addLog('❌ Masukkan path APK atau pilih file');
      return;
    }

    setPushing(true);

    try {
      const formData = new FormData();
      formData.append('device', selectedDevice);
      formData.append('target', targetDir);

      if (uploadedFile) {
        formData.append('apk', uploadedFile);
      } else {
        formData.append('path', filePath);
      }

      const res = await fetch('/api/push-apk', { method: 'POST', body: formData });
      const reader = res.body?.getReader();
      if (!reader) { addLog('❌ Gagal baca response'); setPushing(false); return; }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        // Split by newline and add each line
        text.split('\n').filter(Boolean).forEach(line => addLog(line));
      }

      setUploadedFile(null);
      setFilePath('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      addLog('❌ Error: ' + err.message);
    } finally {
      setPushing(false);
    }
  };

  const handlePickApk = async () => {
    try {
      const res = await fetch('/api/push-apk-files');
      const data = await res.json();
      if (data.groups?.length > 0) {
        setFileGroups(data.groups);
        setSearchQuery('');
        setFilePickerOpen(true);
      }
    } catch {}
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">📤 Push APK</h1>

      {/* ADB Devices — shared component */}
      <AdbDevicePanel onLog={addLog} selectedDevice={selectedDevice} onDeviceSelect={setSelectedDevice} />

      {/* Terminal Log */}
      {log.length > 0 && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-40 overflow-y-auto">
          {log.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}

      {/* File Selection */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-sm font-semibold text-gray-600 uppercase mb-2">📦 APK File</h2>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
            dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadedFile ? (
            <div>
              <p className="text-lg">📄 {uploadedFile.name}</p>
              <p className="text-sm text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); setUploadedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="mt-2 text-xs text-red-500 hover:text-red-700"
              >
                ✕ Hapus
              </button>
            </div>
          ) : (
            <div>
              <p className="text-3xl mb-2">📁</p>
              <p className="text-gray-500">Drag & drop file .apk ke sini</p>
              <p className="text-xs text-gray-400 mt-1">atau klik untuk memilih file</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".apk"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* OR Manual Path */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">atau path lokal</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="~/kit/kce/.../*.apk"
            className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono"
          />
          <div className="relative">
            <button
              onClick={handlePickApk}
              className="px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 transition"
              title="Pilih APK dari project"
            >
              📂
            </button>
          </div>
        </div>
      </div>

      {/* Target Directory */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-sm font-semibold text-gray-600 uppercase mb-2">📁 Target Directory</h2>
        <input
          type="text"
          value={targetDir}
          onChange={(e) => setTargetDir(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
        />
      </div>

      {/* Push Button */}
      <button
        onClick={handlePush}
        disabled={pushing || !selectedDevice || (!filePath && !uploadedFile)}
        className={`w-full py-3 rounded-lg font-semibold text-white transition ${
          pushing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {pushing ? '📤 Mengirim...' : '📤 Push APK'}
      </button>

      {/* Modal Pilih APK */}
      {filePickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setFilePickerOpen(false)}>
          <div
            ref={filePickerRef}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">📦 Pilih APK</h3>
                <button onClick={() => setFilePickerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari APK..."
                className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                autoFocus
              />
              {/* Filter badge */}
              <div className="flex gap-2">
                {['Semua', 'APK', 'AAB'].map(type => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type === 'Semua' ? '' : type)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
                      filterType === (type === 'Semua' ? '' : type)
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {fileGroups
                .map(group => {
                  const filteredFiles = group.files.filter(f => {
                    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) && !group.project.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    if (filterType === 'APK' && !f.name.endsWith('.apk')) return false;
                    if (filterType === 'AAB' && !f.name.endsWith('.aab')) return false;
                    return true;
                  });
                  if (filteredFiles.length === 0) return null;
                  return (
                    <div key={group.project}>
                      <p className="px-2 py-1.5 text-xs font-semibold text-gray-500">📁 {group.project}</p>
                      {filteredFiles.map(f => (
                        <button
                          key={f.path}
                          onClick={() => {
                            setFilePath(f.path);
                            setFilePickerOpen(false);
                            addLog(`📂 Load: ${f.name}`);
                          }}
                          className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg transition flex items-center justify-between"
                        >
                          <span className="font-mono text-xs truncate">📄 {f.name}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 whitespace-nowrap">{f.time}</span>
                            <button
                              onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(f.path); toast('📋 Path copied!'); }}
                              className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 transition"
                              title="Salin path"
                            >📋</button>
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              {fileGroups.every(g => !g.project.toLowerCase().includes(searchQuery.toLowerCase()) && !g.files.some(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))) && (
                <p className="text-center text-gray-400 py-8">Tidak ada APK ditemukan</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
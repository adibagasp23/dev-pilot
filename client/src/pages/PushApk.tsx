import { useEffect, useState, useRef } from 'react';
import { toast } from '../components/Snackbar';

interface AdbDevice {
  id: string;
  status: string;
  hostname?: string;
  model?: string;
}

export default function PushApk() {
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const discoveredRef = useRef<AdbDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [filePath, setFilePath] = useState('');
  const [targetDir, setTargetDir] = useState('/sdcard/Application/');
  const [pushing, setPushing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [fileGroups, setFileGroups] = useState<{ project: string; files: { path: string; name: string; time: string }[] }[]>([]);
  const filePickerRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const loadDevices = async () => {
    try {
      const res = await fetch('/api/adb-devices');
      const data = await res.json();
      const connected: AdbDevice[] = data.devices || [];
      // Gabung device connected + discovered cache (yang belum connect)
      const connectedIds = new Set(connected.map(d => d.id.replace(/:5555$/, '')));
      const merged = [...connected];
      for (const d of discoveredRef.current) {
        if (!connectedIds.has(d.id.replace(/:5555$/, ''))) {
          merged.push(d);
        }
      }
      setDevices(merged);
      if (connected.length > 0 && !selectedDevice) {
        setSelectedDevice(connected[0].id);
      }
    } catch (err: any) {
      addLog('❌ Gagal load devices: ' + err.message);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

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

  const handleScanWifi = async () => {
    setScanning(true);
    addLog('🔍 Scanning jaringan untuk ADB device...');
    try {
      const res = await fetch('/api/adb-scan', { method: 'POST' });
      const data = await res.json();
      if (data.devices?.length > 0) {
        addLog(`✅ Ditemukan ${data.devices.length} device (${data.hosts} host aktif)`);
        data.devices.forEach((d: AdbDevice) => {
          addLog(`   ${d.id}${d.hostname !== '—' ? ' (' + d.hostname + ')' : ''}`);
        });
        // Simpan di discoveredRef & trigger refresh
        const existingIds = new Set(discoveredRef.current.map(d => d.id.replace(/:5555$/, '')));
        const newItems = data.devices.filter((d: AdbDevice) => !existingIds.has(d.id.replace(/:5555$/, '')));
        discoveredRef.current = [...discoveredRef.current, ...newItems];
        loadDevices();
      } else {
        addLog('⚠️ Tidak ada device ADB ditemukan');
        if (data.error) addLog('   ' + data.error);
      }
    } catch (err: any) {
      addLog('❌ Scan gagal: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (ip: string) => {
    setConnecting(ip);
    addLog(`📡 Menghubungkan ke ${ip}...`);
    try {
      const res = await fetch('/api/adb-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (data.ok) {
        setLog([]);
        addLog(`✅ Terkoneksi ke ${ip}`);
        setTimeout(loadDevices, 1000);
      } else {
        addLog(`❌ Gagal: ${data.error || data.output}`);
      }
    } catch (err: any) {
      addLog('❌ Error: ' + err.message);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnectAll = async () => {
    addLog('🔌 Memutuskan semua koneksi ADB...');
    try {
      const res = await fetch('/api/adb-disconnect-all', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setLog([]);
        addLog('✅ Semua koneksi diputus');
        setTimeout(loadDevices, 1000);
      } else {
        addLog('❌ ' + (data.error || 'Gagal'));
      }
    } catch (err: any) {
      addLog('❌ Error: ' + err.message);
    }
  };

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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">📤 Push APK</h1>

      {/* ADB Devices */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-600 uppercase">📱 ADB Devices</h2>
          <div className="flex gap-2">
            <button
              onClick={handleScanWifi}
              disabled={scanning}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {scanning ? '🔍 Scanning...' : '📡 Scan WiFi'}
            </button>
            <button onClick={handleDisconnectAll} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition">
              🔌 Disconnect All
            </button>
            <button onClick={() => { addLog('🔄 Refresh...'); loadDevices(); }} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 transition">
              🔄
            </button>
          </div>
        </div>

        {devices.length === 0 ? (
          <p className="text-sm text-gray-400">Tidak ada device terhubung. Colok device via USB atau scan WiFi.</p>
        ) : (
          <div className="space-y-1">
            {devices.map(d => (
              <div key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="device"
                    value={d.id}
                    checked={selectedDevice === d.id}
                    onChange={() => setSelectedDevice(d.id)}
                    className="accent-blue-600"
                  />
                  <span className={`w-2 h-2 rounded-full ${d.status === 'device' ? 'bg-green-500' : d.status === 'offline' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-mono">{d.id}</span>
                  {d.model && (
                    <span className="text-xs text-gray-500">{d.model}</span>
                  )}
                  {d.hostname && d.hostname !== '—' && (
                    <span className="text-xs text-gray-400">({d.hostname})</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    d.status === 'device' ? 'bg-green-100 text-green-700' :
                    d.status === 'discovered' ? 'bg-blue-100 text-blue-700' :
                    d.status === 'offline' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {d.status}
                  </span>
                </label>
                {d.status !== 'device' && d.id.includes('.') && (
                  <button
                    onClick={() => handleConnect(d.id)}
                    disabled={connecting === d.id}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 transition"
                  >
                    {connecting === d.id ? '⏳' : '🔗 Connect'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
              onClick={async () => {
                try {
                  const res = await fetch('/api/push-apk-files');
                  const data = await res.json();
                  if (data.groups?.length > 0) {
                    setFileGroups(data.groups);
                    setSearchQuery('');
                    setFilePickerOpen(true);
                  }
                } catch {}
              }}
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
                    // Filter by search
                    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase()) && !group.project.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    // Filter by type
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

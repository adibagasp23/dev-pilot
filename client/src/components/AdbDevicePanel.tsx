import { useEffect, useState, useRef } from 'react';

interface AdbDevice {
  id: string;
  status: string;
  hostname?: string;
  model?: string;
}

interface AdbDevicePanelProps {
  onLog?: (msg: string) => void;
  compact?: boolean;
  selectedDevice?: string;
  onDeviceSelect?: (deviceId: string) => void;
}

export function useAdbDevices() {
  const [tcpiping, setTcpiping] = useState<string | null>(null);
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const discoveredRef = useRef<AdbDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const res = await fetch('/api/adb-devices');
      const data = await res.json();
      const connected: AdbDevice[] = data.devices || [];
      const connectedIds = new Set(connected.map(d => d.id.replace(/:5555$/, '')));
      const merged = [...connected];
      for (const d of discoveredRef.current) {
        if (!connectedIds.has(d.id.replace(/:5555$/, ''))) {
          merged.push(d);
        }
      }
      setDevices(merged);
      return merged;
    } catch { return []; }
  };

  const scanWifi = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/adb-scan', { method: 'POST' });
      const data = await res.json();
      if (data.devices?.length > 0) {
        const existingIds = new Set(discoveredRef.current.map(d => d.id.replace(/:5555$/, '')));
        const newItems = data.devices.filter((d: AdbDevice) => !existingIds.has(d.id.replace(/:5555$/, '')));
        discoveredRef.current = [...discoveredRef.current, ...newItems];
        loadDevices();
      }
      return data;
    } finally { setScanning(false); }
  };

  const connect = async (ip: string) => {
    setConnecting(ip);
    try {
      const res = await fetch('/api/adb-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
      const data = await res.json();
      if (data.ok) setTimeout(loadDevices, 1000);
      return data;
    } finally { setConnecting(null); }
  };

  const disconnectAll = async () => {
    try {
      const res = await fetch('/api/adb-disconnect-all', { method: 'POST' });
      const data = await res.json();
      if (data.ok) setTimeout(loadDevices, 1000);
      return data;
    } catch { return { ok: false }; }
  };

  const tcpip = async (deviceId: string) => {
    setTcpiping(deviceId);
    try {
      const res = await fetch('/api/adb-tcpip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: deviceId }),
      });
      const data = await res.json();
      if (data.ok) setTimeout(loadDevices, 2000);
      return data;
    } finally { setTcpiping(null); }
  };

  return { devices, scanning, connecting, tcpiping, loadDevices, scanWifi, connect, disconnectAll, tcpip };
};

export default function AdbDevicePanel({ onLog, compact, selectedDevice: externalSelected, onDeviceSelect }: AdbDevicePanelProps) {
  const { devices, scanning, connecting, tcpiping, loadDevices, scanWifi, connect, disconnectAll, tcpip } = useAdbDevices();
  const [internalSelected, setInternalSelected] = useState('');
  const selectedDevice = externalSelected ?? internalSelected;
  const setSelectedDevice = (id: string) => {
    if (onDeviceSelect) onDeviceSelect(id);
    else setInternalSelected(id);
  };
  const addLog = onLog || (() => {});

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const firstConnected = devices.find(d => d.status === 'device');
      if (firstConnected) setSelectedDevice(firstConnected.id);
    }
  }, [devices]);

  const handleScan = async () => {
    addLog('🔍 Scanning jaringan untuk ADB device...');
    const data = await scanWifi();
    if (data?.devices?.length > 0) {
      addLog(`✅ Ditemukan ${data.devices.length} device`);
    } else {
      addLog('⚠️ Tidak ada device ADB ditemukan');
    }
  };

  const handleConnect = async (ip: string) => {
    addLog(`📡 Menghubungkan ke ${ip}...`);
    const data = await connect(ip);
    if (data?.ok) {
      addLog(`✅ Terkoneksi ke ${ip}`);
    } else {
      addLog(`❌ Gagal: ${data?.error || data?.output || 'unknown'}`);
    }
  };

  const handleDisconnectAll = async () => {
    addLog('🔌 Memutuskan semua koneksi ADB...');
    const data = await disconnectAll();
    if (data?.ok) {
      addLog('✅ Semua koneksi diputus');
    } else {
      addLog('❌ Gagal disconnect');
    }
  };

  const handleTcpip = async (deviceId: string) => {
    addLog(`🔄 Mengaktifkan ADB TCP/IP di ${deviceId}...`);
    const data = await tcpip(deviceId);
    if (data?.ok) {
      addLog(`✅ Port 5555 aktif di ${deviceId}, cabut USB & connect via WiFi`);
    } else {
      addLog(`❌ Gagal: ${data?.error || data?.output || 'unknown'}`);
    }
  };

  const manualUsbDevices = devices.filter(d => d.status === 'device' && !d.id.includes('.') && !d.id.includes(':'));
  const [manualDeviceId, setManualDeviceId] = useState('');

  // Auto-fill manual input dengan USB device pertama
  useEffect(() => {
    if (manualUsbDevices.length > 0) {
      setManualDeviceId(prev => prev || manualUsbDevices[0].id);
    }
  }, [devices]);

  return (
    <div className={compact ? '' : 'bg-white p-4 rounded-lg shadow-sm border'}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-600 uppercase">📱 ADB Devices</h2>
        <div className="flex gap-2">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {scanning ? '🔍 Scanning...' : '📡 Scan WiFi'}
          </button>
          <button onClick={handleDisconnectAll} className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition">
            🔌 Disconnect All
          </button>
          <button onClick={() => { loadDevices(); }} className="text-xs px-3 py-1.5 border rounded hover:bg-gray-50 transition">
            🔄
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <p className="text-sm text-gray-400">Tidak ada device terhubung.</p>
      ) : (
        <div className="space-y-1">
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50">
              <label className="flex items-center gap-2 cursor-pointer flex-1">
                <input
                  type="radio"
                  name="adb-device"
                  value={d.id}
                  checked={selectedDevice === d.id}
                  onChange={() => setSelectedDevice(d.id)}
                  className="accent-blue-600"
                />
                <span className={`w-2 h-2 rounded-full ${d.status === 'device' ? 'bg-green-500' : d.status === 'offline' ? 'bg-yellow-500' : d.status === 'discovered' ? 'bg-blue-500' : 'bg-red-500'}`} />
                <span className="text-sm font-mono">{d.id}</span>
                {d.model && <span className="text-xs text-gray-500">{d.model}</span>}
                {d.hostname && d.hostname !== '—' && <span className="text-xs text-gray-400">({d.hostname})</span>}
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  d.status === 'device' ? 'bg-green-100 text-green-700' :
                  d.status === 'discovered' ? 'bg-blue-100 text-blue-700' :
                  d.status === 'offline' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {d.status}
                </span>
              </label>
              {d.status === 'device' && !d.id.includes('.') && !d.id.includes(':') && (
                <button
                  onClick={() => handleTcpip(d.id)}
                  disabled={tcpiping === d.id}
                  className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 transition"
                >
                  {tcpiping === d.id ? '⏳' : '🔌 TCPIP 5555'}
                </button>
              )}
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

      {/* Manual TCPIP 5555 — otomatis pake device USB pertama */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={manualDeviceId}
            onChange={e => setManualDeviceId(e.target.value)}
            placeholder={manualUsbDevices.length > 0 ? manualUsbDevices[0].id : 'Serial device (terisi otomatis)'}
            className="flex-1 px-3 py-1.5 border rounded text-xs font-mono"
          />
          <button
            onClick={() => {
              const targetId = manualDeviceId.trim() || manualUsbDevices[0]?.id;
              if (!targetId) {
                addLog('⚠️ Tidak ada device USB terdeteksi. Colok HP via USB dengan USB Debugging aktif.');
                return;
              }
              handleTcpip(targetId);
            }}
            disabled={tcpiping !== null}
            className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 transition whitespace-nowrap"
          >
            {tcpiping ? '⏳' : '🔌 TCPIP 5555'}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Otomatis pake device USB pertama. Klik langsung tanpa perlu isi serial.</p>
      </div>
    </div>
  );
}
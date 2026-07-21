import { useEffect, useState } from 'react';
import { api } from '@/api';

interface RcHistory {
  id: number;
  mode: string;
  suffix: string;
  before_android_min: string | null;
  before_android_latest: string | null;
  before_ios_min: string | null;
  before_ios_latest: string | null;
  android_min: string | null;
  android_latest: string | null;
  ios_min: string | null;
  ios_latest: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const MODE_LABELS: Record<string, string> = {
  baseline: '📊 Baseline',
  optional: '🟢 Optional',
  force: '🔴 Force',
  custom: '✏️ Custom',
};

const MODE_COLORS: Record<string, string> = {
  baseline: 'bg-gray-100 text-gray-700',
  optional: 'bg-blue-100 text-blue-700',
  force: 'bg-red-100 text-red-700',
  custom: 'bg-purple-100 text-purple-700',
};

export default function RemoteConfig() {
  const [history, setHistory] = useState<RcHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = () => {
    setLoading(true);
    fetch('/api/remote-config-history/16')
      .then(r => r.json())
      .then((data: any) => setHistory(data.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">☁️ Remote Config</h1>
          <p className="text-sm text-gray-500 mt-1">TMS v.2 — Firebase project: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">tms-v2-cf453</code></p>
        </div>
        <button
          onClick={loadHistory}
          className="text-sm px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Cara pakai */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">📋 Cara update Remote Config:</p>
        <code className="block bg-amber-100 px-2 py-1 rounded text-xs mt-1">
          cd ~/kit/tms/danareksa/tms-v.2 &amp;&amp; bash scripts/remote-config-update.sh
        </code>
      </div>

      {/* Riwayat */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 uppercase mb-3">📜 Riwayat Update</h2>

        {loading && history.length === 0 ? (
          <p className="text-sm text-gray-400">Memuat...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada riwayat update.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500 text-xs uppercase">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Waktu</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Platform</th>
                  <th className="py-2 pr-3">Android</th>
                  <th className="py-2 pr-3">iOS</th>
                  <th className="py-2 pr-3">Before</th>
                  <th className="py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3 text-gray-400 text-xs">{history.length - i}</td>
                    <td className="py-2 pr-3 text-xs whitespace-nowrap font-mono">
                      {new Date(h.created_at).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${MODE_COLORS[h.mode] || 'bg-gray-100'}`}>
                        {MODE_LABELS[h.mode] || h.mode}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      {(() => {
                        const hasBoth = h.android_min && h.ios_min && h.android_min !== '?' && h.ios_min !== '?';
                        const hasAndroid = h.android_min && h.android_min !== '?';
                        const hasIos = h.ios_min && h.ios_min !== '?';
                        if (hasBoth) return <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-gray-200 text-gray-700">⚪ Both</span>;
                        if (hasAndroid) return <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-green-50 text-green-700">🤖 Android</span>;
                        if (hasIos) return <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">📱 iOS</span>;
                        return <span className="text-xs text-gray-400">—</span>;
                      })()}
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono">
                      <span className="text-gray-800">{h.android_min || '?'}</span>
                      {h.android_latest && h.android_latest !== h.android_min && (
                        <span className="text-gray-400"> → {h.android_latest}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono">
                      <span className="text-gray-800">{h.ios_min || '?'}</span>
                      {h.ios_latest && h.ios_latest !== h.ios_min && (
                        <span className="text-gray-400"> → {h.ios_latest}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono">
                      {(() => {
                        const bAnd = h.before_android_min || h.before_android_latest;
                        const bIos = h.before_ios_min || h.before_ios_latest;
                        if (!bAnd && !bIos) return <span className="text-gray-300">—</span>;
                        const parts = [];
                        if (bAnd) parts.push(<><span className="text-gray-400">A:</span> <span className="text-gray-500">{bAnd}</span></>);
                        if (bIos) parts.push(<><span className="text-gray-400 ml-1">I:</span> <span className="text-gray-500">{bIos}</span></>);
                        return <span>{parts.map((p, i) => <span key={i}>{p}</span>)}</span>;
                      })()}
                    </td>
                    <td className="py-2 pr-2">
                      {h.status === 'success' ? (
                        <span className="text-xs text-emerald-600 font-medium">✅</span>
                      ) : (
                        <span className="text-xs text-red-600 font-medium" title={h.error_message || ''}>
                          ❌ {h.error_message && <span className="ml-1 text-gray-400">{h.error_message}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
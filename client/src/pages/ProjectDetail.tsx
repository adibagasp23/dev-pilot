import { useEffect, useState, useRef, useCallback } from 'react';
import { z } from 'zod';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import KanbanBoard from '../components/KanbanBoard';
import DatePicker from '../components/DatePicker';
import { api, tasksApi, taskStatusesApi, type Task, type TaskStatus } from '../api';
import type { Project, Process } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '../components/Snackbar';
import ProcessLogPanel from '../components/ProcessLogPanel';
import AdbDevicePanel from '../components/AdbDevicePanel';

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [port, setPort] = useState('');
  const [editPort, setEditPort] = useState<Record<number, string>>({});
  const [logs, setLogs] = useState<Record<number, string>>({});
  const [openLogs, setOpenLogs] = useState<Record<number, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [siblings, setSiblings] = useState<{ id: number; name: string; type: string; is_active: boolean }[]>([]);
  const dragItem = useRef<number | null>(null);
  const canDrag = useRef(false);
  const processesRef = useRef<Process[]>([]);

  // Tasks state
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>([]);
  const [activeTab, setActiveTab] = useState<'commands' | 'tasks' | 'remote-config'>('commands');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [rcHistory, setRcHistory] = useState<any[]>([]);
  const [rcTemplates, setRcTemplates] = useState<any[]>([]);
  const [rcMode, setRcMode] = useState('baseline');
  const [rcEnv, setRcEnv] = useState('dev'); // 'dev' | 'dev-server' | 'prod'
  const [rcTemplateName, setRcTemplateName] = useState('');
  const [rcPlatform, setRcPlatform] = useState('both'); // 'android' | 'ios' | 'both'
  const [rcTargetVersion, setRcTargetVersion] = useState('');
  const [rcAndroidMinVersion, setRcAndroidMinVersion] = useState('');
  const [rcAndroidLatestVersion, setRcAndroidLatestVersion] = useState('');
  const [rcIosMinVersion, setRcIosMinVersion] = useState('');
  const [rcIosLatestVersion, setRcIosLatestVersion] = useState('');
  const [rcAndroidStoreUrl, setRcAndroidStoreUrl] = useState('https://play.google.com/store/apps/details?id=co.id.kibumn.tms.tenancy&hl=id');
  const [rcIosStoreUrl, setRcIosStoreUrl] = useState('https://apps.apple.com/id/app/tenant-apps-kawasan-industri/id1671143383');
  const [rcTitle, setRcTitle] = useState('');
  const [rcMessage, setRcMessage] = useState('');
  const [rcSaving, setRcSaving] = useState(false);
  const [rcSyncing, setRcSyncing] = useState(false);
  const [rcPublishing, setRcPublishing] = useState<number | null>(null);
  const [rcResult, setRcResult] = useState('');
  const [rcError, setRcError] = useState('');
  const [rcReviewId, setRcReviewId] = useState<number | null>(null);
  const [rcVersionErrors, setRcVersionErrors] = useState<Record<string, string>>({});

  // Env config lookup — avoid repetitive conditionals
  const envMeta = useCallback((env: string) => {
    const map: Record<string, { label: string; shortLabel: string; url: string }> = {
      'dev': { label: 'Dev', shortLabel: '🟡 Dev', url: 'localhost:8003' },
      'dev-server': { label: 'Dev Server', shortLabel: '🟠 Dev Server', url: 'dev-v2.kibumn.co.id' },
      'prod': { label: 'Prod', shortLabel: '🟢 Prod', url: 'kibumn.co.id' },
    };
    return map[env] || map['prod'];
  }, []);

  const compareVersions = (a: string, b: string): number => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  };

  const [rcCustomVersionInput, setRcCustomVersionInput] = useState<Record<string, boolean>>({});
  const [rcSyncData, setRcSyncData] = useState<{ android: { min: string; latest: string }; ios: { min: string; latest: string } }>({ android: { min: '', latest: '' }, ios: { min: '', latest: '' } });

  const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/, 'Format harus x.y.z (contoh: 2.0.4)');

  // latest_version & target_version → patch aja, min_version → semua (minor/major = force)
  const getVersionSuggestions = (current: string, field?: string): { version: string; label: string }[] => {
    const onlyPatch = field === 'latest_version' || field === 'target_version';
    const fallback = onlyPatch
      ? [{ version: '2.0.5', label: 'patch' }]
      : [
          { version: '2.0.5', label: 'patch' },
          { version: '2.1.0', label: 'minor' },
          { version: '3.0.0', label: 'major' },
        ];
    const parts = current.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return fallback;
    const [x, y, z] = parts;
    const results = [
      { version: `${x}.${y}.${z + 1}`, label: 'patch' },
    ];
    if (!onlyPatch) {
      results.push(
        { version: `${x}.${y + 1}.1`, label: 'minor' },
        { version: `${x + 1}.1.1`, label: 'major' },
      );
    }
    return results;
  };

  const VersionSelect = ({ value, onChange, field, label, baseSync }: { value: string; onChange: (v: string) => void; field: string; label: string; baseSync?: string }) => {
    const isCustom = rcCustomVersionInput[field];
    const base = baseSync || '';
    const suggestions = base ? getVersionSuggestions(base, field) : [];
    const noSync = !base;

    if (isCustom) {
      return (
        <div>
          <label className="text-xs font-medium text-gray-500">{label}</label>
          <input
            value={value}
            onChange={e => { onChange(e.target.value); validateField(field, e.target.value); }}
            placeholder="x.y.z"
            className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg ${rcVersionErrors[field] ? 'border-red-400 bg-red-50' : ''}`}
          />
          <button onClick={() => { setRcCustomVersionInput(p => ({...p, [field]: false})); setRcVersionErrors(p => { const n = {...p}; delete n[field]; return n; }); }} className="text-xs text-blue-500 mt-1">← Kembali ke pilihan</button>
          {rcVersionErrors[field] && <p className="text-xs text-red-500 mt-1">{rcVersionErrors[field]}</p>}
        </div>
      );
    }

    return (
      <div>
        <label className="text-xs font-medium text-gray-500">{label}</label>
        <select
          value={value || ''}
          disabled={noSync}
          onChange={e => {
            if (e.target.value === '__custom__') {
              setRcCustomVersionInput(p => ({...p, [field]: true}));
            } else {
              onChange(e.target.value);
            }
          }}
          className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg ${noSync ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${rcVersionErrors[field] ? 'border-red-400 bg-red-50' : ''}`}
        >
          {noSync ? (
            <option value="">🔄 Sync dulu</option>
          ) : (
            <>
              <option value="" disabled>Pilih versi baru</option>
              <option value={base} disabled>── {base} (saat ini)</option>
              {suggestions.map(s => (
                <option key={s.version} value={s.version}>{s.version} ({s.label})</option>
              ))}
              <option value="__custom__">✏️ Kustom...</option>
            </>
          )}
        </select>
        {rcVersionErrors[field] && <p className="text-xs text-red-500 mt-1">{rcVersionErrors[field]}</p>}
      </div>
    );
  };

  const validateField = (field: string, value: string) => {
    if (!value) {
      setRcVersionErrors(prev => { const n = {...prev}; delete n[field]; return n; });
      return;
    }
    const result = versionSchema.safeParse(value);
    setRcVersionErrors(prev => {
      if (result.success) {
        const n = {...prev}; delete n[field]; return n;
      }
      return {...prev, [field]: result.error.errors[0].message};
    });
  };

  const validateVersions = () => {
    const errs: Record<string, string> = {};
    if (rcMode === 'optional' || rcMode === 'force') {
      if (rcTargetVersion) {
        const result = versionSchema.safeParse(rcTargetVersion);
        if (!result.success) errs.target_version = result.error.errors[0].message;
      }
    }
    if (rcMode === 'custom') {
      [
        { val: rcPlatform === 'ios' ? rcIosMinVersion : rcAndroidMinVersion, field: 'min_version' },
        { val: rcPlatform === 'ios' ? rcIosLatestVersion : rcAndroidLatestVersion, field: 'latest_version' },
      ].forEach(({ val, field }) => {
        if (val) {
          const r = versionSchema.safeParse(val);
          if (!r.success) errs[field] = r.error.errors[0].message;
        }
      });
    }
    setRcVersionErrors(errs);
    return Object.keys(errs).length === 0;
  };
  const [rcReviewData, setRcReviewData] = useState<any>(null);

  const [rcPublishResult, setRcPublishResult] = useState<{ id: number; stdout: string; stderr: string; success: boolean } | null>(null);
  const [rcEditingId, setRcEditingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setActiveTab('commands');
    api.getProject(parseInt(id)).then((data) => {
      setProject(data.project);
      setSiblings(data.siblings || []);
      // Sort: favorites first, then by sort_order
      const sorted = [...data.processes].sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1;
        if (!a.is_favorite && b.is_favorite) return 1;
        return (a.sort_order || 0) - (b.sort_order || 0);
      });
      setProcesses(sorted);
      processesRef.current = sorted;

      // Auto-start if ?autoStart=true
      if (searchParams.get('autoStart') === 'true' && data.processes.length > 0) {
        const firstProc = data.project.default_process_id
          ? data.processes.find((p: Process) => p.id === data.project.default_process_id) || data.processes[0]
          : data.processes[0];
        api.startProcess(firstProc.id).then(() => {
          setOpenLogs((prev) => ({ ...prev, [firstProc.id]: true }));
          load(); // reload to get running status
        }).catch(() => {});
      }

      // Auto-open log for running processes
      const running = data.processes.filter((p: Process) => p.status === 'running');
      if (running.length > 0) {
        const logState: Record<number, boolean> = {};
        running.forEach((p: Process) => { logState[p.id] = true; });
        setOpenLogs((prev) => ({ ...prev, ...logState }));

        running.forEach((p: Process) => {
          api.getLogs(p.id).then((logData) => {
            const all = logData.lines.map(l => l.t).join('');
            setLogs((prev2) => ({ ...prev2, [p.id]: all || 'Waiting for output...' }));
          });
        });
      }

      // Load project tasks from all sibling projects
      const projectIds = [data.project.id, ...(data.siblings || []).map((s: any) => s.id)];
      const uniqueIds = [...new Set(projectIds)];
      Promise.all([
        ...uniqueIds.map(pid => tasksApi.list({ project_id: pid, status: 'todo' })),
        ...uniqueIds.map(pid => tasksApi.list({ project_id: pid, status: 'in_progress' })),
      ]).then((results) => {
        const all = results.flatMap(r => r.tasks).slice(0, 10);
        setProjectTasks(all);
        // Load task statuses
        taskStatusesApi.list().then(d => setTaskStatuses(d.statuses)).catch(() => {});
      }).catch(() => {});

      // Load RC history & templates (only for flutter projects)
      if (data.project.type === 'flutter') {
        fetch('/api/remote-config-history/16')
          .then(r => r.json())
          .then(d => setRcHistory(d.history || []))
          .catch(() => {});
        fetch('/api/remote-config/templates/16')
          .then(r => r.json())
          .then(d => setRcTemplates(d.templates || []))
          .catch(() => {});
      }
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load])  // Poll logs for open panels
  useEffect(() => {
    const interval = setInterval(() => {
      const openIds = Object.entries(openLogs)
        .filter(([, v]) => v)
        .map(([k]) => parseInt(k));

      if (openIds.length === 0) return;

      openIds.forEach((pid) => {
        api.getLogs(pid).then((data) => {
          const all = data.lines.map(l => l.t).join('');
          setLogs((prev) => ({
            ...prev,
            [pid]: all || (prev[pid] === undefined ? 'Waiting for output...' : ''),
          }));
          // Sync process status from log endpoint
          if (data.status) {
            setProcesses((prev) =>
              prev.map((p) => (p.id === pid ? { ...p, status: data.status as 'running' | 'stopped' | 'error' } : p))
            );
          }
        });
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [openLogs]);

  // Auto-set default title/message based on RC mode (skip 'custom' — user fills manually)
  useEffect(() => {
    if (rcMode === 'custom') return;
    if (rcMode === 'force') {
      setRcTitle('Pembaruan wajib');
      setRcMessage('Silakan perbarui aplikasi Anda sekarang untuk melanjutkan.');
    } else {
      setRcTitle('Pembaruan tersedia');
      setRcMessage('Silakan perbarui aplikasi ke versi terbaru untuk pengalaman terbaik.');
    }
  }, [rcMode]);

  // Auto-fill template name & target version from last template
  useEffect(() => {
    if (rcTemplates.length > 0) {
      const envTemplates = rcTemplates.filter(t => t.env === rcEnv);
      if (envTemplates.length > 0) {
        const last = envTemplates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const version = last.target_version || last.android_latest || '';
        if (version && !rcTemplateName.startsWith('v')) {
          setRcTemplateName(`v${version}`);
        }
        if (version && !rcTargetVersion) {
          setRcTargetVersion(version);
        }
      }
    }
  }, [rcTemplates, rcEnv, envMeta]);

  // Reset form when environment tab changes
  useEffect(() => {
    setRcSyncData({ android: { min: '', latest: '' }, ios: { min: '', latest: '' } });
    setRcAndroidMinVersion('');
    setRcAndroidLatestVersion('');
    setRcIosMinVersion('');
    setRcIosLatestVersion('');
    setRcTemplateName('');
    setRcTargetVersion('');
    setRcTitle('');
    setRcMessage('');
    setRcMode('baseline');
    setRcResult('');
    setRcError('');
    // Auto-fetch sync for before values on cards
    fetch(`/api/remote-config/sync/16?env=${rcEnv}`).then(r => r.json()).then(syncData => {
      if (syncData.sync) {
        const vals = syncData.sync[rcEnv] || syncData.sync.dev || syncData.sync.prod;
        setRcSyncData({
          android: { min: vals.android_min || '', latest: vals.android_latest || '' },
          ios: { min: vals.ios_min || '', latest: vals.ios_latest || '' },
        });
      }
    }).catch(() => {});
  }, [rcEnv, envMeta]);

  // Auto-fill latest version dari min version (Android & iOS)
  useEffect(() => {
    if (rcAndroidMinVersion && (!rcAndroidLatestVersion || compareVersions(rcAndroidMinVersion, rcAndroidLatestVersion) > 0)) {
      setRcAndroidLatestVersion(rcAndroidMinVersion);
    }
  }, [rcAndroidMinVersion]);
  useEffect(() => {
    if (rcIosMinVersion && (!rcIosLatestVersion || compareVersions(rcIosMinVersion, rcIosLatestVersion) > 0)) {
      setRcIosLatestVersion(rcIosMinVersion);
    }
  }, [rcIosMinVersion]);

  const handleStart = async (procId: number) => {
    const updated = await api.startProcess(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    // Auto-open terminal log
    if (!openLogs[procId]) {
      setOpenLogs((prev) => ({ ...prev, [procId]: true }));
      api.getLogs(procId).then((data) => {
        const all = data.lines.map(l => l.t).join('');
        setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
      });
    }
  };

  const handleRestart = async (procId: number) => {
    await api.stopProcess(procId);
    await api.clearLogs(procId);
    await new Promise((r) => setTimeout(r, 300));
    const updated = await api.startProcess(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    // Auto-open terminal
    if (!openLogs[procId]) {
      setOpenLogs((prev) => ({ ...prev, [procId]: true }));
      api.getLogs(procId).then((data) => {
        const all = data.lines.map(l => l.t).join('');
        setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
      });
    }
  };

  const handleStop = async (procId: number) => {
    const updated = await api.stopProcess(procId);
    setProcesses((prev) => {
      const next = prev.map((p) => (p.id === procId ? updated : p));
      processesRef.current = next;
      return next;
    });
    toast('Process stopped');
  };

  const handleAdd = async () => {
    if (!label || !command || !id) return;
    try {
      const proc = await api.addProcess(parseInt(id), label, command, port);
      setProcesses((prev) => {
        const next = [...prev, proc];
        processesRef.current = next;
        return next;
      });
      setLabel('');
      setCommand('');
      setPort('');
      toast('Command added!');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleClone = async (procId: number) => {
    try {
      const proc = await api.cloneProcess(procId);
      setProcesses((prev) => {
        const next = [...prev, proc];
        processesRef.current = next;
        return next;
      });
      toast('Command cloned! 📑');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const handleSavePort = async (procId: number) => {
    const val = editPort[procId];
    try {
      const updated = await api.updateProcess(procId, { port: val || null });
      setProcesses((prev) => prev.map((p) => (p.id === procId ? { ...p, port: updated.port } : p)));
      setEditPort((prev) => {
        const next = { ...prev };
        delete next[procId];
        return next;
      });
      toast(val ? `Port set to ${val}` : 'Port removed');
    } catch (err: any) {
      toast(err.message);
    }
  };

  const toggleLog = (procId: number) => {
    setOpenLogs((prev) => {
      const next = { ...prev, [procId]: !prev[procId] };
      // Fetch log on open
      if (next[procId]) {
        api.getLogs(procId).then((data) => {
          const all = data.lines.map(l => l.t).join('');
          setLogs((prev2) => ({ ...prev2, [procId]: all || 'Waiting for output...' }));
        });
      }
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, procId: number) => {
    if (!canDrag.current) {
      e.preventDefault();
      return;
    }
    canDrag.current = false;
    dragItem.current = procId;
  };

  const handleDragOver = (e: React.DragEvent, procId: number) => {
    e.preventDefault();
    if (dragItem.current === null || dragItem.current === procId) return;

    const newList = [...processesRef.current];
    const fromIdx = newList.findIndex((p) => p.id === dragItem.current);
    const toIdx = newList.findIndex((p) => p.id === procId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = newList.splice(fromIdx, 1);
    newList.splice(toIdx, 0, moved);
    processesRef.current = newList;
    setProcesses(newList);
  };

  const handleDragEnd = async () => {
    if (dragItem.current === null || !id) return;
    const order = processesRef.current.map((p) => p.id).join(',');
    await api.reorder(parseInt(id), order);
    dragItem.current = null;
  };

  const handleAndroidMinChange = (val: string) => {
    setRcAndroidMinVersion(val);
    if (val) {
      setRcTitle('Pembaruan wajib');
    } else {
      setRcTitle('');
    }
  };
  const handleAndroidLatestChange = (val: string) => {
    setRcAndroidLatestVersion(val);
    if (val) setRcTitle('Pembaruan tersedia');
  };
  const handleIosMinChange = (val: string) => {
    setRcIosMinVersion(val);
    if (val) {
      setRcTitle('Pembaruan wajib');
    } else {
      setRcTitle('');
    }
  };
  const handleIosLatestChange = (val: string) => {
    setRcIosLatestVersion(val);
    if (val) setRcTitle('Pembaruan tersedia');
  };

  const handleRcSave = async () => {
    if (!validateVersions()) {
      setRcSaving(false);
      return;
    }

    // Cek apakah masih ada draft di env ini (skip kalo lagi edit template yang sama)
    if (!rcEditingId) {
      const existingDraft = rcTemplates.find(t => t.env === rcEnv && t.status === 'draft');
      if (existingDraft) {
        setRcError(`Masih ada draft "${existingDraft.name}" di env ${envMeta(rcEnv).label}. Publis atau hapus draft terlebih dahulu.`);
        setRcSaving(false);
        return;
      }
    }

    // Wajib sync dulu kalo versi masih kosong
    const hasVersion = rcMode === 'custom'
      ? (rcAndroidMinVersion || rcAndroidLatestVersion || rcIosMinVersion || rcIosLatestVersion)
      : !!rcTargetVersion;
    if (!hasVersion) {
      setRcError(`Silakan sync dari ${envMeta(rcEnv).url} terlebih dahulu untuk mendapatkan versi terbaru.`);
      setRcSaving(false);
      return;
    }

    // Update Message wajib diisi
    if (!rcMessage.trim()) {
      setRcError('Update Message wajib diisi — berikan informasi yang jelas untuk pengguna.');
      setRcSaving(false);
      return;
    }

    setRcSaving(true);
    setRcError('');
    setRcResult('');
    try {
      const body: any = {
        project_id: 16,
        name: rcTemplateName || `Template ${new Date().toLocaleString('id-ID')}`,
        mode: rcMode,
        env: rcEnv,
      };
      if (rcMode === 'optional' || rcMode === 'force') body.target_version = rcTargetVersion;
      if (rcMode === 'custom') {
        if (rcPlatform === 'android') {
          body.android_min = rcAndroidMinVersion;
          body.android_latest = rcAndroidLatestVersion;
        } else if (rcPlatform === 'ios') {
          body.ios_min = rcIosMinVersion;
          body.ios_latest = rcIosLatestVersion;
        } else {
          body.android_min = rcAndroidMinVersion;
          body.android_latest = rcAndroidLatestVersion;
          body.ios_min = rcIosMinVersion;
          body.ios_latest = rcIosLatestVersion;
        }
      }
      body.platform = rcPlatform;
      body.android_store_url = rcAndroidStoreUrl;
      body.ios_store_url = rcIosStoreUrl;
      body.update_title = rcTitle;
      body.update_message = rcMessage;

      const isEditing = rcEditingId !== null;
      const url = isEditing ? `/api/remote-config/template/${rcEditingId}` : '/api/remote-config/templates';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.template) {
        setRcResult(isEditing ? `✅ Template "${data.template.name}" berhasil diperbarui` : `✅ Template "${data.template.name}" berhasil disimpan`);
        // Reload templates
        fetch('/api/remote-config/templates/16').then(r => r.json()).then(d => setRcTemplates(d.templates || [])).catch(() => {});
        // Auto-sync for before values on card
        fetch(`/api/remote-config/sync/16?env=${rcEnv}`).then(r => r.json()).then(syncData => {
          if (syncData.sync) {
            const vals = syncData.sync[rcEnv] || syncData.sync.dev || syncData.sync.prod;
            setRcSyncData({
              android: { min: vals.android_min || '', latest: vals.android_latest || '' },
              ios: { min: vals.ios_min || '', latest: vals.ios_latest || '' },
            });
          }
        }).catch(() => {});
        // Reset form
        setRcTemplateName('');
        setRcTargetVersion('');
        setRcAndroidMinVersion('');
        setRcAndroidLatestVersion('');
        setRcIosMinVersion('');
        setRcIosLatestVersion('');
        setRcAndroidStoreUrl('https://play.google.com/store/apps/details?id=co.id.kibumn.tms.tenancy&hl=id');
        setRcIosStoreUrl('https://apps.apple.com/id/app/tenant-apps-kawasan-industri/id1671143383');
        setRcTitle('');
        setRcMessage('');
        setRcCustomVersionInput({});
        setRcVersionErrors({});
        setRcEditingId(null);
      } else {
        setRcError(data.error || 'Gagal menyimpan template');
      }
    } catch (err: any) {
      setRcError(err.message);
    } finally {
      setRcSaving(false);
    }
  };

  const handleRcSync = async () => {
    setRcSyncing(true);
    setRcError('');
    setRcResult('');
    try {
      const res = await fetch(`/api/remote-config/sync/16?env=${rcEnv}`);
      const data = await res.json();
      if (data.sync) {
        // Pick values based on current environment
        const vals = data.sync[rcEnv] || data.sync.dev || data.sync.prod;
        const syncAndroid = {
          min: vals.android_min || '',
          latest: vals.android_latest || '',
        };
        const syncIos = {
          min: vals.ios_min || '',
          latest: vals.ios_latest || '',
        };
        setRcSyncData({ android: syncAndroid, ios: syncIos });
        const curSync = rcPlatform === 'ios' ? syncIos : syncAndroid;
        setRcAndroidMinVersion(syncAndroid.min);
        setRcAndroidLatestVersion(syncAndroid.latest);
        setRcIosMinVersion(syncIos.min);
        setRcIosLatestVersion(syncIos.latest);
        if (vals.android_store_url) setRcAndroidStoreUrl(vals.android_store_url);
        if (vals.ios_store_url) setRcIosStoreUrl(vals.ios_store_url);
        setRcTitle('');
        setRcMessage('');

        // Set mode to 'custom' so all fields are visible after sync
        setRcMode('custom');
        // Fill target_version from version values
        if (curSync.latest) setRcTargetVersion(curSync.latest);
        // Auto-open Opsi tambahan modal
        const syncVersion = data.version || curSync.latest || '';
        setRcTemplateName(`v${syncVersion}`);
        setRcResult(`✅ Berhasil sync dari ${envMeta(rcEnv).url} (versi ${data.version || '?'}). Form sudah terisi.`);
      } else {
        setRcError(data.error || 'Gagal sync');
      }
    } catch (err: any) {
      setRcError(err.message);
    } finally {
      setRcSyncing(false);
    }
  };

  const handleRcPublish = async (templateId: number) => {
    setRcPublishing(templateId);
    setRcPublishResult(null);
    try {
      const res = await fetch(`/api/remote-config/template/${templateId}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      // Build proper error message from response
      let errMsg = '';
      if (data.error) {
        errMsg = data.error;
      } else if (data.backendResult?.error) {
        errMsg = 'Backend: ' + data.backendResult.error;
      } else if (!data.success) {
        errMsg = 'Gagal publish';
      }
      setRcPublishResult({
        id: templateId,
        success: data.success === true,
        stdout: JSON.stringify(data.config || {}, null, 2),
        stderr: errMsg,
        ...data,
      });
      // Reload templates & history
      fetch('/api/remote-config/templates/16').then(r => r.json()).then(d => setRcTemplates(d.templates || [])).catch(() => {});
      fetch('/api/remote-config-history/16').then(r => r.json()).then(d => setRcHistory(d.history || [])).catch(() => {});
    } catch (err: any) {
      setRcError(err.message);
    } finally {
      setRcPublishing(null);
    }
  };

  const handleRcReview = async (templateId: number) => {
    setRcReviewId(templateId);
    setRcReviewData(null);
    try {
      const [res, syncRes] = await Promise.all([
        fetch(`/api/remote-config/template/${templateId}`),
        fetch(`/api/remote-config/sync/16`),
      ]);
      const data = await res.json();
      const syncData = await syncRes.json().catch(() => ({ sync: {} }));
      if (data.template) {
        const params = data.template.params_json ? JSON.parse(data.template.params_json) : {};
        const env = data.template.env || 'prod';
        // Use sync data as before values (ground truth from Laravel backend)
        const envSync = syncData.sync?.[env] || {};
        const beforeConfig = {
          android_min: envSync.android_min || '',
          android_latest: envSync.android_latest || '',
          ios_min: envSync.ios_min || '',
          ios_latest: envSync.ios_latest || '',
        };
        setRcReviewData({ ...data.template, parsedParams: params, beforeConfig });
      }
    } catch (err: any) {
      setRcError(err.message);
      setRcReviewId(null);
    }
  };

  const handleRcDelete = async (templateId: number) => {
    if (!confirm('Hapus template ini?')) return;
    try {
      await fetch(`/api/remote-config/template/${templateId}`, { method: 'DELETE' });
      fetch('/api/remote-config/templates/16').then(r => r.json()).then(d => setRcTemplates(d.templates || [])).catch(() => {});
    } catch (err: any) {
      setRcError(err.message);
    }
  };

  const handleRcClone = async (template: any) => {
    // Fill form with template values
    setRcMode(template.mode);
    setRcEnv(template.env || 'prod');
    setRcTemplateName(template.name + ' (copy)');
    setRcTargetVersion(template.target_version || '');
    setRcPlatform(template.platform || 'both');
    setRcAndroidMinVersion(template.android_min || '');
    setRcAndroidLatestVersion(template.android_latest || '');
    setRcIosMinVersion(template.ios_min || '');
    setRcIosLatestVersion(template.ios_latest || '');
    setRcAndroidStoreUrl(template.android_store_url || '');
    setRcIosStoreUrl(template.ios_store_url || '');
    setRcTitle(template.update_title || '');
    setRcMessage(template.update_message || '');
  };

  const handleRcEdit = async (template: any) => {
    // Scroll ke form
    document.getElementById('rc-form')?.scrollIntoView({ behavior: 'smooth' });
    // Isi form dengan data template
    setRcEditingId(template.id);
    setRcMode(template.mode);
    setRcTemplateName(template.name || '');
    setRcTargetVersion(template.target_version || '');
    setRcPlatform(template.platform || 'both');
    setRcAndroidMinVersion(template.android_min || '');
    setRcAndroidLatestVersion(template.android_latest || '');
    setRcIosMinVersion(template.ios_min || '');
    setRcIosLatestVersion(template.ios_latest || '');
    setRcAndroidStoreUrl(template.android_store_url || 'https://play.google.com/store/apps/details?id=co.id.kibumn.tms.tenancy&hl=id');
    setRcIosStoreUrl(template.ios_store_url || 'https://apps.apple.com/id/app/tenant-apps-kawasan-industri/id1671143383');
    setRcTitle(template.update_title || '');
    setRcMessage(template.update_message || '');
    setRcError('');
    setRcResult('');
  };

  if (!project) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center gap-2 mt-1">
          <h2 className="text-2xl font-bold text-gray-800">{project.name}</h2>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <p className="text-gray-500">{project.path}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(project.path);
              toast('Path copied!');
            }}
            className="text-gray-400 hover:text-emerald-500 transition text-xs cursor-pointer"
            title="Copy path"
          >
            📋
          </button>
        </div>
        <Badge
          className={`mt-1 ${
            project.type === 'flutter'
              ? 'bg-blue-100 text-blue-700'
              : project.type === 'next'
                ? 'bg-gray-100 text-gray-700'
                : 'bg-orange-100 text-orange-700'
          }`}
        >
          {project.type.charAt(0).toUpperCase() + project.type.slice(1)}
        </Badge>
        {/* Sibling + Tab nav */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          {siblings.map((s) => (
            <a
              key={s.id}
              href={`/project/${s.id}`}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                s.is_active && activeTab !== 'tasks'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                style={{
                  backgroundColor:
                    s.type === 'flutter' ? '#3b82f6' :
                    s.type === 'laravel' ? '#f97316' :
                    s.type === 'next' ? '#6b7280' :
                    s.type === 'agent' ? '#8b5cf6' :
                    s.type === 'rust' ? '#ef4444' :
                    s.type === 'strapi' ? '#10b981' :
                    '#9ca3af'
                }}
              />
              {s.name.replace(/^.*\//, '')}
            </a>
          ))}
          <span className="w-px h-5 bg-gray-300 mx-1" />
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-3 py-1 rounded text-sm font-medium transition ${
              activeTab === 'tasks'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            📝 Tasks
            {projectTasks.length > 0 && (
              <span className="ml-1 text-xs opacity-80">({projectTasks.length})</span>
            )}
          </button>
          {project.type === 'flutter' && (
            <button
              onClick={() => setActiveTab('remote-config')}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                activeTab === 'remote-config'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ☁️ RC
            </button>
          )}
        </div>
      </div>

      {activeTab === 'commands' && (
        <>
          {project.type === 'flutter' && (
            <details className="group mb-6" open>
              <summary className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer hover:text-gray-800 py-1.5 select-none">
                <span className="transition-transform group-open:rotate-90 text-xs">▶</span>
                📱 ADB Devices
              </summary>
              <div className="mt-2">
                <AdbDevicePanel compact />
              </div>
            </details>
          )}

          {/* Add command */}
          <Card id="rc-form" className="mb-6">
            <CardContent className="p-4">
              <h3 className="font-semibold text-gray-700 mb-3">Tambah Command Baru</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Label (e.g., Custom Server)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Command (e.g., node server.js)"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Port"
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  style={{ width: '60px', minWidth: '60px' }}
                  type="text"
                  inputMode="numeric"
                />
                <button
                  onClick={handleAdd}
                  className="bg-emerald-500 text-white px-3 py-1 rounded text-sm hover:bg-emerald-600 whitespace-nowrap"
                >
                  Tambah
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Search & Commands header */}
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-700">Commands</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Cari command…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-6 pr-6 py-1 rounded border border-gray-300 focus:outline-none focus:border-emerald-400 w-48"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-400">↕ drag to sort</span>
            </div>
          </div>

          {processes.length === 0 ? (
            <p className="text-gray-400 text-sm">Belum ada command.</p>
          ) : (
            <div className="space-y-2">
              {processes
                .filter((proc) => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    proc.label.toLowerCase().includes(q) ||
                    proc.command.toLowerCase().includes(q) ||
                    (proc.port && String(proc.port).includes(q))
                  );
                })
                .map((proc) => (
                <Card
                  key={proc.id}
                  className="draggable"
                  draggable
                  onDragStart={(e) => handleDragStart(e, proc.id)}
                  onDragOver={(e) => handleDragOver(e, proc.id)}
                  onDragEnd={handleDragEnd}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (proc.id !== project.default_process_id) {
                            api.setDefaultProcess(project.id, proc.id).then(({ project: p }) => {
                              setProject(p);
                              toast('Default command set!');
                            }).catch((err: any) => toast(err.message));
                          }
                        }}
                        className={`text-sm transition cursor-pointer ${
                          proc.id === project.default_process_id
                            ? 'text-red-500 hover:text-red-400'
                            : 'text-gray-400 hover:text-red-400'
                        }`}
                        title={proc.id === project.default_process_id ? 'Default command' : 'Set as default'}
                      >
                        {proc.id === project.default_process_id ? '★' : '☆'}
                      </button>
                      <span
                        className="drag-handle cursor-grab text-gray-400 hover:text-gray-600 text-lg select-none"
                        onMouseDown={() => { canDrag.current = true; }}
                      >
                        ⠿
                      </span>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const fav = !proc.is_favorite;
                          await api.toggleProcessFavorite(proc.id, fav);
                          proc.is_favorite = fav;
                          // Re-sort: move favorites to top
                          const reSorted = [...processes].sort((a, b) => {
                            if (a.is_favorite && !b.is_favorite) return -1;
                            if (!a.is_favorite && b.is_favorite) return 1;
                            return (a.sort_order || 0) - (b.sort_order || 0);
                          });
                          setProcesses(reSorted);
                          processesRef.current = reSorted;
                          window.dispatchEvent(new Event('favorites-changed'));
                          toast(fav ? 'Pinned 📌' : 'Unpinned');
                        }}
                        className={`text-xs transition cursor-pointer ${
                          proc.is_favorite ? 'opacity-100' : 'opacity-30 hover:opacity-100'
                        }`}
                        title={proc.is_favorite ? 'Unpin command' : 'Pin command'}
                      >
                        📌
                      </button>
                      <div>
                        <p className="font-medium text-gray-800">
                          {proc.label}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs text-gray-500">{proc.command}</code>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const cmd = proc.command.replace(/{PORT}/g, proc.port ? String(proc.port) : '');
                              navigator.clipboard.writeText(cmd);
                              toast('Command copied!');
                            }}
                            className="text-gray-400 hover:text-emerald-500 transition text-xs cursor-pointer"
                            title="Copy command"
                          >
                            📋
                          </button>
                          {editPort[proc.id] !== undefined ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editPort[proc.id]}
                                onChange={(e) =>
                                  setEditPort((prev) => ({
                                    ...prev,
                                    [proc.id]: e.target.value.replace(/\D/g, '').slice(0, 5),
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSavePort(proc.id);
                                  if (e.key === 'Escape') {
                                    setEditPort((prev) => {
                                      const next = { ...prev };
                                      delete next[proc.id];
                                      return next;
                                    });
                                  }
                                }}
                                onBlur={() => handleSavePort(proc.id)}
                                className="w-16 text-xs px-1 py-0.5 rounded font-mono outline-none"
                                style={{
                                  background: '#0d1117',
                                  border: '1px solid #4ade80',
                                  color: '#4ade80',
                                }}
                                autoFocus
                              />
                            </span>
                          ) : (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditPort((prev) => ({
                                  ...prev,
                                  [proc.id]: proc.port ? String(proc.port) : '',
                                }));
                              }}
                              className="text-xs text-green-400 bg-gray-900 px-1.5 py-0.5 rounded font-mono cursor-pointer hover:bg-gray-800 transition"
                              title="Click to edit port"
                            >
                              {proc.port ? `:${proc.port}` : '+ port'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full inline-block ${
                            proc.status === 'running' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span
                          className={`text-sm font-medium ${
                            proc.status === 'running' ? 'text-green-600' : 'text-gray-600'
                          }`}
                        >
                          {proc.status.charAt(0).toUpperCase() + proc.status.slice(1)}
                        </span>
                        {proc.status === 'running' ? (
                          <>
                            <button
                              onClick={() => handleStop(proc.id)}
                              className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition"
                            >
                              Stop
                            </button>
                            <button
                              onClick={() => handleRestart(proc.id)}
                              className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-500 transition"
                            >
                              Restart
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleStart(proc.id)}
                            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition"
                          >
                            Start
                          </button>
                        )}
                        {proc.pid && (
                          <span className="text-xs text-gray-400">PID: {proc.pid}</span>
                        )}
                      </div>
                      <button
                        onClick={() => toggleLog(proc.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-1 transition"
                      >
                        📋
                      </button>
                      <button
                        onClick={() => handleClone(proc.id)}
                        className="text-xs text-gray-400 hover:text-emerald-500 px-1 transition"
                        title="Clone command (duplikat untuk device lain)"
                      >
                        📑
                      </button>
                    </div>
                  </div>

                  {/* Log panel */}
                  {openLogs[proc.id] && (
                    <div className="border-t border-gray-200 p-3">
                      <ProcessLogPanel
                        processId={proc.id}
                        log={logs[proc.id] || ''}
                        projectType={project.type}
                        onSend={(pid, val) => api.sendInput(pid, val).catch(() => {})}
                        onCopyAll={() => {
                          navigator.clipboard.writeText(logs[proc.id] || '');
                          toast('Full log copied!');
                        }}

                        onClear={() => {
                          setLogs((prev) => ({ ...prev, [proc.id]: '' }));
                          api.clearLogs(proc.id).catch(() => {});
                          toast('Terminal cleared!');
                        }}
                        onOpenDevTools={async (pid) => {
                          // Step 1: Send 'v' ke Flutter process untuk trigger DevTools URL
                          try {
                            await api.sendInput(pid, 'v');
                          } catch {}
                          // Step 2: Poll log setiap 1 detik hingga maks 10 detik
                          const timeout = 10000;
                          const interval = 1000;
                          let waited = 0;
                          let foundUrl = null;
                          while (waited < timeout) {
                            await new Promise(r => setTimeout(r, interval));
                            waited += interval;
                            try {
                              const logData = await api.getLogs(pid);
                              const logText = logData.lines.map(l => l.t).join('');
                              // Update local logs state biar terminal di UI ke-refresh
                              setLogs((prev) => ({ ...prev, [pid]: logText || 'Waiting for output...' }));
                              // Cari DevTools URL (format Flutter: http://.../devtools/?uri=ws:...)
                              const devToolsMatch = logText.match(/https?:\/\/[^\s]+\/devtools\/\?uri=ws:[^\s]+/);
                              if (devToolsMatch) {
                                foundUrl = devToolsMatch[0];
                                break;
                              }
                              // Fallback: cari VM Service / Observatory URL
                              const vmMatch = logText.match(/https?:\/\/127\.0\.0\.1:\d+\/[^\s/]+\//);
                              if (vmMatch) {
                                foundUrl = vmMatch[0];
                                break;
                              }
                            } catch {}
                          }
                          if (foundUrl) {
                            // Flutter sudah membuka browser sendiri saat menerima 'v'.
                            // Jadi tidak perlu window.open() lagi — cukup toast sebagai feedback.
                            toast('🔧 DevTools terbuka di browser...');
                          } else {
                            toast('⚠️ DevTools URL belum muncul. Coba lagi nanti setelah Flutter selesai build.');
                          }
                        }}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Tasks</h3>
            <button
              onClick={() => {
                setNewTaskTitle('');
                setNewTaskPriority('medium');
                setNewTaskDueDate('');
                setShowAddTask(true);
              }}
              className="text-sm bg-emerald-600 text-white px-4 py-1.5 rounded-lg hover:bg-emerald-500 transition"
            >
              + Add Task
            </button>
          </div>

          {showAddTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddTask(false)}>
              <div className="bg-[#161b22] border border-gray-700/60 rounded-xl shadow-2xl p-5 w-[380px]" onClick={e => e.stopPropagation()}>
                <h3 className="text-sm font-semibold text-gray-200 mb-4">New Task</h3>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('save-task-btn')?.click()}
                  placeholder="Task title…"
                  className="w-full bg-[#0d1117] text-white text-sm px-3 py-2 rounded border border-gray-700 outline-none focus:border-emerald-500/50 mb-3"
                />
                <div className="flex gap-2 mb-3">
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                    className="flex-1 bg-[#0d1117] text-gray-300 text-xs px-2 py-2 rounded border border-gray-700 outline-none focus:border-emerald-500/50"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <DatePicker value={newTaskDueDate} onChange={setNewTaskDueDate} />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddTask(false)} className="text-sm text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-800 transition">Cancel</button>
                  <button
                    id="save-task-btn"
                    onClick={async () => {
                      if (!newTaskTitle.trim()) return;
                      try {
                        const task = await tasksApi.create({ title: newTaskTitle.trim(), project_id: project.id, priority: newTaskPriority, due_date: newTaskDueDate || null });
                        setProjectTasks(prev => [task, ...prev]);
                        setShowAddTask(false);
                        toast('Task added');
                      } catch {}
                    }}
                    className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition"
                  >Save</button>
                </div>
              </div>
            </div>
          )}

          {projectTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No ongoing tasks.</p>
          ) : (
            <KanbanBoard
              tasks={projectTasks}
              statuses={taskStatuses}
              onStatusChange={async (taskId, newStatus) => {
                setProjectTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
                try {
                  const updated = await tasksApi.update(taskId, { status: newStatus });
                  setProjectTasks(prev => prev.map(t => t.id === taskId ? updated : t));
                } catch {
                  toast('Failed to update status');
                }
              }}
              onTaskClick={(task) => task.project_id && navigate(`/project/${task.project_id}`)}
              onUpdate={async (id, data) => {
                try {
                  const updated = await tasksApi.update(id, data);
                  setProjectTasks(prev => prev.map(t => t.id === id ? updated : t));
                  toast('Task updated');
                  return updated;
                } catch (e: any) {
                  toast(e.error || 'Failed to update');
                }
              }}
              onDelete={async (id) => {
                try {
                  await tasksApi.remove(id);
                  setProjectTasks(prev => prev.filter(t => t.id !== id));
                  toast('Task deleted');
                } catch {}
              }}
              onReorder={async (status, taskIds) => {
                try {
                  await tasksApi.reorder(status, taskIds);
                  setProjectTasks(prev => {
                    const other = prev.filter(t => t.status !== status);
                    const statusTasks = prev.filter(t => t.status === status);
                    const reordered = taskIds.map(id => statusTasks.find(t => t.id === id)!).filter(Boolean);
                    return [...other, ...reordered];
                  });
                } catch {}
              }}
            />
          )}
        </>
      )}

      {activeTab === 'remote-config' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-600">☁️ Remote Config</h3>
            <div className="flex gap-2">
              <button
                onClick={handleRcSync}
                disabled={rcSyncing}
                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {rcSyncing ? '⏳ Mengsync...' : '🔄 Sync dari ' + envMeta(rcEnv).url}
              </button>
              <button
                onClick={() => window.open('/remote-config', '_blank')}
                className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition"
              >
                🔄 Buka Halaman Penuh
              </button>
            </div>
          </div>

          {/* Form */}
          <Card>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Environment</label>
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setRcEnv('dev')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcEnv === 'dev' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🟡 Dev
                  </button>
                  <button
                    onClick={() => setRcEnv('dev-server')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcEnv === 'dev-server' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🟠 Dev Server
                  </button>
                  <button
                    onClick={() => setRcEnv('prod')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcEnv === 'prod' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🟢 Prod
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {envMeta(rcEnv).url}
                </p>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500">Nama Template</label>
                  <select
                    value={rcTemplateName.replace(/^v/, '') || ''}
                    disabled={!rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.min && !rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.latest}
                    onChange={e => {
                      const ver = e.target.value;
                      if (!ver) return;
                      if (ver === '__custom__') {
                        setRcCustomVersionInput(p => ({...p, ['_template']: true}));
                        return;
                      }
                      setRcTemplateName('v' + ver);
                      setRcTargetVersion(ver);
                    }}
                    className={`w-full mt-1 px-3 py-2 text-sm border rounded-lg ${!rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.min && !rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.latest ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                  >
                    {(!rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.min && !rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.latest) ? (
                      <option value="">🔄 Sync dulu</option>
                    ) : (
                      <>
                        <option value="" disabled>Pilih versi template</option>
                        {(() => {
                          const base = rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.latest || rcSyncData[rcPlatform === 'both' ? 'android' : rcPlatform as 'android' | 'ios']?.min || '';
                          const suggestions = getVersionSuggestions(base, 'target_version');
                          return (<>
                            <option value={base} disabled>── v{base} (saat ini)</option>
                            {suggestions.map(s => (
                              <option key={s.version} value={s.version}>v{s.version} ({s.label})</option>
                            ))}
                            <option value="__custom__">✏️ Kustom...</option>
                          </>);
                        })()}
                      </>
                    )}
                  </select>
                  {rcCustomVersionInput['_template'] && (
                    <div className="mt-1">
                      <input
                        value={rcTemplateName}
                        onChange={e => setRcTemplateName(e.target.value)}
                        placeholder="v2.0.4 - Force Update"
                        className="w-full px-3 py-2 text-sm border rounded-lg"
                      />
                      <button onClick={() => setRcCustomVersionInput(p => ({...p, ['_template']: false}))} className="text-xs text-blue-500 mt-1">← Kembali ke pilihan</button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500">📱 Platform</label>
                <div className="flex rounded-lg border overflow-hidden mt-1">

                  <button
                    onClick={() => setRcPlatform('both')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcPlatform === 'both' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🤖📱 Both
                  </button>
                  <button
                    onClick={() => setRcPlatform('android')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcPlatform === 'android' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🤖 Android
                  </button>
                  <button
                    onClick={() => setRcPlatform('ios')}
                    className={`flex-1 py-2 text-sm font-medium transition ${rcPlatform === 'ios' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    📱 iOS
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500">Mode</label>
                  <select
                    value={rcMode}
                    onChange={e => setRcMode(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border rounded-lg bg-white"
                  >
                    <option value="baseline">📊 Baseline (tidak ada popup)</option>
                    <option value="optional">🟢 Optional</option>
                    <option value="force">🔴 Force</option>
                    <option value="custom">✏️ Custom</option>
                  </select>
                </div>
              </div>
              {/* Target version (optional/force) */}
              {(rcMode === 'optional' || rcMode === 'force') && (
                <VersionSelect
                  value={rcTargetVersion}
                  onChange={(val: string) => { setRcTargetVersion(val); if (val) setRcTitle('Pembaruan wajib'); else setRcTitle(''); }}
                  field="target_version"
                  baseSync={(rcSyncData[rcPlatform as keyof typeof rcSyncData] || rcSyncData.android).latest || (rcSyncData[rcPlatform as keyof typeof rcSyncData] || rcSyncData.android).min}
                  label={rcMode === 'optional' ? 'Versi target latest' : 'Versi target minimum/latest'}
                />
              )}

              {/* Custom versions */}
              {rcMode === 'custom' && rcPlatform === 'both' && (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase mt-2 mb-1">🤖 Android</div>
                  <div className="grid grid-cols-2 gap-3">
                    <VersionSelect value={rcAndroidMinVersion} onChange={handleAndroidMinChange} field="min_version" baseSync={rcSyncData.android.min} label="Min Version" />
                    <VersionSelect value={rcAndroidLatestVersion} onChange={handleAndroidLatestChange} field="latest_version" baseSync={rcSyncData.android.latest} label="Latest Version" />
                  </div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mt-2 mb-1">📱 iOS</div>
                  <div className="grid grid-cols-2 gap-3">
                    <VersionSelect value={rcIosMinVersion} onChange={handleIosMinChange} field="min_version" baseSync={rcSyncData.ios.min} label="Min Version" />
                    <VersionSelect value={rcIosLatestVersion} onChange={handleIosLatestChange} field="latest_version" baseSync={rcSyncData.ios.latest} label="Latest Version" />
                  </div>
                </>
              )}
              {rcMode === 'custom' && rcPlatform !== 'both' && (
                <div className="grid grid-cols-2 gap-3">
                  <VersionSelect value={rcPlatform === 'android' ? rcAndroidMinVersion : rcIosMinVersion} onChange={rcPlatform === 'android' ? handleAndroidMinChange : handleIosMinChange} field="min_version" baseSync={(rcSyncData[rcPlatform as keyof typeof rcSyncData] || rcSyncData.android).min} label="Min Version" />
                  <VersionSelect value={rcPlatform === 'android' ? rcAndroidLatestVersion : rcIosLatestVersion} onChange={rcPlatform === 'android' ? handleAndroidLatestChange : handleIosLatestChange} field="latest_version" baseSync={(rcSyncData[rcPlatform as keyof typeof rcSyncData] || rcSyncData.android).latest} label="Latest Version" />
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">📎 Opsi Tambahan</p>
                <div className="space-y-2">
                  {rcPlatform !== 'ios' && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">Android Store URL</label>
                      <p className="w-full mt-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg break-all">{rcAndroidStoreUrl}</p>
                    </div>
                  )}
                  {rcPlatform !== 'android' && (
                    <div>
                      <label className="text-xs font-medium text-gray-500">iOS Store URL</label>
                      <p className="w-full mt-1 px-3 py-2 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg break-all">{rcIosStoreUrl}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-500">Update Title</label>
                    <textarea value={rcTitle} onChange={e => setRcTitle(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border rounded-lg" rows={2} placeholder="Pembaruan tersedia" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">Update Message <span className="text-red-500">*</span></label>
                    <textarea value={rcMessage} onChange={e => setRcMessage(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border rounded-lg" rows={3} required placeholder="Jelaskan perubahan di versi ini, misal: Perbaikan bug notifikasi, penambahan fitur laporan, dan peningkatan performa." />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {rcEditingId && (
                  <button
                    onClick={() => {
                      setRcEditingId(null);
                      setRcTemplateName('');
                      setRcTargetVersion('');
                      setRcAndroidMinVersion('');
                      setRcAndroidLatestVersion('');
                      setRcIosMinVersion('');
                      setRcIosLatestVersion('');
                      setRcAndroidStoreUrl('https://play.google.com/store/apps/details?id=co.id.kibumn.tms.tenancy&hl=id');
                      setRcIosStoreUrl('https://apps.apple.com/id/app/tenant-apps-kawasan-industri/id1671143383');
                      setRcTitle('');
                      setRcMessage('');
                      setRcCustomVersionInput({});
                      setRcVersionErrors({});
                      setRcError('');
                      setRcResult('');
                    }}
                    className="px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    ✕ Batal
                  </button>
                )}
                <button
                  onClick={handleRcSave}
                  disabled={rcSaving}
                  className="flex-1 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {rcSaving ? '⏳ Menyimpan...' : rcEditingId ? '✏️ Update Template' : '💾 Simpan Template'}
                </button>
              </div>
              {rcError && <p className="text-xs text-red-600">{rcError}</p>}
              {rcResult && (
                <div className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs font-mono max-h-20 overflow-y-auto whitespace-pre-wrap">
                  {rcResult}
                </div>
              )}
            </div>
          </Card>

          {/* Template List */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">📋 Template Tersimpan {envMeta(rcEnv).shortLabel} ({rcTemplates.filter(t => t.status === 'draft' && t.env === rcEnv).length}){(() => { const env = rcTemplates.filter(t => t.status === 'draft' && t.env === rcEnv); const both = env.filter(t => t.platform === 'both').length; const android = env.filter(t => t.platform === 'android').length; const ios = env.filter(t => t.platform === 'ios').length; return ' — 🤖📱 ' + both + ' / 🤖 ' + android + ' / 📱 ' + ios; })()}</h4>
            {rcTemplates.filter(t => t.status === 'draft' && t.env === rcEnv).length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada template draft untuk {envMeta(rcEnv).label}. Isi form di atas lalu klik Simpan Template.</p>
            ) : (
              <div className="space-y-2">
                {rcTemplates.filter(t => t.status === 'draft' && t.env === rcEnv).map((t: any) => {
                  const isPublishing = rcPublishing === t.id;
                  const isPublished = t.status === 'published';
                  let parsedParams: any = {};
                  try { parsedParams = t.params_json ? JSON.parse(t.params_json) : {}; } catch {}

                  return (
                    <Card key={t.id}>
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 truncate">{t.name}</span>
                              {(() => {
                                const p = t.platform || parsedParams.platform || 'both';
                                const badge = p === 'android' ? '🟢 Android' : p === 'ios' ? '🔵 iOS' : '⚪ Both';
                                const cls = p === 'android' ? 'bg-green-50 text-green-700' : p === 'ios' ? 'bg-blue-50 text-blue-700' : 'bg-gray-200 text-gray-700';
                                return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{badge}</span>;
                              })()}
                              {isPublished ? (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✅ Published</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">📝 Draft</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                t.mode === 'force' ? 'bg-red-100 text-red-700' :
                                t.mode === 'optional' ? 'bg-blue-100 text-blue-700' :
                                t.mode === 'baseline' ? 'bg-gray-100 text-gray-700' :
                                'bg-purple-100 text-purple-700'
                              }`}>{t.mode}</span>
                              <span>{new Date(t.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleRcReview(t.id)}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                            >
                              👁 Lihat
                            </button>
                            {!isPublished && (
                              <button
                                onClick={() => handleRcEdit(t)}
                                className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 transition"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            <button
                              onClick={() => handleRcClone(t)}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                            >
                              📋 Duplikat
                            </button>
                            {isPublished ? (
                              <span className="text-xs px-2 py-1 text-gray-400" title={`Published ${t.published_at ? new Date(t.published_at).toLocaleString('id-ID') : ''}`}>
                                ✅
                              </span>
                            ) : (
                              <button
                                onClick={() => handleRcPublish(t.id)}
                                disabled={isPublishing}
                                className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 disabled:opacity-50 transition"
                              >
                                {isPublishing ? '⏳...' : '🚀 Publish'}
                              </button>
                            )}
                            <button
                              onClick={() => handleRcDelete(t.id)}
                              className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition"
                            >
                              🗑
                            </button>
                          </div>
                        </div>

                        {/* Before → After diff row */}
                        {(() => {
                          const sd = rcSyncData;
                          if (!sd) return null;
                          const p = t.platform || parsedParams.platform || 'both';
                          const changes: { label: string; before: string; after: string }[] = [];
                          if (p === 'both' || p === 'android') {
                            if (t.android_min && t.android_min !== sd.android.min) changes.push({ label: 'Android Min', before: sd.android.min || '—', after: t.android_min });
                            if (t.android_latest && t.android_latest !== sd.android.latest) changes.push({ label: 'Android Lts', before: sd.android.latest || '—', after: t.android_latest });
                          }
                          if (p === 'both' || p === 'ios') {
                            if (t.ios_min && t.ios_min !== sd.ios.min) changes.push({ label: 'iOS Min', before: sd.ios.min || '—', after: t.ios_min });
                            if (t.ios_latest && t.ios_latest !== sd.ios.latest) changes.push({ label: 'iOS Lts', before: sd.ios.latest || '—', after: t.ios_latest });
                          }
                          if (changes.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 text-xs">
                              {changes.map((c, i) => (
                                <span key={i} className="text-gray-400">
                                  {c.label}: <span className="line-through text-gray-400">{c.before}</span>
                                  <span className="text-gray-300 mx-0.5">→</span>
                                  <span className="text-emerald-600 font-medium">{c.after}</span>
                                </span>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Show publish result log */}
                        {rcPublishResult && rcPublishResult.id === t.id && (
                          <div className="mt-2">
                            <div className="bg-gray-900 text-green-400 rounded p-2 text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {rcPublishResult.stdout || ''}
                              {rcPublishResult.stderr && (
                                <span className="text-red-400">{rcPublishResult.stderr}</span>
                              )}
                            </div>
                            {rcPublishResult.success ? (
                              <p className="text-xs text-emerald-600 mt-1">✅ Berhasil dipublish ke Firebase</p>
                            ) : (
                              <p className="text-xs text-red-600 mt-1">❌ Gagal: {rcPublishResult.stderr?.slice(0, 200)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

        {/* Review Modal */}
          {rcReviewId !== null && rcReviewData && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setRcReviewId(null)}>
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-lg">👁 Review Template</h3>
                  <button onClick={() => setRcReviewId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <span className="text-xs text-gray-400 block">Nama</span>
                    <span className="text-sm font-medium text-gray-800">{rcReviewData.name}</span>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-xs text-gray-400 block">Mode</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                        rcReviewData.mode === 'force' ? 'bg-red-100 text-red-700' :
                        rcReviewData.mode === 'optional' ? 'bg-blue-100 text-blue-700' :
                        rcReviewData.mode === 'baseline' ? 'bg-gray-100 text-gray-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>{rcReviewData.mode}</span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Status</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${
                        rcReviewData.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{rcReviewData.status === 'published' ? '✅ Published' : '📝 Draft'}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">📄 Parameter</h4>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                      {Object.entries(rcReviewData.parsedParams || {}).map(([key, val]: any) => (
                        <div key={key} className="flex items-baseline gap-3 text-sm">
                          <span className="text-gray-500 font-mono min-w-[120px]">{key}</span>
                          <span className="text-gray-800 font-mono break-all">{String(val) || <span className="text-gray-400">—</span>}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {rcReviewData.target_version && (
                    <div>
                      <span className="text-xs text-gray-400 block">Target Version</span>
                      <span className="text-sm font-mono">{rcReviewData.target_version}</span>
                    </div>
                  )}

                  {(rcReviewData.android_min || rcReviewData.android_latest || rcReviewData.ios_min || rcReviewData.ios_latest) && (
                    <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4">
                      {(rcReviewData.platform !== 'ios') && rcReviewData.android_min && <div className="bg-white rounded-lg p-3 border border-gray-100"><span className="text-xs text-gray-400 block mb-0.5">Android Min</span><span className="text-base font-mono font-semibold text-gray-800">{rcReviewData.android_min}</span></div>}
                      {(rcReviewData.platform !== 'ios') && rcReviewData.android_latest && <div className="bg-white rounded-lg p-3 border border-gray-100"><span className="text-xs text-gray-400 block mb-0.5">Android Latest</span><span className="text-base font-mono font-semibold text-gray-800">{rcReviewData.android_latest}</span></div>}
                      {(rcReviewData.platform !== 'android') && rcReviewData.ios_min && <div className="bg-white rounded-lg p-3 border border-gray-100"><span className="text-xs text-gray-400 block mb-0.5">iOS Min</span><span className="text-base font-mono font-semibold text-gray-800">{rcReviewData.ios_min}</span></div>}
                      {(rcReviewData.platform !== 'android') && rcReviewData.ios_latest && <div className="bg-white rounded-lg p-3 border border-gray-100"><span className="text-xs text-gray-400 block mb-0.5">iOS Latest</span><span className="text-base font-mono font-semibold text-gray-800">{rcReviewData.ios_latest}</span></div>}
                    </div>
                  )}

                  {rcReviewData.beforeConfig && (() => {
                    const bc = rcReviewData.beforeConfig;
                    const hasBefore = bc.android_min || bc.android_latest || bc.ios_min || bc.ios_latest;
                    if (!hasBefore) return null;
                    const platform = rcReviewData.platform || 'both';
                    return (
                      <div className="border-t pt-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">🔄 Before → After</h4>
                        <div className="bg-amber-50 rounded-xl p-4 text-sm space-y-2">
                          {(platform === 'both' || platform === 'android') && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 w-16">Android Min:</span>
                                <span className={`${bc.android_min && bc.android_min !== (rcReviewData.android_min || '') ? 'text-gray-500 line-through' : 'text-gray-400'}`}>{bc.android_min || '—'}</span>
                                {bc.android_min && bc.android_min !== (rcReviewData.android_min || '') && <span className="text-gray-300">→</span>}
                                {bc.android_min && bc.android_min !== (rcReviewData.android_min || '') && <span className="font-medium text-emerald-700">{rcReviewData.android_min || '—'}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 w-16">Android Lts:</span>
                                <span className={`${bc.android_latest && bc.android_latest !== (rcReviewData.android_latest || '') ? 'text-gray-500 line-through' : 'text-gray-400'}`}>{bc.android_latest || '—'}</span>
                                {bc.android_latest && bc.android_latest !== (rcReviewData.android_latest || '') && <span className="text-gray-300">→</span>}
                                {bc.android_latest && bc.android_latest !== (rcReviewData.android_latest || '') && <span className="font-medium text-emerald-700">{rcReviewData.android_latest || '—'}</span>}
                              </div>
                            </>
                          )}
                          {(platform === 'both' || platform === 'ios') && (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 w-16">iOS Min:</span>
                                <span className={`${bc.ios_min && bc.ios_min !== (rcReviewData.ios_min || '') ? 'text-gray-500 line-through' : 'text-gray-400'}`}>{bc.ios_min || '—'}</span>
                                {bc.ios_min && bc.ios_min !== (rcReviewData.ios_min || '') && <span className="text-gray-300">→</span>}
                                {bc.ios_min && bc.ios_min !== (rcReviewData.ios_min || '') && <span className="font-medium text-emerald-700">{rcReviewData.ios_min || '—'}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400 w-16">iOS Lts:</span>
                                <span className={`${bc.ios_latest && bc.ios_latest !== (rcReviewData.ios_latest || '') ? 'text-gray-500 line-through' : 'text-gray-400'}`}>{bc.ios_latest || '—'}</span>
                                {bc.ios_latest && bc.ios_latest !== (rcReviewData.ios_latest || '') && <span className="text-gray-300">→</span>}
                                {bc.ios_latest && bc.ios_latest !== (rcReviewData.ios_latest || '') && <span className="font-medium text-emerald-700">{rcReviewData.ios_latest || '—'}</span>}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {(rcReviewData.android_store_url || rcReviewData.ios_store_url) && (
                    <div className="border-t pt-4 space-y-1">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">📍 Store URLs</h4>
                      {rcReviewData.android_store_url && <div className="p-2.5"><span className="text-xs text-gray-400 block mb-0.5">Android</span><span className="text-xs font-mono text-blue-600 break-all leading-relaxed">{rcReviewData.android_store_url}</span></div>}
                      {rcReviewData.ios_store_url && <div className="p-2.5"><span className="text-xs text-gray-400 block mb-0.5">iOS</span><span className="text-xs font-mono text-blue-600 break-all leading-relaxed">{rcReviewData.ios_store_url}</span></div>}
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-3">
                    {rcReviewData.update_title && <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-400 block mb-1">Update Title</span><span className="text-sm font-medium">{rcReviewData.update_title}</span></div>}
                    {rcReviewData.update_message && <div className="bg-gray-50 rounded-lg p-3"><span className="text-xs text-gray-400 block mb-1">Update Message</span><span className="text-sm">{rcReviewData.update_message}</span></div>}
                  </div>

                  <div className="border-t pt-4 flex gap-3">
                    {rcReviewData.status !== 'published' && (
                      <button
                        onClick={() => { setRcReviewId(null); handleRcPublish(rcReviewData.id); }}
                        className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 transition"
                      >
                        🚀 Publish ke Firebase
                      </button>
                    )}
                    <button
                      onClick={() => { handleRcClone(rcReviewData); setRcReviewId(null); }}
                      className="flex-1 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                    >
                      📋 Duplikat & Edit
                    </button>
                    <button
                      onClick={() => setRcReviewId(null)}
                      className="py-2.5 px-5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Riwayat */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">📜 Riwayat Publikasi {envMeta(rcEnv).shortLabel}</h4>
            {(() => {
              const filteredHistory = rcHistory.filter(h => (h.env || 'prod') === rcEnv);
              if (filteredHistory.length === 0) {
                return <p className="text-xs text-gray-400">Belum ada riwayat publikasi untuk {envMeta(rcEnv).label}.</p>;
              }
              return (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-gray-400">
                      <th className="py-1.5 pr-2">Waktu</th>
                      <th className="py-1.5 pr-2">Template</th>
                      <th className="py-1.5 pr-2">Mode</th>
                      <th className="py-1.5 pr-2">Android</th>
                      <th className="py-1.5 pr-2">iOS</th>
                      <th className="py-1.5 pr-2">Before</th>
                      <th className="py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, 10).map((h: any) => (
                      <tr key={h.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2 font-mono whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-1.5 pr-2 font-mono text-gray-600">
                          {h.template_name || '-'}
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            h.mode === 'force' ? 'bg-red-100 text-red-700' :
                            h.mode === 'optional' ? 'bg-blue-100 text-blue-700' :
                            h.mode === 'baseline' ? 'bg-gray-100 text-gray-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {h.mode}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 font-mono">
                          {h.android_min || '?'}
                          {h.android_latest && h.android_latest !== h.android_min && (
                            <span className="text-gray-400"> → {h.android_latest}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 font-mono">
                          {h.ios_min || '?'}
                          {h.ios_latest && h.ios_latest !== h.ios_min && (
                            <span className="text-gray-400"> → {h.ios_latest}</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 font-mono text-gray-400">
                          {(() => {
                            const bAnd = h.before_android_min || h.before_android_latest;
                            const bIos = h.before_ios_min || h.before_ios_latest;
                            if (!bAnd && !bIos) return <span className="text-gray-300">—</span>;
                            const parts = [];
                            if (bAnd) parts.push(<span key="a"><span className="text-gray-400">A:</span> <span className="text-gray-500">{bAnd}</span></span>);
                            if (bIos) parts.push(<span key="i" className="ml-1"><span className="text-gray-400">I:</span> <span className="text-gray-500">{bIos}</span></span>);
                            return <span>{parts}</span>;
                          })()}
                        </td>
                        <td className="py-1.5">
                          {h.status === 'success' ? '✅' : '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );})()}
          </div>
        </div>
      )}

    </div>
  );
}

import { useEffect, useState, useRef } from 'react';

interface MediaItem {
  id: number;
  project_id: number | null;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

interface Project {
  projectId: number;
  name: string;
}

interface Folder {
  projectId: number | null;
  name: string;
  count: number;
}

const viewableTypes = ['application/pdf', 'text/plain', 'text/html', 'text/csv', 'image/svg+xml'];
const isViewable = (mime: string) => mime.startsWith('image/') || viewableTypes.includes(mime);

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectLookup, setProjectLookup] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState<number | null>(null);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copyId, setCopyId] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [dimsMap, setDimsMap] = useState<Record<number, { w: number; h: number }>>({});
  const [currentFolder, setCurrentFolder] = useState<number | null | 'common'>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [mediaRes, projRes] = await Promise.all([
        fetch('/api/media').then(r => r.json()),
        fetch('/api/projects?grouped=true').then(r => r.json()),
      ]);
      const allItems: MediaItem[] = mediaRes.items || [];
      setItems(allItems);
      const roots: Project[] = projRes.roots || [];
      setProjects(roots);

      // Build lookup
      const lookup: Record<number, string> = {};
      roots.forEach((r: Project) => { lookup[r.projectId] = r.name; });
      // Also get from full project list for more names
      const allProjs = projRes.projects || [];
      allProjs.forEach((p: any) => { lookup[p.id] = p.group_name || p.name.split('/').pop() || p.name; });
      setProjectLookup(lookup);

      // Build folder list
      const folderMap: Record<string, Folder> = {};
      allItems.forEach((item: MediaItem) => {
        const key = item.project_id ? String(item.project_id) : 'common';
        if (!folderMap[key]) {
          const projName = item.project_id ? (lookup[item.project_id] || `Project ${item.project_id}`) : 'Common';
          folderMap[key] = { projectId: item.project_id, name: projName, count: 0 };
        }
        folderMap[key].count++;
      });
      const folderList = Object.values(folderMap);
      // Sort: common first, then by name
      folderList.sort((a, b) => {
        if (a.projectId === null) return -1;
        if (b.projectId === null) return 1;
        return a.name.localeCompare(b.name);
      });
      setFolders(folderList);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Attach native drag/drop listeners to drop zone (more reliable for Finder drag)
  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';
      console.log('[Drag] dragover', e.type);
      setDragOver(true);
    };
    const onDragLeave = () => {
      console.log('[Drag] dragleave');
      setDragOver(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const newFiles: File[] = [];
      for (let i = 0; i < files.length; i++) {
        newFiles.push(files[i]);
      }

      setDroppedFiles(prev => [...prev, ...newFiles]);
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);

    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
    };
  }, [showUploadModal]);

  const filteredItems = currentFolder === null
    ? []
    : currentFolder === 'common'
      ? items.filter(i => i.project_id === null)
      : items.filter(i => i.project_id === currentFolder);

  const openUploadModal = () => {
    if (typeof currentFolder === 'number') {
      setUploadProjectId(currentFolder);
    } else {
      setUploadProjectId(null);
    }
    setDroppedFiles([]);
    setUploadProgress(0);
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    const files = droppedFiles;
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);
        if (uploadProjectId !== null) {
          formData.append('project_id', String(uploadProjectId));
        }
        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (res.ok && data.item) {
          setItems(prev => [data.item, ...prev]);
          successCount++;
        } else {
          console.warn('Upload failed:', files[i].name, data.error || 'Unknown error');
          failCount++;
        }
      } catch (err) {
        console.error('Upload error:', files[i].name, err);
        failCount++;
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setUploading(false);
    setShowUploadModal(false);
    setDroppedFiles([]);
    setUploadProgress(0);
    if (failCount > 0) {
      alert(`${successCount} succeeded, ${failCount} failed. Check console.`);
    }
    load();
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/media/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      load();
    } catch {}
  };

  const handleCopyUrl = (item: MediaItem) => {
    const url = `${window.location.origin}/uploads/${item.filename}`;
    navigator.clipboard.writeText(url);
    setCopyId(item.id);
    setTimeout(() => setCopyId(null), 2000);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} file(s)?`)) return;
    try {
      const res = await fetch('/api/media/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        load();
      }
    } catch {}
  };

  const handleBatchMove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setMoveTargetProjectId(currentFolder === 'common' ? null : typeof currentFolder === 'number' ? currentFolder : null);
    setShowMoveModal(true);
  };

  const confirmBatchMove = async () => {
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch('/api/media/batch-move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, project_id: moveTargetProjectId }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        setShowMoveModal(false);
        load();
      }
    } catch {}
  };

  const isImage = (mime: string) => mime.startsWith('image/');
  const getFolderName = (f: Folder) => f.projectId ? `${f.projectId} · ${f.name}` : '📁 Common';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-2xl">
          {currentFolder !== null && (
            <>
              <button onClick={() => setCurrentFolder(null)} className="text-gray-700 hover:text-emerald-400 transition text-sm font-medium">Media Library</button>
              <span className="text-gray-700 text-2xl">›</span>
            </>
          )}
          <h1 className="text-2xl font-bold text-gray-700">
            {currentFolder === null ? 'Media Library' : currentFolder === 'common' ? '📁 Common' : `📁 ${projectLookup[Number(currentFolder)] || `Project ${currentFolder}`}`}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openUploadModal}
            className="flex items-center gap-2 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Asset
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !uploading && setShowUploadModal(false)}>
          <div className="bg-[#161b22] border border-gray-700/60 rounded-xl shadow-2xl p-5 w-[480px]" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-gray-100 mb-4">Upload Asset</h2>

            <div className="mb-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-widest mb-1.5">Project</p>
              <select
                value={uploadProjectId ?? ''}
                onChange={e => setUploadProjectId(e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-[#0d1117] text-gray-300 text-sm px-3 py-2 rounded-lg border border-gray-700 outline-none focus:border-emerald-500/50"
              >
                <option value="">No project (root /uploads/)</option>
                {projects.map(p => (
                  <option key={p.projectId} value={p.projectId}>{p.projectId} · {p.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              {/* Drop zone */}
              <div
                ref={dropZoneRef}
                className={`relative border-2 border-dashed rounded-lg p-8 mb-3 text-center transition cursor-pointer ${
                  dragOver
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {droppedFiles.length > 0 ? (
                  <div className="text-left space-y-1">
                    <p className="text-sm text-emerald-400 font-medium mb-1">{droppedFiles.length} file(s) selected</p>
                    {droppedFiles.map((f, i) => (
                      <p key={i} className="text-xs text-gray-400 truncate">📄 {f.name}</p>
                    ))}
                    <button onClick={e => { e.stopPropagation(); setDroppedFiles([]); }} className="text-xs text-red-400 hover:text-red-300 mt-1">Clear all</button>
                  </div>
                ) : (
                  <>
                    <svg className="w-10 h-10 mx-auto mb-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-gray-400">Drop files here or click to browse</p>
                    <p className="text-xs text-gray-600 mt-1">File akan diupload ke server</p>
                  </>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const fileList = e.target.files;
                    if (!fileList) return;
                    const newFiles: File[] = [];
                    for (let i = 0; i < fileList.length; i++) {
                      newFiles.push(fileList[i]);
                    }
                    setDroppedFiles(prev => [...prev, ...newFiles]);
                    e.target.value = '';
                  }}
                />
              </div>

              {uploading && uploadProgress > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                    <span>Uploading... ({uploadProgress}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowUploadModal(false); setDroppedFiles([]); }}
                disabled={uploading}
                className="text-sm text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
              >Cancel</button>
              <button
                onClick={handleUpload}
                disabled={droppedFiles.length === 0 || uploading}
                className="flex items-center gap-2 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {uploading ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Uploading {uploadProgress}%</>
                ) : droppedFiles.length > 1 ? `Upload ${droppedFiles.length} Files` : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : currentFolder === null ? (
        /* Folder view */
        folders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No assets yet. Upload your first file!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {folders.map(f => (
              <div
                key={f.projectId ?? 'common'}
                onClick={() => setCurrentFolder(f.projectId ?? 'common')}
                className="group relative bg-[#161b22] border border-gray-700/30 rounded-xl overflow-hidden hover:border-emerald-500/40 transition cursor-pointer"
              >
                <div className="aspect-square flex items-center justify-center bg-[#0d1117]">
                  <svg className="w-16 h-16 text-gray-500 group-hover:text-emerald-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-200 truncate">{getFolderName(f)}</p>
                  <p className="text-xs text-gray-400 mt-1">{f.count} file{f.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* File view (inside a folder) */
        filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No files in this folder.</p>
          </div>
        ) : (
          <>
            {/* Select All bar */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredItems.map(i => i.id)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
                />
                {selectedIds.size > 0 ? <>{selectedIds.size} selected</> : 'Select All'}
              </label>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-500 hover:text-gray-400 transition">Clear</button>
              )}
            </div>
\
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredItems.map(item => (
              <div key={item.id} className={`group relative border rounded-xl overflow-hidden transition cursor-pointer ${selectedIds.has(item.id) ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-gray-700/30 hover:border-gray-600/50'}`}
                onClick={() => isImage(item.mime_type) ? setPreviewItem(item) : (() => {
                  if (isViewable(item.mime_type)) {
                    const a = document.createElement('a');
                    a.href = `/uploads/${item.filename}`;
                    a.target = '_blank';
                    a.click();
                  } else {
                    fetch(`/api/media/open/${item.id}`, { method: 'POST' }).catch(() => {});
                  }
                })()}
              >
                {/* Checkbox overlay */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={e => { e.stopPropagation(); toggleSelect(item.id); }}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer"
                  />
                </div>
                <div className="aspect-square flex items-center justify-center overflow-hidden bg-[#0d1117]">
                  {isImage(item.mime_type) ? (
                    <img
                      src={`/uploads/${item.filename}`}
                      alt={item.original_name}
                      className="w-full h-full object-contain"
                      onLoad={e => {
                        const img = e.target as HTMLImageElement;
                        if (img.naturalWidth) setDimsMap(prev => ({ ...prev, [item.id]: { w: img.naturalWidth, h: img.naturalHeight } }));
                      }}
                    />
                  ) : (
                    <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-300 truncate" title={item.original_name}>{item.original_name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{formatSize(item.size)}</p>
                  {dimsMap[item.id] && (
                    <p className="text-[10px] text-gray-500">{dimsMap[item.id].w} × {dimsMap[item.id].h} px</p>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); handleCopyUrl(item); }}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg transition ${copyId === item.id ? 'bg-emerald-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  >{copyId === item.id ? 'Copied!' : 'Copy URL'}</button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                  >Delete</button>
                </div>
              </div>
            ))}
            </div>
          </>
        )
      )}

      {/* Batch action bar */}
      {selectedIds.size > 0 && currentFolder !== null && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-4 p-4 bg-[#161b22] border-t border-gray-700/60">
          <span className="text-sm text-gray-400">{selectedIds.size} selected</span>
          <button onClick={handleBatchMove} className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition">Move to...</button>
          <button onClick={handleBatchDelete} className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-500 transition">Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-800 transition">Clear</button>
        </div>
      )}

      {/* Move modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={() => setShowMoveModal(false)}>
          <div className="bg-[#161b22] border border-gray-700/60 rounded-xl shadow-2xl p-5 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-100 mb-4">Move {selectedIds.size} file(s) to:</h3>
            <select
              value={moveTargetProjectId ?? ''}
              onChange={e => setMoveTargetProjectId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-[#0d1117] text-gray-300 text-sm px-3 py-2 rounded-lg border border-gray-700 outline-none focus:border-emerald-500/50 mb-4"
            >
              <option value="">Root /uploads/</option>
              {projects.map(p => (
                <option key={p.projectId} value={p.projectId}>{p.projectId} · {p.name}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMoveModal(false)} className="text-sm text-gray-400 px-4 py-2 rounded-lg hover:bg-gray-800 transition">Cancel</button>
              <button onClick={confirmBatchMove} className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-500 transition">Move</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => { setPreviewItem(null); setImageDims(null); }}>
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setPreviewItem(null); setImageDims(null); }}
              className="absolute -top-3 -right-3 z-10 bg-gray-900 text-gray-300 rounded-full w-8 h-8 flex items-center justify-center hover:text-white hover:bg-gray-700 transition shadow-lg border border-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {isImage(previewItem.mime_type) ? (
              <img
                src={`/uploads/${previewItem.filename}`}
                alt={previewItem.original_name}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                onLoad={e => setImageDims({ w: (e.target as HTMLImageElement).naturalWidth, h: (e.target as HTMLImageElement).naturalHeight })}
              />
            ) : (
              <div className="bg-gray-900 rounded-xl p-12 flex flex-col items-center gap-3 border border-gray-700">
                <svg className="w-20 h-20 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-gray-400 font-medium">{previewItem.original_name}</p>
                <p className="text-xs text-gray-500">{formatSize(previewItem.size)}</p>
              </div>
            )}
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-gray-900/90 backdrop-blur-sm rounded-lg px-4 py-2 border border-gray-700 whitespace-nowrap">
              <span className="text-sm text-gray-300 font-medium">{previewItem.original_name}</span>
              <span className="text-xs text-gray-500">{formatSize(previewItem.size)}</span>
              {imageDims && <span className="text-xs text-gray-500">{imageDims.w} × {imageDims.h} px</span>}
              <button
                onClick={e => { e.stopPropagation(); handleCopyUrl(previewItem); }}
                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition"
              >{copyId === previewItem.id ? 'Copied!' : 'Copy URL'}</button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(previewItem.id); setPreviewItem(null); }}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
              >Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

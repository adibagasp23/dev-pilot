# Tombol Restart Terminal di Monitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol Restart di kartu proses running pada halaman Monitor yang meniru perilaku tombol Restart di ProjectDetail (stop → clear log → jeda 300ms → start ulang).

**Architecture:** Perubahan frontend-only di `client/src/pages/Monitor.tsx`. Menambahkan fungsi `handleRestart` yang memanggil API yang sudah ada (`stopProcess`, `clearLogs`, `startProcess`), lalu menambahkan tombol Restart di samping tombol Stop. Proses tetap tampil di daftar (tidak dihapus).

**Tech Stack:** React 19, TypeScript strict, Vite, Tailwind 4.

## Global Constraints

- TypeScript strict (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`) — import tidak terpakai menyebabkan build gagal.
- Verifikasi dengan `cd client && npm run build` (tidak ada test framework di project).
- Format: Tailwind utility classes, bukan CSS-in-JS.
- Tombol Restart tanpa ikon (teks saja), konsisten dengan ProjectDetail.

---

### Task 1: Tambah handleRestart + tombol Restart di Monitor.tsx

**Files:**
- Modify: `client/src/pages/Monitor.tsx` (fungsi baru setelah `handleStop`; tombol baru setelah tombol Stop di header kartu running)

**Interfaces:**
- Consumes: `api.stopProcess(pid)`, `api.clearLogs(pid)`, `api.startProcess(pid)` (sudah ada di `client/src/api.ts`), `toast()` dari `../components/Snackbar`
- Produces: `handleRestart(pid: number)` — tidak dipakai komponen lain

- [ ] **Step 1: Tambah fungsi `handleRestart`** setelah fungsi `handleStop` (sekitar baris 75-84 di `Monitor.tsx`)

```ts
const handleRestart = async (pid: number) => {
  try {
    await api.stopProcess(pid);
    await api.clearLogs(pid);
    setLogs((prev) => ({ ...prev, [pid]: '' }));
    await new Promise((r) => setTimeout(r, 300));
    const updated = await api.startProcess(pid);
    setProcesses((prev) => prev.map((p) => (p.id === pid ? { ...p, ...updated } : p)));
    toast('Process restarted');
  } catch (err: any) {
    toast(`❌ ${err.message}`);
  }
};
```

- [ ] **Step 2: Tambah tombol Restart** di dalam `div className="flex gap-2"` pada header kartu proses running, tepat setelah tombol Stop

```jsx
<button
  onClick={() => handleRestart(proc.id)}
  className="text-xs bg-yellow-600 text-white px-2 py-0.5 rounded hover:bg-yellow-500 transition"
>
  Restart
</button>
```

- [ ] **Step 3: Verifikasi build**

Run: `cd client && npm run build`
Expected: sukses tanpa error TypeScript (tidak ada import baru, jadi tidak ada risiko unused import).

- [ ] **Step 4: Verifikasi manual**

1. Buka `http://localhost:5173/monitor` (Vite HMR otomatis ter-refresh).
2. Pastikan ada proses running; klik **Restart**.
3. Harapan: proses tetap tampil, log ter-clear ("Waiting for output..."), lalu output baru muncul kembali.

- [ ] **Step 5: Commit** (perlu konfirmasi user — skill konfirmasi-sebelum-push)

```bash
git add client/src/pages/Monitor.tsx docs/superpowers/specs/2026-08-03-restart-button-monitor-design.md docs/superpowers/plans/2026-08-03-restart-button-monitor.md
git commit -m "feat: tombol restart terminal di halaman Monitor"
```

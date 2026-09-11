# Tombol View (Copy Visible Log) di Monitor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan tombol 👁 View di kartu proses running pada halaman Monitor yang menyalin log terminal yang terlihat di layar (visible area), meniru `ProcessLogPanel.tsx` di ProjectDetail.

**Architecture:** Perubahan frontend-only di `client/src/pages/Monitor.tsx`. Menambahkan fungsi `handleCopyVisible(pid)` (algoritma sama persis dengan `ProcessLogPanel.tsx`) dan tombol 👁 View di samping tombol 📋 All.

**Tech Stack:** React 19, TypeScript strict, Vite, Tailwind 4.

## Global Constraints

- TypeScript strict — perhatikan tipe variabel lokal (gaya penulisan konsisten dengan `ProcessLogPanel.tsx`).
- Verifikasi dengan `cd client && npm run build` (tidak ada test framework).
- Tidak ada import baru (pakai `navigator.clipboard` + `toast` yang sudah ada).
- Gaya tombol sama dengan tombol `📋 All` di Monitor.

---

### Task 1: Tambah handleCopyVisible + tombol View di Monitor.tsx

**Files:**
- Modify: `client/src/pages/Monitor.tsx` (fungsi baru setelah `handleClear`; tombol baru sebelum tombol `📋 All`)

**Interfaces:**
- Consumes: `logs` state, `preRefs.current[pid]`, `toast()` (sudah ada)
- Produces: `handleCopyVisible(pid: number)` — tidak dipakai komponen lain

- [ ] **Step 1: Tambah fungsi `handleCopyVisible`** setelah fungsi `handleClear` (sekitar baris 122-125 di `Monitor.tsx`)

```ts
  const handleCopyVisible = (pid: number) => {
    const pre = preRefs.current[pid];
    const log = logs[pid] || '';
    if (!pre || !log) return;

    const lines = log.split('\n');
    const style = getComputedStyle(pre);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingTop = parseFloat(style.paddingTop) || 0;

    const scrollTop = pre.scrollTop;
    const clientHeight = pre.clientHeight;

    const firstLine = Math.max(0, Math.floor((scrollTop - paddingTop) / lineHeight));
    const lastLine = Math.min(lines.length, Math.ceil((scrollTop + clientHeight - paddingTop) / lineHeight));

    const visibleText = lines.slice(firstLine, lastLine).join('\n');
    navigator.clipboard.writeText(visibleText);
    toast('Visible log copied!');
  };
```

- [ ] **Step 2: Tambah tombol `👁 View`** di dalam `div className="flex gap-2"` header kartu running, tepat **sebelum** tombol `📋 All`

```jsx
                        <button
                          onClick={() => handleCopyVisible(proc.id)}
                          className="text-xs text-gray-500 hover:text-emerald-400 transition"
                          title="Copy visible area"
                        >
                          👁 View
                        </button>
```

- [ ] **Step 3: Verifikasi build**

Run: `cd client && npm run build`
Expected: sukses tanpa error TypeScript.

- [ ] **Step 4: Verifikasi manual**

1. Buka `http://localhost:5173/monitor` (HMR otomatis).
2. Scroll ke posisi tertentu di log terminal, klik **👁 View**, tempel ke editor.
3. Harapan: hanya baris yang terlihat di layar yang tersalin.

- [ ] **Step 5: Commit** (perlu konfirmasi user — skill konfirmasi-sebelum-push)

```bash
git add client/src/pages/Monitor.tsx docs/superpowers/specs/2026-08-03-view-copy-log-monitor-design.md docs/superpowers/plans/2026-08-03-view-copy-log-monitor.md
git commit -m "feat: tombol View (copy visible log) di halaman Monitor"
```

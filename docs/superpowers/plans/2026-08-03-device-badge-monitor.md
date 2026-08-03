# Badge Device di Kartu Terminal Monitor (Flutter) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menampilkan badge device (misal `📱 SM-A515F`) di header kartu terminal pada halaman Monitor untuk setiap proses Flutter yang sedang running, dideteksi dari parsing log output Flutter CLI.

**Architecture:** Parsing murni di frontend. Helper pure `getFlutterDevice(logText)` di file util baru mengekstrak nama device dari log (regex `Launching .+? on <device> in ... mode` → fallback `Syncing files to device <device>`, ambil match terakhir) dan memetakan ikon platform. Monitor.tsx memanggil helper tersebut saat render kartu dan menampilkan badge hanya untuk `project_type === 'flutter'`. Tidak ada perubahan backend/API/database.

**Tech Stack:** React 19, TypeScript 6 (strict), Vite 8, Node 24 (untuk unit test via `--experimental-strip-types`).

## Global Constraints

- Badge HANYA untuk proses dengan `project_type === 'flutter'`; proses lain tidak terpengaruh.
- Badge HANYA di tab **Running** pada `client/src/pages/Monitor.tsx` (bukan tab Recent, bukan halaman lain).
- Badge tidak dirender jika device tidak terdeteksi dari log (tanpa pesan error).
- Regex deteksi: primary `/Launching .+? on (.+?) in (debug|profile|release) mode/i`; fallback `/Syncing files to device (.+?)\./i`; ambil **match terakhir** dari primary, fallback hanya jika primary tidak ada match.
- Ikon device: `iphone|ipad|simulator` → 🍎; `macos` atau `linux|windows` → 🖥; `chrome|edge|safari` → 🌐; selain itu (default Android) → 📱.
- Posisi badge: di header kartu, tepat **sebelum badge port hijau** (jika ada), setelah elemen label.
- Styling badge: biru/sky cerah + glow, font-mono kecil — inline style, mengikuti pattern badge port yang sudah ada di Monitor.tsx (bukan CSS-in-JS class).
- TypeScript strict: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` — import tidak terpakai menyebabkan build error.
- Gate build: `cd client && npm run build` harus lulus.
- Emoji ikon device diizinkan di sini (spesifikasi yang disetujui user; halaman Monitor sudah memakai emoji).
- Commit per task WAJIB menunggu konfirmasi user (aturan global user).

---

### Task 1: Helper pure `getFlutterDevice` + unit test

**Files:**
- Create: `client/src/utils/flutterDevice.ts`
- Test: `client/tests/flutterDevice.test.ts` (di luar `src/` agar tidak ikut typecheck `tsc -b`, karena `tsconfig.app.json` memakai `types: ["vite/client"]` tanpa `node`)

**Interfaces:**
- Produces: `getFlutterDevice(logText: string): { device: string; icon: string } | null` dan interface `FlutterDeviceInfo` (device: string, icon: string) dari `client/src/utils/flutterDevice.ts`. Task 2 hanya memakai `getFlutterDevice`.

- [ ] **Step 1: Tulis test yang gagal**

Create `client/tests/flutterDevice.test.ts`:

```ts
import { strict as assert } from 'node:assert';
import { getFlutterDevice } from '../src/utils/flutterDevice.ts';

// Catatan: Node ESM membutuhkan ekstensi `.ts` eksplisit pada import saat
// dijalankan dengan `node --experimental-strip-types`.

// Primary regex — Android
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on SM-A515F in debug mode...'),
  { device: 'SM-A515F', icon: '📱' }
);

// Primary regex — iOS simulator
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on iPhone 15 Pro in debug mode...'),
  { device: 'iPhone 15 Pro', icon: '🍎' }
);

// Primary regex — entry file berbeda + web
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main_dev.dart on Chrome in debug mode...'),
  { device: 'Chrome', icon: '🌐' }
);

// Primary regex — macOS desktop
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on macOS in debug mode...'),
  { device: 'macOS', icon: '🖥' }
);

// Fallback regex (primary tidak ada)
assert.deepStrictEqual(
  getFlutterDevice('Syncing files to device Pixel 7...'),
  { device: 'Pixel 7', icon: '📱' }
);

// Match terakhir dari primary yang diambil
const multi =
  'Launching lib/main.dart on SM-A515F in debug mode...\n' +
  'Launching lib/main.dart on Pixel 7 in debug mode...';
assert.deepStrictEqual(getFlutterDevice(multi), { device: 'Pixel 7', icon: '📱' });

// Tidak ada match → null
assert.strictEqual(getFlutterDevice(''), null);
assert.strictEqual(getFlutterDevice('Flutter run key commands.'), null);

console.log('✅ Semua test lulus');
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run: `cd client && node --experimental-strip-types tests/flutterDevice.test.ts`
Expected: FAIL dengan error `Cannot find module '../src/utils/flutterDevice'` (modul belum ada).

- [ ] **Step 3: Implementasi minimal helper**

Create `client/src/utils/flutterDevice.ts`:

```ts
export interface FlutterDeviceInfo {
  device: string;
  icon: string;
}

export function getFlutterDevice(logText: string): FlutterDeviceInfo | null {
  if (!logText) return null;

  let device: string | null = null;
  let match: RegExpExecArray | null;

  // Primary: "Launching lib/main.dart on <device> in debug mode..."
  const launchRe = new RegExp('Launching .+? on (.+?) in (debug|profile|release) mode', 'gi');
  while ((match = launchRe.exec(logText)) !== null) {
    device = match[1].trim();
  }

  // Fallback: "Syncing files to device <device>..." (hanya jika primary tidak match)
  if (!device) {
    const syncRe = new RegExp('Syncing files to device (.+?)\\.', 'gi');
    while ((match = syncRe.exec(logText)) !== null) {
      device = match[1].trim();
    }
  }

  if (!device) return null;
  return { device, icon: deviceIcon(device) };
}

function deviceIcon(device: string): string {
  const d = device.toLowerCase();
  if (/iphone|ipad|simulator/.test(d)) return '🍎';
  if (d === 'macos' || /linux|windows/.test(d)) return '🖥';
  if (/chrome|edge|safari/.test(d)) return '🌐';
  return '📱';
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

Run: `cd client && node --experimental-strip-types tests/flutterDevice.test.ts`
Expected: PASS dengan output `✅ Semua test lulus`.

- [ ] **Step 5: Commit**

```bash
cd ~/process-manager
git add client/src/utils/flutterDevice.ts client/tests/flutterDevice.test.ts
git commit -m "feat: helper getFlutterDevice untuk deteksi device dari log Flutter"
```
(Minta konfirmasi user sebelum `git commit` — aturan global.)

---

### Task 2: Render badge device di header kartu Monitor

**Files:**
- Modify: `client/src/pages/Monitor.tsx`

**Interfaces:**
- Consumes: `getFlutterDevice(logText: string): { device: string; icon: string } | null` dari `@/utils/flutterDevice`.

- [ ] **Step 1: Tambah import**

Di `client/src/pages/Monitor.tsx`, tambahkan import berikut (gunakan alias `@/` yang sudah dipakai file ini, misal `import { api } from '@/api';`):

```ts
import { getFlutterDevice } from '@/utils/flutterDevice';
```

- [ ] **Step 2: Hitung deviceInfo per proses & render badge**

Ubah blok `{procs.map((proc) => ( ... ))}` di tab Running menjadi `{procs.map((proc) => { ... return ( ... ); })}`:

1. Di paling awal map (sebelum `return`), tambahkan:

```ts
{procs.map((proc) => {
  const deviceInfo =
    proc.project_type === 'flutter' ? getFlutterDevice(logs[proc.id] || '') : null;
  return (
```

2. Setelah elemen `<span className="text-sm text-gray-300">{proc.label}</span>` dan **sebelum** blok `{proc.port ? ( ... ) : null}`, sisipkan badge:

```tsx
{deviceInfo && (
  <span
    title={`Running on ${deviceInfo.device}`}
    className="text-xs font-mono px-1.5 py-0.5 rounded"
    style={{
      background: 'rgba(56, 189, 248, 0.15)',
      border: '1px solid #38bdf8',
      color: '#7dd3fc',
      boxShadow: '0 0 8px rgba(56, 189, 248, 0.35)',
    }}
  >
    {deviceInfo.icon} {deviceInfo.device}
  </span>
)}
```

3. Ubah penutup map dari `))}` menjadi `);\n})}` (atau bentuk yang sesuai dengan indentasi) agar map memakai body block.

- [ ] **Step 3: Build (typecheck strict) harus lulus**

Run: `cd client && npm run build`
Expected: SUCCESS — `tsc -b` tanpa error (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`).

Jika error, perbaiki hingga build lulus.

- [ ] **Step 4: Commit**

```bash
cd ~/process-manager
git add client/src/pages/Monitor.tsx
git commit -m "feat: badge device di header kartu terminal Monitor untuk proses Flutter"
```
(Minta konfirmasi user sebelum `git commit` — aturan global.)

---

## Final Verification

- [ ] `cd client && npm run build` → SUCCESS.
- [ ] Buka `http://localhost:5173/monitor` (dev server sudah jalan; jika belum, `cd ~/process-manager && npm run dev`):
  - Proses Flutter yang running → badge `📱 <device>` (atau ikon sesuai platform) tampil di header, sebelum badge port.
  - Proses non-Flutter (laravel/agent/next) → tidak ada badge.
  - Flutter yang masih build → badge belum muncul; setelah baris `Launching lib/main.dart on ...` tampil di log, badge muncul (polling log 2 detik).
  - Hot restart ke device lain → badge berubah mengikuti log terbaru.
- [ ] Jalankan unit test sekali lagi: `cd client && node --experimental-strip-types tests/flutterDevice.test.ts` → `✅ Semua test lulus`.

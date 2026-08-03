# Design: Badge Device di Kartu Terminal Monitor (Flutter)

Tanggal: 2026-08-03
Status: Disetujui user (brainstorming)

## Tujuan

Pada halaman Monitor (`/monitor`), untuk setiap proses **Flutter** yang sedang running,
tampilkan badge di header kartu terminal yang menunjukkan **device** tempat aplikasi
dijalankan (misal `SM-A515F`, `iPhone 15 Pro`, `macOS`, `Chrome`).

Tujuan utama: user langsung tahu "app ini running di device apa" tanpa perlu membuka
log dan mencari-cari baris `Launching lib/main.dart on ...`.

## Lingkup

- HANYA proses dengan `project_type === 'flutter'`.
- HANYA di tab **Running** pada halaman Monitor (`client/src/pages/Monitor.tsx`).
- Badge tidak muncul jika device tidak terdeteksi dari log.

## Pendekatan

Parsing **di frontend (React)** dari log yang sudah tersedia:

- Monitor sudah melakukan polling `api.getLogs(pid)` setiap 2 detik dan menyimpan hasilnya
  di state `logs: Record<number, string>`.
- Cukup parse `logs[proc.id]` dengan regex — tidak ada perubahan backend, route, atau types.

Alasan memilih frontend:
- Log sudah tersedia di frontend, hasil identik dengan parse di backend.
- Output Flutter CLI konsisten bentuknya, sehingga regex sederhana cukup andal.
- Perubahan paling kecil dan cepat; badge otomatis update saat log bertambah
  (termasuk jika di-hot-restart ke device lain, karena membaca baris terbaru).

## Deteksi Device

Regex dijalankan pada seluruh teks log (`logs[proc.id]`), ambil match **terakhir**
yang ditemukan (agar mencerminkan device terbaru):

1. Primary: `/Launching .+? on (.+?) in (debug|profile|release) mode/i`
   - Pola `. +?` dipakai karena entry file bisa berbeda (misal `lib/main_dev.dart`),
     bukan hanya `lib/main.dart`.
   - contoh: `Launching lib/main.dart on SM-A515F in debug mode...` → `SM-A515F`
2. Fallback: `/Syncing files to device (.+?)\./`
   - contoh: `Syncing files to device Pixel 7...` → `Pixel 7`

Jika tidak ada match → device `null` → badge tidak dirender.

## Ikon & Platform

Ikon ditentukan dari nama device (case-insensitive):

| Kondisi nama device | Ikon | Contoh |
|---|---|---|
| mengandung `iphone`, `ipad`, `simulator` | 🍎 | iPhone 15 Pro |
| sama dengan `macos`, atau mengandung `linux`, `windows` | 🖥 | macOS |
| mengandung `chrome`, `edge`, `safari` | 🌐 | Chrome |
| selain di atas (default, Android) | 📱 | SM-A515F, Pixel 7 |

## Tampilan Badge

- Posisi: di header kartu terminal, di dalam baris pertama (dekat label & badge port),
  tepat sebelum badge port hijau (jika ada).
- Hanya dirender jika `proc.project_type === 'flutter'` DAN device terdeteksi.
- Styling: badge dengan warna **biru/sky cerah** yang kontras dengan badge port hijau,
  background semi-transparan + border berwarna + efek glow ringan, font-mono kecil.
  Contoh struktur:
  ```jsx
  <span style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid #38bdf8', color: '#7dd3fc', boxShadow: '0 0 8px rgba(56,189,248,0.3)' }}>
    {icon} {device}
  </span>
  ```
- Label teks: `{icon} {device}` (misal `📱 SM-A515F`).

## Alur Data

1. Monitor polling log setiap 2 detik → `logs[pid]` ter-update.
2. Saat render kartu, panggil helper `getFlutterDevice(logText)` → `{ device, icon } | null`.
3. Helper diimplementasikan sebagai fungsi murni (pure function) di file yang sama
   atau file util kecil (`client/src/utils/flutterDevice.ts`) — ikuti pola yang ada.
4. Badge dirender di header jika hasil tidak `null`.

## Error Handling

- Log kosong / belum ada output → tidak ada match → badge tidak muncul.
- Regex gagal karena format output berbeda → tidak ada match → badge tidak muncul.
- Tidak ada efek samping; murni derived state saat render.

## Testing / Verifikasi

- `cd client && npm run build` (typecheck strict: `noUnusedLocals`, dsb.) harus lulus.
- Verifikasi manual di `http://localhost:5173/monitor`:
  - Proses Flutter yang running → badge device muncul di header.
  - Proses non-Flutter → tidak ada badge.
  - Flutter tanpa output device (misal masih build) → badge belum muncul, lalu muncul
    setelah baris `Launching lib/main.dart on ...` tampil.
  - Hot restart ke device lain → badge berubah sesuai log terbaru.

## Non-Goals

- Tidak menambahkan deteksi via `flutter devices` / `adb devices`.
- Tidak mengubah tab Recent.
- Tidak mengubah backend / API / database.
- Tidak menampilkan info device di dalam area log (badge di header saja).

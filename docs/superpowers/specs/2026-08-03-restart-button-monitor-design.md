# Tombol Restart Terminal di Halaman Monitor — Desain

Tanggal: 2026-08-03

## Ringkasan

Menambahkan tombol **Restart** di kartu proses running pada halaman Monitor
(`client/src/pages/Monitor.tsx`), di samping tombol **Stop** yang sudah ada.
Perilaku meniru tombol Restart yang sudah ada di `ProjectDetail.tsx`.

## Tujuan

- User dapat me-restart proses dari halaman Monitor tanpa harus pindah ke
  halaman detail project.
- Perilaku konsisten dengan restart yang sudah ada di `ProjectDetail.tsx`:
  stop → clear log → jeda 300ms → start ulang.

## Perilaku

`handleRestart(pid)`:
1. `api.stopProcess(pid)` — hentikan proses + kill process tree (backend).
2. `api.clearLogs(pid)` + clear log di state lokal → kembali "Waiting for output...".
3. Jeda 300ms (agar port benar-benar lepas).
4. `api.startProcess(pid)` — mulai ulang.
5. Proses **tetap** tampil di daftar running (tidak dihapus seperti Stop),
   status local di-refresh dari hasil start.
6. Toast "Process restarted" untuk feedback; error dari backend ditampilkan via toast.

## Perubahan

| File | Perubahan |
|---|---|
| `client/src/pages/Monitor.tsx` | Tambah fungsi `handleRestart` + tombol Restart (kuning, konsisten dgn ProjectDetail) |

Tidak ada perubahan backend/API — endpoint `start`, `stop`, `clear-logs` sudah ada.

## Catatan

- Styling tombol: `bg-yellow-600 text-white px-2 py-0.5 rounded hover:bg-yellow-500 transition`
  (ukuran mengikuti tombol Stop di Monitor, warna kuning mengikuti ProjectDetail).
- Tidak ada fitur tambahan lain (YAGNI).

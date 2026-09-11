# Tombol View (Copy Visible Log) di Halaman Monitor — Desain

Tanggal: 2026-08-03

## Ringkasan

Menambahkan tombol **👁 View** di kartu proses running pada halaman Monitor
(`client/src/pages/Monitor.tsx`), yang menyalin log terminal yang sedang
terlihat di layar (visible area). Perilaku meniru komponen
`ProcessLogPanel.tsx` yang sudah dipakai di ProjectDetail.

## Tujuan

- Di Monitor saat ini hanya ada `📋 All` (copy seluruh log) dan `🗑 Clear`.
- Di menu lain (`ProcessLogPanel`) ada `📋 All`, **`👁 View`**, dan `🗑 Clear`.
- User ingin Monitor konsisten: tambah `👁 View` — copy log yang terlihat
  di area terminal (dihitung dari posisi scroll).

## Perilaku

`handleCopyVisible(pid)`:
1. Ambil elemen `<pre>` dari `preRefs.current[pid]` dan teks log dari `logs[pid]`.
2. Hitung baris pertama & terakhir yang terlihat:
   - `firstLine = max(0, floor((scrollTop - paddingTop) / lineHeight))`
   - `lastLine = min(jumlahBaris, ceil((scrollTop + clientHeight - paddingTop) / lineHeight))`
3. Salin slice baris tersebut ke clipboard, toast "Visible log copied!".

## Perubahan

| File | Perubahan |
|---|---|
| `client/src/pages/Monitor.tsx` | Tambah fungsi `handleCopyVisible` + tombol `👁 View` di samping `📋 All` |

Tidak ada perubahan backend/API. Algoritma salin persis dari
`ProcessLogPanel.tsx` (`handleCopyVisible`).

## Catatan

- Tombol: `👁 View`, title "Copy visible area", gaya sama dengan `📋 All`
  (`text-xs text-gray-500 hover:text-emerald-400 transition`).
- Tidak ada fitur tambahan lain (YAGNI).

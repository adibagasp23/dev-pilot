# Dev Pilot 🧑‍✈️

Web-based process manager untuk development Flutter & Laravel.  
Start, stop, monitor, dan kirim input ke process development dari satu dashboard.

![Screenshot](https://img.shields.io/badge/stack-Express%20%2B%20React%20%2B%20TypeScript%20%2B%20shadcn-blue)

## Fitur

- 📋 **Dashboard** — lihat semua project, scan folder baru
- 🚀 **Start / Stop / Restart** — kelola process tiap project
- 🖥️ **Live Terminal** — polling log real-time, auto-scroll
- ⌨️ **Input interaktif** — kirim perintah ke STDIN (Enter, `r`, `q`, dll)
- 🔥 **Flutter Quick Actions** — Hot Reload, Restart, Clear, Quit, Help, DevTools
- 🎯 **Port Management** — port sebagai field terpisah, unique, otomatis kill pas start/stop
- 📊 **Monitor** — semua running process dalam satu halaman
- 🔄 **Drag & Drop** — sorting process per project
- 📋 **Copy** — copy command, log, path dengan sekali klik

## Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Express.js |
| Frontend | React + Vite + TypeScript |
| UI | shadcn/ui + Tailwind CSS v4 |
| Database | SQLite via Knex |
| Process | child_process (spawn/kill) |

## Cara Pakai

### 1. Clone & Install

```bash
git clone https://github.com/adibagasp23/dev-pilot.git
cd dev-pilot

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### 2. Setup Database

```bash
# Database & migrations jalan otomatis pas pertama kali server jalan
npm run dev
```

### 3. Konfigurasi Folder Scan

Buka `http://localhost:9876/settings` → tambah folder project yang mau di-scan.

Atau lewat API:

```bash
curl -X POST http://localhost:9876/api/settings/folders \
  -H "Content-Type: application/json" \
  -d '{"path": "/home/user/projects"}'
```

### 4. Scan Project

Dari dashboard (`http://localhost:9876/`), klik **🔍 Scan Folders** untuk mendeteksi project Flutter (pubspec.yaml) dan Laravel (artisan).

### 5. Jalankan Process

- Buka halaman project → klik **▶ Start** pada process yang diinginkan
- Terminal otomatis terbuka, bisa kirim input lewat `❯` prompt
- Untuk Flutter: gunakan tombol **🔥 Hot Reload**, **🔄 Restart**, dll
- Klik **⏹ Stop** untuk menghentikan process

### 6. Monitor

Buka **📊 Monitor** di sidebar untuk melihat semua process yang sedang berjalan dalam satu layar.

### 7. Port

- Port bisa diisi saat tambah command (atau klik badge `:port` untuk edit inline)
- Port harus **unique** — gak boleh ada dua process pake port sama
- Pas **Start**: port yang dipake process lain otomatis di-kill
- Pas **Stop**: process di port ikut di-kill

### 8. Build untuk Production

```bash
cd client && npm run build && cd ..
npm start
```

Frontend otomatis di-serve dari Express (`http://localhost:9876/`).

## Struktur Folder

```
dev-pilot/
├── client/              # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── components/  # UI komponen reusable
│   │   ├── pages/       # Dashboard, ProjectDetail, Monitor, Settings
│   │   ├── api.ts       # API client
│   │   └── types.ts     # TypeScript interfaces
│   └── dist/            # Build output
├── database/            # Knex migrations
├── routes/              # Express API routes
├── services/            # Process manager, scanner
├── config.js            # Konfigurasi
└── index.js             # Entry point
```

## API Endpoints

| Method | Path | Deskripsi |
|--------|------|-----------|
| GET | `/api/projects` | Semua project |
| POST | `/api/projects/scan` | Scan folder |
| GET | `/api/projects/:id` | Detail project |
| GET | `/api/projects/:id/processes` | Process per project |
| POST | `/api/projects/:id/reorder` | Urutkan process |
| POST | `/api/processes` | Tambah process |
| PUT | `/api/processes/:id` | Update process |
| DELETE | `/api/processes/:id` | Hapus process |
| POST | `/api/processes/:id/start` | Start process |
| POST | `/api/processes/:id/stop` | Stop process |
| POST | `/api/processes/:id/input` | Kirim input ke STDIN |
| GET | `/api/processes/:id/log` | Ambil log |
| POST | `/api/processes/:id/clear-logs` | Clear log |
| GET | `/api/processes/running` | Semua process running |
| GET | `/api/settings/folders` | Folder scan |
| POST | `/api/settings/folders` | Tambah folder |
| DELETE | `/api/settings/folders/:id` | Hapus folder |

## License

MIT

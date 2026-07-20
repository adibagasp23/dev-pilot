# AGENTS.md — Dev Pilot (Process Manager)

## Dev Mode (JANGAN kill server)

```bash
cd ~/process-manager && npm run dev
```

Ini jalanin **2 server barengan**:
- **`localhost:5173`** — Vite dev server (HMR, frontend langsung update tanpa reload)
- **`localhost:9876`** — Express backend (auto-restart pake `node --watch`)

### Aturan penting

1. **Jangan kill server** kalau cuma ganti code frontend/backend. Cukup:
   - Frontend: HMR otomatis di `:5173`, refresh browser aja
   - Backend: `node --watch` otomatis restart
2. **Hanya butuh build ulang** (`cd client && npm run build`) kalau user akses lewat `:9876` langsung (bukan `:5173`)
3. **Gak perlu `kill $(lsof -ti:9876)`** kecuali server crash atau perlu restart manual

## Struktur Project

```
process-manager/
├── index.js              # Entry point Express server
├── routes/api.js         # API routes
├── services/             # Business logic (scanner, process-manager, backup)
├── database/
│   ├── db.js             # Knex setup + migrator
│   └── migrations/       # Database migrations
├── client/
│   ├── src/
│   │   ├── components/   # React komponen (Sidebar, KanbanBoard, Icons, dll)
│   │   ├── pages/        # Halaman (Dashboard, Tasks, MediaLibrary, dll)
│   │   ├── api.ts        # API client
│   │   └── types.ts      # TypeScript types
│   ├── vite.config.ts    # Vite config (proxy /api ke :9876)
│   └── dist/             # Build output (auto-generated)
├── views/                # EJS templates (legacy, jarang dipake)
└── AGENTS.md             # This file
```

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express 5, better-sqlite3, Knex |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind 4 |
| DB | SQLite (file: `database/process-manager.db`) |
| Icons | Heroicons v2 (via `client/src/components/Icons.tsx`) |

## Konvensi

- **TypeScript strict**: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` — imports gak kepake bakal error build
- **Icons**: Semua pake komponen dari `Icons.tsx` — jangan pake emoji atau inline SVG
- **Kanban**: Task cards pake `bg-[#0d1117]`, column containers pake `bg-black`
- **Sidebar**: Nav `icon` field tipenya `React.ComponentType<{ className?: string }>`, bukan `string`
- **Format**: Tailwind utility classes, jangan CSS-in-JS

## Ports

| Port | Service |
|---|---|
| 9876 | Express API + static files |
| 5173 | Vite dev server (dev only) |

## Commands

```bash
# Dev (Vite HMR + node --watch)
npm run dev

# Production start
npm start

# Build frontend only
cd client && npm run build

# Migrate DB
npm run migrate
```

# Process Manager — Design Document

## 1. Ringkasan

Aplikasi web sederhana berbasis Node.js + Express + HTMX + Tailwind CSS untuk mengelola proses development (Flutter, Laravel, dll) dalam satu dashboard.

## 2. Arsitektur & Struktur Folder

```
process-manager/
├── index.js                  # Entry point Express
├── package.json
├── database/
│   ├── db.js                 # Knex instance factory (SQLite/PostgreSQL/MySQL)
│   └── migrations/           # Knex migration files
├── routes/
│   └── processes.js          # Semua endpoint HTMX
├── views/
│   ├── layouts/
│   │   └── main.html         # Layout utama (navbar, sidebar)
│   └── pages/
│       ├── index.html        # Dashboard utama
│       ├── project-detail.html # Detail project + daftar proses
│       ├── add.html          # Form tambah proses manual
│       └── settings.html     # Settings folder scan
├── services/
│   ├── scanner.js            # Scan folder buat detect Flutter/Laravel
│   └── process-manager.js    # spawn/kill proses
├── public/
│   └── css/
│       └── custom.css        # Override Tailwind (optional)
└── config.js                 # Config folder scan, dll
```

### Flow Utama

1. App jalan → scan folder yang didaftarin
2. Deteksi `pubspec.yaml` → Flutter project, `artisan` → Laravel project
3. Tampil di dashboard dalam bentuk card per project
4. Klik card → halaman detail project → muncul daftar command
5. Klik Run → proses jalan via `spawn`, status berubah, output log muncul

## 3. Database Schema (Knex — Multi-Database)

Semua migrasi ditulis pakai **Knex schema builder** — otomatis adaptif ke database yang dipilih (auto-increment, tipe data, dll disesuaikan Knex).

```javascript
// database/migrations/001_create_tables.js
exports.up = function(knex) {
  return knex.schema
    .createTable('scan_folders', (table) => {
      table.increments('id').primary();
      table.string('path').notNullable().unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('projects', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('path').notNullable().unique();
      table.enu('type', ['flutter', 'laravel', 'other']).notNullable();
      table.integer('scan_folder_id').references('id').inTable('scan_folders');
      table.timestamp('last_scanned').defaultTo(knex.fn.now());
    })
    .createTable('command_templates', (table) => {
      table.increments('id').primary();
      table.string('project_type').notNullable();
      table.string('label').notNullable();
      table.string('command').notNullable();
    })
    .createTable('processes', (table) => {
      table.increments('id').primary();
      table.integer('project_id').references('id').inTable('projects');
      table.string('label').notNullable();
      table.string('command').notNullable();
      table.enu('status', ['running', 'stopped', 'error']).defaultTo('stopped');
      table.integer('pid');
      table.integer('port');
      table.string('log_path');
      table.timestamp('started_at');
      table.timestamp('stopped_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('processes')
    .dropTableIfExists('command_templates')
    .dropTableIfExists('projects')
    .dropTableIfExists('scan_folders');
};
```

**Config database ada di `config.js`**, tinggal ganti:

```javascript
// SQLite (default)
database: {
  client: 'better-sqlite3',
  connection: { filename: './database/process-manager.db' },
  useNullAsDefault: true,
}

// PostgreSQL
database: {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'process_manager',
    user: 'postgres',
    password: 'secret',
  },
}

// MySQL
database: {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    database: 'process_manager',
    user: 'root',
    password: 'secret',
  },
}
```

### Default Command Templates

| Project Type | Label | Command |
|---|---|---|
| flutter | Flutter Run | flutter run |
| flutter | Pub Get | flutter pub get |
| flutter | Build Runner | flutter pub run build_runner watch |
| laravel | Artisan Serve | php artisan serve |
| laravel | NPM Dev | npm run dev |
| laravel | Queue Work | php artisan queue:work |

## 4. UI Layout & Halaman

### Layout

Sidebar kiri (navigasi) + Konten kanan (content area).

### Halaman

1. **Dashboard** — grid card project, filter by type
2. **Detail Project** — klik card → semua command & status masing-masing
3. **Add Manual** — form isi nama + command kustom
4. **Settings** — daftar folder scan (tambah/hapus), trigger re-scan

### Interaksi HTMX

- **Run** → POST `/process/:id/start` → swap tombol jadi Stop + status 🟢
- **Stop** → POST `/process/:id/stop` → swap tombol jadi Run + status 🔴
- **Filter** sidebar → GET `/?type=flutter` → render ulang grid card

## 5. Endpoint API (HTMX Routes)

| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/` | Dashboard (grid project) |
| `GET` | `/?type=flutter` | Filter project by type |
| `GET` | `/project/:id` | Detail project + daftar proses |
| `POST` | `/project/:id/scan` | Re-scan folder project |
| `POST` | `/process/:id/start` | Start proses (spawn command) |
| `POST` | `/process/:id/stop` | Stop proses (kill PID) |
| `GET` | `/process/:id/log` | Output log (SSE atau polling) |
| `GET` | `/settings` | Halaman settings |
| `POST` | `/settings/folders` | Tambah folder scan |
| `DELETE` | `/settings/folders/:id` | Hapus folder scan |
| `POST` | `/processes/manual` | Tambah proses manual |
| `GET` | `/scan` | Trigger scan semua folder |

### Flow Start/Stop

```
Start: POST /process/:id/start
  → cek command dari DB
  → spawn(command, { cwd: project.path })
  → simpan PID ke DB
  → return HTML fragment tombol Stop + status running

Stop: POST /process/:id/stop
  → ambil PID dari DB
  → process.kill(pid)
  → update status ke stopped
  → return HTML fragment tombol Run + status stopped
```

## 6. Teknologi

| Komponen | Pilihan |
|---|---|
| Backend | Node.js + Express |
| Frontend | HTMX + Tailwind CSS (CDN) |
| Database | **Knex.js** — support SQLite, PostgreSQL, MySQL (ganti config doang) |
| DB Driver | `better-sqlite3` (SQLite), `pg` (PostgreSQL), `mysql2` (MySQL) |
| Templating | EJS (Express embedded) — ringan, support partials/fragments buat HTMX |
| Process | `child_process.spawn()` |
| Port | 3000 (default) |

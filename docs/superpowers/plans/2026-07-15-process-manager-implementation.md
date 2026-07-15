# Process Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web-based dashboard to manage Flutter & Laravel development processes — scan projects, start/stop commands, monitor status.

**Architecture:** Node.js + Express backend with HTMX + Tailwind CSS frontend. Knex.js for multi-database support (SQLite default, PostgreSQL/MySQL optional). child_process.spawn for process management. EJS templates for server-rendered HTML fragments that HTMX swaps in.

**Tech Stack:** Node.js 18+, Express 4, Knex.js, better-sqlite3 (default), HTMX 2.x (CDN), Tailwind CSS 3.x (CDN), EJS

## Global Constraints

- All state persisted via Knex.js (SQLite by default, configurable to PostgreSQL/MySQL)
- Port 3000 default, configurable via `PORT` env var
- HTMX for all dynamic interactions — no custom JS for UI updates
- Tailwind CSS via CDN — no build step for CSS
- EJS for server-side HTML rendering
- Process tracking via PID stored in DB, cleanup on app exit

---

### Task 1: Project Scaffolding & Dependencies

**Files:**
- Create: `package.json`
- Create: `index.js`
- Create: `config.js`
- Create: `.gitignore`

**Interfaces:**
- Produces: Working Express server on port 3000 with "Hello" endpoint

- [ ] **Step 1: Initialize project & install deps**

```bash
cd ~/process-manager
npm init -y
npm install express knex ejs better-sqlite3
# Untuk PostgreSQL: npm install pg
# Untuk MySQL: npm install mysql2
```

- [ ] **Step 2: Create package.json with start script**

Edit `package.json`, add scripts:

```json
"scripts": {
  "start": "node index.js",
  "dev": "node --watch index.js",
  "migrate": "node -e \"require('./database/db').migrate()\""
}
```

- [ ] **Step 3: Create config.js**

```javascript
// config.js
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  
  // Database — ganti client & connection buat pake PostgreSQL/MySQL
  database: {
    client: process.env.DB_CLIENT || 'better-sqlite3',
    connection: process.env.DB_CLIENT === 'better-sqlite3'
      ? { filename: path.join(__dirname, 'database', 'process-manager.db') }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'process_manager',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'secret',
        },
    useNullAsDefault: true,
  },

  scanFolders: [],

  commands: {
    flutter: [
      { label: 'Flutter Run', command: 'flutter run' },
      { label: 'Pub Get', command: 'flutter pub get' },
      { label: 'Build Runner', command: 'flutter pub run build_runner watch' },
    ],
    laravel: [
      { label: 'Artisan Serve', command: 'php artisan serve' },
      { label: 'NPM Dev', command: 'npm run dev' },
      { label: 'Queue Work', command: 'php artisan queue:work' },
    ],
  },
};
```

- [ ] **Step 4: Create index.js (minimal)**

```javascript
// index.js
const express = require('express');
const path = require('path');
const config = require('./config');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Process Manager running!');
});

app.listen(config.port, () => {
  console.log(`Process Manager running on http://localhost:${config.port}`);
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
database/*.db
*.db-journal
*.db-wal
```

- [ ] **Step 6: Test server starts**

```bash
cd ~/process-manager && node index.js
```

Expected: `Process Manager running on http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
cd ~/process-manager
git init
git add -A
git commit -m "chore: scaffold project structure with Knex.js"
```

---

### Task 2: Database Layer (Knex.js)

**Files:**
- Create: `database/db.js`
- Create: `database/migrations/001_create_tables.js`

**Interfaces:**
- Produces: `getDB()` — returns configured Knex instance
- Produces: `migrate()` — runs Knex migrations

- [ ] **Step 1: Create database/db.js**

```javascript
// database/db.js
const knex = require('knex');
const path = require('path');
const config = require('../config');

let db;

function getDB() {
  if (!db) {
    db = knex({
      client: config.database.client,
      connection: config.database.connection,
      useNullAsDefault: true,
      migrations: {
        directory: path.join(__dirname, 'migrations'),
      },
    });
  }
  return db;
}

async function migrate() {
  const db = getDB();
  await db.migrate.latest();
  console.log('Migrations up to date');
}

module.exports = { getDB, migrate };
```

- [ ] **Step 2: Create database/migrations/001_create_tables.js**

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

- [ ] **Step 3: Create database/migrations/002_seed_templates.js**

```javascript
// database/migrations/002_seed_templates.js
exports.up = async function(knex) {
  const count = await knex('command_templates').count('* as cnt');
  if (count[0].cnt === 0) {
    await knex('command_templates').insert([
      { project_type: 'flutter', label: 'Flutter Run', command: 'flutter run' },
      { project_type: 'flutter', label: 'Pub Get', command: 'flutter pub get' },
      { project_type: 'flutter', label: 'Build Runner', command: 'flutter pub run build_runner watch' },
      { project_type: 'laravel', label: 'Artisan Serve', command: 'php artisan serve' },
      { project_type: 'laravel', label: 'NPM Dev', command: 'npm run dev' },
      { project_type: 'laravel', label: 'Queue Work', command: 'php artisan queue:work' },
    ]);
  }
};

exports.down = function(knex) {
  return knex('command_templates').del();
};
```

- [ ] **Step 4: Update index.js to run migrate**

```javascript
// index.js — add after requires
const { migrate } = require('./database/db');
migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Test database initializes**

```bash
cd ~/process-manager && node -e "
const { getDB, migrate } = require('./database/db');
migrate().then(async () => {
  const db = getDB();
  const tables = await db('sqlite_master').where('type', 'table').select('name');
  console.log('Tables:', tables.map(t => t.name));
  const templates = await db('command_templates').select('*');
  console.log('Templates:', templates.length);
});
"
```

Expected: Lists 5 tables (knex_migrations, knext_migrations_lock, scan_folders, projects, command_templates, processes) and 6 templates

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Knex.js database layer with migrations"
```

---

### Task 3: Scanner Service

**Files:**
- Create: `services/scanner.js`

**Interfaces:**
- Produces: `scanFolder(folderPath)` — scans a folder for Flutter/Laravel projects
- Produces: `scanAllFolders()` — scans all registered scan_folders
- Produces: `detectProjectType(folderPath)` — returns 'flutter', 'laravel', or 'other'

- [ ] **Step 1: Create services/scanner.js**

```javascript
// services/scanner.js
const fs = require('fs');
const path = require('path');
const { getDB } = require('../database/db');

function detectProjectType(folderPath) {
  const files = fs.readdirSync(folderPath);
  if (files.includes('pubspec.yaml')) return 'flutter';
  if (files.includes('artisan')) return 'laravel';
  return 'other';
}

async function scanFolder(folderPath) {
  const db = getDB();
  const absPath = path.resolve(folderPath);

  if (!fs.existsSync(absPath)) {
    return { error: `Folder not found: ${absPath}`, projects: [] };
  }

  // Get or create scan_folder entry
  let row = await db('scan_folders').where('path', absPath).first();
  if (!row) {
    const [id] = await db('scan_folders').insert({ path: absPath });
    row = { id };
  }
  const scanFolderId = row.id;

  // Read subdirectories
  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(absPath, entry.name);
    const type = detectProjectType(fullPath);
    if (type === 'other') continue;

    // Upsert project
    const existing = await db('projects').where('path', fullPath).first();
    if (existing) {
      await db('projects').where('id', existing.id).update({ last_scanned: db.fn.now() });
      found.push({ id: existing.id, name: entry.name, path: fullPath, type });
    } else {
      const [id] = await db('projects').insert({
        name: entry.name, path: fullPath, type, scan_folder_id: scanFolderId,
      });
      found.push({ id, name: entry.name, path: fullPath, type });
    }
  }

  return { error: null, projects: found };
}

async function scanAllFolders() {
  const db = getDB();
  const folders = await db('scan_folders').select('*');
  const results = [];
  for (const folder of folders) {
    results.push(await scanFolder(folder.path));
  }
  return results;
}

module.exports = { detectProjectType, scanFolder, scanAllFolders };
```

- [ ] **Step 2: Quick test scanner**

```bash
cd ~/process-manager && node -e "
const { migrate } = require('./database/db');
migrate().then(async () => {
  const { scanFolder } = require('./services/scanner');
  const result = await scanFolder('$HOME');
  console.log(JSON.stringify(result, null, 2));
});
"
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add scanner service with Knex queries"
```

---

### Task 4: Process Manager Service

**Files:**
- Create: `services/process-manager.js`

**Interfaces:**
- Produces: `startProcess(processId)` — spawns command, saves PID
- Produces: `stopProcess(processId)` — kills process by PID
- Produces: `getProcessStatus(processId)` — returns current status
- Produces: `cleanup()` — kills all running processes on exit

- [ ] **Step 1: Create services/process-manager.js**

```javascript
// services/process-manager.js
const { spawn } = require('child_process');
const { getDB } = require('../database/db');

// Track running child processes in memory for quick reference
const runningProcesses = new Map();

async function startProcess(processId) {
  const db = getDB();
  const proc = await db('processes as p')
    .join('projects as pr', 'pr.id', 'p.project_id')
    .where('p.id', processId)
    .select('p.*', 'pr.path as project_path', 'pr.name as project_name')
    .first();

  if (!proc) throw new Error('Process not found');
  if (proc.status === 'running') throw new Error('Process already running');

  const cwd = proc.project_path;
  const cmd = proc.command;

  const child = spawn(cmd, [], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  const pid = child.pid;
  runningProcesses.set(processId, child);

  await db('processes').where('id', processId).update({
    status: 'running',
    pid: pid,
    started_at: db.fn.now(),
    stopped_at: null,
  });

  child.on('exit', async () => {
    runningProcesses.delete(processId);
    await db('processes').where('id', processId).update({
      status: 'stopped',
      pid: null,
      stopped_at: db.fn.now(),
    });
  });

  child.on('error', async (err) => {
    runningProcesses.delete(processId);
    await db('processes').where('id', processId).update({ status: 'error' });
    throw err;
  });

  return { pid, status: 'running' };
}

async function stopProcess(processId) {
  const db = getDB();
  const proc = await db('processes').where('id', processId).first();

  if (!proc) throw new Error('Process not found');
  if (proc.status !== 'running') throw new Error('Process is not running');

  const child = runningProcesses.get(processId);
  if (child) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {
      try { process.kill(child.pid, 'SIGTERM'); } catch {}
    }
    runningProcesses.delete(processId);
  } else if (proc.pid) {
    try { process.kill(proc.pid, 'SIGTERM'); } catch {}
  }

  await db('processes').where('id', processId).update({
    status: 'stopped',
    pid: null,
    stopped_at: db.fn.now(),
  });

  return { status: 'stopped' };
}

async function getProcessStatus(processId) {
  const db = getDB();
  return db('processes').where('id', processId).first();
}

function cleanup() {
  for (const [id, child] of runningProcesses) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {
      try { process.kill(child.pid, 'SIGTERM'); } catch {}
    }
  }
  runningProcesses.clear();
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

module.exports = { startProcess, stopProcess, getProcessStatus, cleanup };
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add process manager service with Knex queries"
```

---

### Task 5: Express Routes (HTMX Endpoints)

**Files:**
- Create: `routes/processes.js`
- Modify: `index.js` — mount routes

**Interfaces:**
- Consumes: `scanner.js` (scanAllFolders, scanFolder)
- Consumes: `process-manager.js` (startProcess, stopProcess)
- Consumes: `database/db.js` (getDB)
- Produces: All HTMX endpoints listed in design doc

- [ ] **Step 1: Create routes/processes.js**

```javascript
// routes/processes.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { scanAllFolders, scanFolder } = require('../services/scanner');
const { startProcess, stopProcess } = require('../services/process-manager');

// Dashboard — list all projects
router.get('/', async (req, res) => {
  const db = getDB();
  const typeFilter = req.query.type;
  let projects;
  if (typeFilter) {
    projects = await db('projects').where('type', typeFilter).orderBy('name');
  } else {
    projects = await db('projects').orderBy(['type', 'name']);
  }

  const runningCounts = await db('processes')
    .where('status', 'running')
    .groupBy('project_id')
    .select('project_id')
    .count('* as cnt');
  const countMap = {};
  for (const row of runningCounts) countMap[row.project_id] = row.cnt;

  res.render('pages/index', { projects, countMap, activeFilter: typeFilter || 'all' });
});

// Project detail
router.get('/project/:id', async (req, res) => {
  const db = getDB();
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).send('Project not found');

  const processes = await db('processes').where('project_id', project.id);
  const templates = await db('command_templates').where('project_type', project.type);

  res.render('pages/project-detail', { project, processes, templates });
});

// Start process
router.post('/process/:id/start', async (req, res) => {
  try {
    await startProcess(parseInt(req.params.id));
    const db = getDB();
    const proc = await db('processes').where('id', parseInt(req.params.id)).first();
    res.render('partials/process-status', { proc });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Stop process
router.post('/process/:id/stop', async (req, res) => {
  try {
    await stopProcess(parseInt(req.params.id));
    const db = getDB();
    const proc = await db('processes').where('id', parseInt(req.params.id)).first();
    res.render('partials/process-status', { proc });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Re-scan a specific project folder
router.post('/project/:id/scan', async (req, res) => {
  const db = getDB();
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).send('Project not found');

  await scanFolder(project.path);
  res.redirect(`/project/${req.params.id}`);
});

// Settings page
router.get('/settings', async (req, res) => {
  const db = getDB();
  const folders = await db('scan_folders').orderBy('path');
  res.render('pages/settings', { folders });
});

// Add scan folder
router.post('/settings/folders', async (req, res) => {
  const folderPath = req.body.path?.trim();
  if (!folderPath) return res.status(400).send('Path is required');

  try {
    await scanFolder(folderPath);
    res.redirect('/settings');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Delete scan folder
router.post('/settings/folders/:id/delete', async (req, res) => {
  const db = getDB();
  const folder = await db('scan_folders').where('id', req.params.id).first();
  if (!folder) return res.status(404).send('Folder not found');

  // Delete associated projects & processes
  const projects = await db('projects').where('scan_folder_id', req.params.id).select('id');
  const projectIds = projects.map(p => p.id);
  if (projectIds.length > 0) {
    await db('processes').whereIn('project_id', projectIds).del();
    await db('projects').whereIn('id', projectIds).del();
  }
  await db('scan_folders').where('id', req.params.id).del();

  res.redirect('/settings');
});

// Manual add process
router.post('/processes/manual', async (req, res) => {
  const db = getDB();
  const { project_id, label, command } = req.body;
  if (!project_id || !label || !command) return res.status(400).send('All fields required');

  await db('processes').insert({ project_id, label, command });
  res.redirect(`/project/${project_id}`);
});

// Add command from template to project
router.post('/project/:id/add-template', async (req, res) => {
  const db = getDB();
  const projectId = req.params.id;
  const templateId = req.body.template_id;

  const template = await db('command_templates').where('id', templateId).first();
  if (!template) return res.status(400).send('Template not found');

  const existing = await db('processes')
    .where({ project_id: projectId, command: template.command })
    .first();

  if (!existing) {
    await db('processes').insert({
      project_id: projectId,
      label: template.label,
      command: template.command,
    });
  }

  res.redirect(`/project/${projectId}`);
});

// Trigger full re-scan
router.get('/scan', async (req, res) => {
  await scanAllFolders();
  res.redirect('/');
});

// Get auto-detect suggestions (processes currently running on system)
router.get('/auto-detect', (req, res) => {
  const { execSync } = require('child_process');
  try {
    const output = execSync('ps aux').toString();
    const lines = output.split('\n').slice(1).filter(l => l.trim());
    const processes = lines.map(line => {
      const parts = line.split(/\s+/);
      return {
        pid: parseInt(parts[1]),
        user: parts[0],
        command: parts.slice(10).join(' '),
        cpu: parts[2],
        mem: parts[3],
      };
    }).filter(p => p.pid && p.command && !p.command.includes('ps aux'));

    res.render('partials/auto-detect-results', { processes: processes.slice(0, 50) });
  } catch (err) {
    res.status(500).send('Failed to list processes');
  }
});

module.exports = router;
```

- [ ] **Step 2: Update index.js to use routes & set view engine**

Edit `index.js` to the final version:

```javascript
// index.js
const express = require('express');
const path = require('path');
const config = require('./config');
const { migrate } = require('./database/db');
const routes = require('./routes/processes');

// Run database migrations
migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// EJS setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Mount routes
app.use('/', routes);

app.listen(config.port, () => {
  console.log(`Process Manager running on http://localhost:${config.port}`);
});
```

- [ ] **Step 3: Create views directory structure**

```bash
cd ~/process-manager
mkdir -p views/layouts views/pages views/partials public/css
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Express routes (HTMX) with async Knex queries"
```

---

### Task 6: EJS Views — Layout & Dashboard

**Files:**
- Create: `views/layouts/main.ejs`
- Create: `views/pages/index.ejs`
- Create: `views/partials/project-card.ejs`
- Create: `views/partials/process-status.ejs`

- [ ] **Step 1: Create views/layouts/main.ejs**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Process Manager</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <link rel="stylesheet" href="/css/custom.css">
  <style>
    .process-card { transition: all 0.2s ease; }
    .process-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .status-running { background-color: #22c55e; }
    .status-stopped { background-color: #ef4444; }
    .status-error { background-color: #f59e0b; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="flex">
    <!-- Sidebar -->
    <aside class="w-64 bg-gray-900 text-white min-h-screen p-4">
      <h1 class="text-xl font-bold mb-6 flex items-center gap-2">
        <span class="text-emerald-400">⚡</span> PM
      </h1>
      
      <nav class="space-y-2">
        <a href="/" class="block px-3 py-2 rounded hover:bg-gray-700 transition <%= activeFilter === 'all' ? 'bg-gray-700' : '' %>">
          📋 All Projects
        </a>
        <a href="/?type=flutter" class="block px-3 py-2 rounded hover:bg-gray-700 transition <%= activeFilter === 'flutter' ? 'bg-gray-700' : '' %>">
          🟦 Flutter
        </a>
        <a href="/?type=laravel" class="block px-3 py-2 rounded hover:bg-gray-700 transition <%= activeFilter === 'laravel' ? 'bg-gray-700' : '' %>">
          🟠 Laravel
        </a>
        <hr class="my-3 border-gray-700">
        <a href="/settings" class="block px-3 py-2 rounded hover:bg-gray-700 transition">
          ⚙ Settings
        </a>
        <a href="/scan" class="block px-3 py-2 rounded hover:bg-gray-700 transition">
          🔍 Re-scan All
        </a>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-6">
      <%- body %>
    </main>
  </div>
</body>
</html>
```

- [ ] **Step 2: Create views/partials/project-card.ejs**

```html
<div class="process-card bg-white rounded-lg shadow p-4 border-l-4 <%= project.type === 'flutter' ? 'border-blue-500' : 'border-orange-500' %>">
  <div class="flex justify-between items-start mb-2">
    <div>
      <h3 class="font-semibold text-gray-800"><%= project.name %></h3>
      <span class="text-xs text-gray-500"><%= project.type.charAt(0).toUpperCase() + project.type.slice(1) %></span>
    </div>
    <span class="text-xs bg-gray-100 px-2 py-1 rounded"><%= countMap[project.id] || 0 %> running</span>
  </div>
  <p class="text-xs text-gray-400 truncate mb-3"><%= project.path %></p>
  <a href="/project/<%= project.id %>" 
     class="inline-block text-sm bg-gray-800 text-white px-3 py-1.5 rounded hover:bg-gray-700 transition">
    Open →
  </a>
</div>
```

- [ ] **Step 3: Create views/pages/index.ejs**

```html
<% 
  let title = 'All Projects';
  if (activeFilter === 'flutter') title = 'Flutter Projects';
  else if (activeFilter === 'laravel') title = 'Laravel Projects';
%>

<div class="mb-6 flex justify-between items-center">
  <div>
    <h2 class="text-2xl font-bold text-gray-800"><%= title %></h2>
    <p class="text-gray-500 text-sm"><%= projects.length %> project(s) found</p>
  </div>
  <a href="/settings" class="bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition text-sm">
    + Add Folder
  </a>
</div>

<% if (projects.length === 0) { %>
  <div class="text-center py-20 text-gray-400">
    <p class="text-4xl mb-2">📂</p>
    <p class="text-lg">No projects yet</p>
    <p class="text-sm mt-1">Go to Settings to add scan folders</p>
  </div>
<% } else { %>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <% for (const project of projects) { %>
      <%- include('../partials/project-card', { project, countMap }) %>
    <% } %>
  </div>
<% } %>
```

- [ ] **Step 4: Create views/partials/process-status.ejs**

```html
<div class="flex items-center gap-3" id="process-<%= proc.id %>-status">
  <span class="status-dot status-<%= proc.status %>"></span>
  <span class="text-sm font-medium <%= proc.status === 'running' ? 'text-green-600' : 'text-gray-600' %>">
    <%= proc.status.charAt(0).toUpperCase() + proc.status.slice(1) %>
  </span>
  
  <% if (proc.status === 'running') { %>
    <button hx-post="/process/<%= proc.id %>/stop"
            hx-target="#process-<%= proc.id %>-status"
            hx-swap="outerHTML"
            class="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 transition">
      Stop
    </button>
    <% if (proc.pid) { %>
      <span class="text-xs text-gray-400">PID: <%= proc.pid %></span>
    <% } %>
  <% } else { %>
    <button hx-post="/process/<%= proc.id %>/start"
            hx-target="#process-<%= proc.id %>-status"
            hx-swap="outerHTML"
            class="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 transition">
      Start
    </button>
  <% } %>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add EJS views - layout, dashboard, project card, process status"
```

---

### Task 7: EJS Views — Detail, Settings, Auto-detect

**Files:**
- Create: `views/pages/project-detail.ejs`
- Create: `views/pages/settings.ejs`
- Create: `views/partials/auto-detect-results.ejs`
- Create: `public/css/custom.css`

- [ ] **Step 1: Create views/pages/project-detail.ejs**

```html
<div class="mb-6">
  <a href="/" class="text-sm text-gray-500 hover:text-gray-700">← Back to Dashboard</a>
  <h2 class="text-2xl font-bold text-gray-800 mt-1"><%= project.name %></h2>
  <p class="text-gray-500 text-sm"><%= project.path %></p>
  <span class="inline-block mt-1 text-xs px-2 py-0.5 rounded <%= project.type === 'flutter' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700' %>">
    <%= project.type.charAt(0).toUpperCase() + project.type.slice(1) %>
  </span>
</div>

<!-- Command Templates -->
<div class="bg-white rounded-lg shadow p-4 mb-6">
  <h3 class="font-semibold text-gray-700 mb-3">Add Command</h3>
  <div class="flex flex-wrap gap-2">
    <% for (const tmpl of templates) { %>
      <form action="/project/<%= project.id %>/add-template" method="POST" style="display:inline">
        <input type="hidden" name="template_id" value="<%= tmpl.id %>">
        <button type="submit" class="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200 transition border">
          + <%= tmpl.label %>
        </button>
      </form>
    <% } %>
  </div>

  <!-- Or add custom command -->
  <form action="/processes/manual" method="POST" class="mt-3 flex gap-2">
    <input type="hidden" name="project_id" value="<%= project.id %>">
    <input type="text" name="label" placeholder="Label (e.g., Custom Server)" class="border rounded px-2 py-1 text-sm flex-1" required>
    <input type="text" name="command" placeholder="Command (e.g., node server.js)" class="border rounded px-2 py-1 text-sm flex-1" required>
    <button type="submit" class="bg-emerald-500 text-white px-3 py-1 rounded text-sm hover:bg-emerald-600">Add</button>
  </form>
</div>

<!-- Running Processes -->
<div class="space-y-3">
  <h3 class="font-semibold text-gray-700">Processes</h3>
  <% if (processes.length === 0) { %>
    <p class="text-gray-400 text-sm">No processes added yet. Use the buttons above to add commands.</p>
  <% } else { %>
    <% for (const proc of processes) { %>
      <div class="bg-white rounded-lg shadow p-4 flex items-center justify-between">
        <div>
          <p class="font-medium text-gray-800"><%= proc.label %></p>
          <code class="text-xs text-gray-500"><%= proc.command %></code>
        </div>
        <%- include('../partials/process-status', { proc }) %>
      </div>
    <% } %>
  <% } %>
</div>
```

- [ ] **Step 2: Create views/pages/settings.ejs**

```html
<div class="max-w-2xl">
  <h2 class="text-2xl font-bold text-gray-800 mb-6">⚙ Settings</h2>

  <!-- Add Scan Folder -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <h3 class="font-semibold text-gray-700 mb-3">Add Scan Folder</h3>
    <form action="/settings/folders" method="POST" class="flex gap-2">
      <input type="text" name="path" placeholder="e.g., /Users/name/projects" 
             class="border rounded px-3 py-2 text-sm flex-1" required>
      <button type="submit" class="bg-emerald-500 text-white px-4 py-2 rounded text-sm hover:bg-emerald-600">
        Add & Scan
      </button>
    </form>
  </div>

  <!-- Scan Folders List -->
  <div class="bg-white rounded-lg shadow p-4 mb-6">
    <h3 class="font-semibold text-gray-700 mb-3">Scan Folders</h3>
    <% if (folders.length === 0) { %>
      <p class="text-gray-400 text-sm">No folders added yet.</p>
    <% else { %>
      <ul class="divide-y">
        <% for (const folder of folders) { %>
          <li class="py-2 flex justify-between items-center">
            <span class="text-sm text-gray-700"><%= folder.path %></span>
            <form action="/settings/folders/<%= folder.id %>/delete" method="POST" onsubmit="return confirm('Remove this folder and its projects?')">
              <button type="submit" class="text-xs text-red-500 hover:text-red-700">Remove</button>
            </form>
          </li>
        <% } %>
      </ul>
    <% } %>
  </div>

  <!-- Auto-detect running processes -->
  <div class="bg-white rounded-lg shadow p-4">
    <h3 class="font-semibold text-gray-700 mb-3">Auto-Detect Running Processes</h3>
    <p class="text-sm text-gray-500 mb-3">Detect processes currently running on your system to add them.</p>
    <button hx-get="/auto-detect" 
            hx-target="#auto-detect-results"
            hx-swap="innerHTML"
            class="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition">
      Scan Running Processes
    </button>
    <div id="auto-detect-results" class="mt-3"></div>
  </div>
</div>
```

- [ ] **Step 3: Create views/partials/auto-detect-results.ejs**

```html
<% if (processes.length === 0) { %>
  <p class="text-gray-400 text-sm">No processes detected.</p>
<% } else { %>
  <div class="max-h-64 overflow-y-auto border rounded">
    <table class="w-full text-sm">
      <thead class="bg-gray-50 sticky top-0">
        <tr>
          <th class="text-left px-2 py-1 text-gray-500">PID</th>
          <th class="text-left px-2 py-1 text-gray-500">Command</th>
          <th class="text-left px-2 py-1 text-gray-500">CPU</th>
          <th class="text-left px-2 py-1 text-gray-500">MEM</th>
        </tr>
      </thead>
      <tbody>
        <% for (const p of processes) { %>
          <tr class="border-t hover:bg-gray-50">
            <td class="px-2 py-1 text-gray-500"><%= p.pid %></td>
            <td class="px-2 py-1"><%= p.command.substring(0, 60) %></td>
            <td class="px-2 py-1 text-gray-500"><%= p.cpu %></td>
            <td class="px-2 py-1 text-gray-500"><%= p.mem %></td>
          </tr>
        <% } %>
      </tbody>
    </table>
  </div>
  <p class="text-xs text-gray-400 mt-1">Showing up to 50 processes.</p>
<% } %>
```

- [ ] **Step 4: Create public/css/custom.css**

```css
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add project detail, settings, auto-detect views, and custom CSS"
```

---

### Task 8: Integration & Final Test

**Files:**
- Verify all files exist and application runs

- [ ] **Step 1: Final test — full startup**

```bash
cd ~/process-manager
rm -f database/process-manager.db  # Fresh start
npm start
```

Open `http://localhost:3000` — should see dashboard with sidebar.

- [ ] **Step 2: Test flow**

```bash
# 1. Go to Settings → add scan folder (e.g., ~/projects or any folder with Flutter/Laravel projects)
# 2. After adding, projects appear on Dashboard
# 3. Click project → see command templates
# 4. Click "+ Flutter Run" → process added
# 5. Click "Start" → process spawns, status changes to running
# 6. Click "Stop" → process killed, status changes to stopped
# 7. Filter sidebar works (All / Flutter / Laravel)
```

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: final integration and testing"
```

// index.js — Pure API backend
const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { migrate } = require('./database/db');
const apiRoutes = require('./routes/api');

// ----- Logger -----
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try { fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n'); } catch {}
  if (level !== 'FATAL') {
    try { process.stdout.write(line + '\n'); } catch {}
  }
}

// ----- Uncaught errors -----
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.message?.includes('EPIPE')) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [FATAL] Uncaught exception ${err.message}\n${err.stack}`;
  try { fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n'); } catch {}
  // Only exit for fatal errors — let the process try to recover
  if (err.message?.includes('ENOENT') || err.message?.includes('EADDRINUSE') || err.code === 'MODULE_NOT_FOUND') {
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'EPIPE' || reason?.message?.includes('EPIPE')) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [FATAL] Unhandled rejection ${reason?.message || String(reason)}`;
  try { fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n'); } catch {}
  // Only exit for fatal errors
  if (reason?.message?.includes('ENOENT') || reason?.code === 'EADDRINUSE') {
    process.exit(1);
  }
});

const app = express();

// Cleanup orphaned processes on startup
(async () => {
  try {
    await migrate();
    log('INFO', 'Migrations up to date');
    const { getDB } = require('./database/db');
    const db = getDB();
    const orphaned = await db('processes').where('status', 'running');
    if (orphaned.length > 0) {
      log('INFO', `Cleaning up ${orphaned.length} orphaned process(es)`);
      for (const proc of orphaned) {
        if (proc.port) {
          try {
            require('child_process').execSync(`lsof -ti:${proc.port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
          } catch {}
        }
      }
      await db('processes').where('status', 'running').update({ status: 'stopped', pid: null, stopped_at: db.fn.now() });
    }

    // Also kill any lingering processes on known ports (status=stopped tapi process masih jalan)
    const allWithPorts = await db('processes').whereNotNull('port').where(db.raw('CAST("port" AS TEXT)'), '!=', '');
    for (const proc of allWithPorts) {
      try {
        if (proc.port) {
          require('child_process').execSync(`lsof -ti:${proc.port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
        }
      } catch {}
    }
  } catch (err) {
    log('ERROR', 'Startup cleanup failed', { message: err.message });
  }

  // Daily database backup
  const { backup } = require('./services/backup');
  try { backup(); } catch (e) { log('ERROR', 'Backup failed', { message: e.message }); }
  setInterval(() => { try { backup(); } catch (e) { log('ERROR', 'Backup failed', { message: e.message }); } }, 60 * 60 * 1000);
})();

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    log('REQ', `${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Error logging middleware
app.use((err, req, res, next) => {
  log('ERROR', 'Express error', { path: req.path, message: err.message });
  res.status(500).json({ error: err.message });
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api', apiRoutes);

// Client serving: static build (use Vite at :5173 for hot-reload dev)
const clientBuild = path.join(__dirname, 'client', 'dist');

app.use(express.static(clientBuild));
app.use((req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

const server = app.listen(config.port, () => {
  try {
    const addr = server.address();
    if (!addr) {
      log('ERROR', 'Server started but address unavailable');
      return;
    }
    const port = addr.port;
    console.log(`API server running on http://localhost:${port}`);
    console.log(`API: http://localhost:${port}/api`);
    console.log(`Frontend: http://localhost:${port}/`);
  } catch (err) {
    log('ERROR', 'Error in listen callback', { message: err.message });
  }
});

// Handle server errors — if port is taken, exit immediately to avoid port conflict loops
server.on('error', (err) => {
  log('FATAL', 'Server error', { message: err.message, code: err.code });
  if (err.code === 'EADDRINUSE') {
    log('FATAL', `Port ${config.port} already in use — exiting to avoid conflict`);
    process.exit(1);
  }
});

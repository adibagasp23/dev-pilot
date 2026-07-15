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
  const line = `[${ts}] [FATAL] Uncaught exception ${err.message}`;
  try { fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n'); } catch {}
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  if (reason?.code === 'EPIPE' || reason?.message?.includes('EPIPE')) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] [FATAL] Unhandled rejection ${reason?.message || String(reason)}`;
  try { fs.appendFileSync(path.join(logDir, 'app.log'), line + '\n'); } catch {}
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
  } catch (err) {
    log('ERROR', 'Startup cleanup failed', { message: err.message });
  }
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

// API routes
app.use('/api', apiRoutes);

// Serve React build in production
const clientBuild = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientBuild));
app.use((req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

const server = app.listen(config.port, () => {
  const port = server.address().port;
  console.log(`API server running on http://localhost:${port}`);
  console.log(`API: http://localhost:${port}/api`);
  console.log(`Frontend: http://localhost:${port}/`);
});

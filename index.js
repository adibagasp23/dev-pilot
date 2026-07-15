// index.js — Pure API backend
const express = require('express');
const path = require('path');
const config = require('./config');
const { migrate } = require('./database/db');
const apiRoutes = require('./routes/api');

const app = express();

// Cleanup orphaned processes on startup
(async () => {
  try {
    await migrate();
    const { getDB } = require('./database/db');
    const db = getDB();
    const orphaned = await db('processes').where('status', 'running');
    if (orphaned.length > 0) {
      console.log(`Cleaning up ${orphaned.length} orphaned process(es) from previous session`);
      // Kill any processes still holding ports
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
    console.error('Startup cleanup failed:', err.message);
  }
})();

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
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

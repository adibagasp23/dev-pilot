// routes/api.js — JSON API for React frontend
const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { scanAllFolders, scanFolder } = require('../services/scanner');
const { startProcess, stopProcess, sendInput, getLogs, clearLogs, subscribeSSE, unsubscribeSSE, processLogs, runningProcesses } = require('../services/process-manager');
const fs = require('fs');
const path = require('path');

const APP_TYPES_PATH = path.join(__dirname, '..', 'config', 'app-types.json');

async function getAppTypes() {
  try {
    const db = getDB();
    const row = await db('settings').where('key', 'app_types').first();
    if (row) return JSON.parse(row.value);
  } catch {}
  return ['flutter', 'laravel', 'next'];
}

// Logger (same format as process-manager.js)
const logFile = path.join(__dirname, '..', 'logs', 'app.log');
function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
  try { process.stdout.write(line + '\n'); } catch {}
}

// Get all projects
router.get('/projects', async (req, res) => {
  const db = getDB();
  const typeFilter = req.query.type;
  const grouped = req.query.grouped === 'true';

  let projects;
  if (typeFilter === 'app') {
    projects = await db('projects').whereIn('type', await getAppTypes()).orderBy('name');
  } else if (typeFilter) {
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

  if (grouped) {
    const groups = {};
    const ungrouped = [];
    for (const p of projects) {
      if (p.group_name) {
        if (!groups[p.group_name]) groups[p.group_name] = { name: p.group_name, projects: [] };
        groups[p.group_name].projects.push(p);
      } else {
        ungrouped.push(p);
      }
    }
    return res.json({ groups: Object.values(groups), ungrouped, countMap });
  }

  res.json({ projects, countMap });
});

// Get project detail
router.get('/projects/:id', async (req, res) => {
  const db = getDB();
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Auto-populate templates
  const templates = await db('command_templates').where('project_type', project.type);
  for (const tmpl of templates) {
    const existing = await db('processes')
      .where({ project_id: project.id, command: tmpl.command })
      .first();
    if (!existing) {
      const maxOrder = await db('processes').where('project_id', project.id).max('sort_order as max');
      await db('processes').insert({
        project_id: project.id,
        label: tmpl.label,
        command: tmpl.command,
        sort_order: (maxOrder[0]?.max || 0) + 1,
      });
    }
  }

  const processes = await db('processes').where('project_id', project.id).orderBy('sort_order', 'asc');
  res.json({ project, processes });
});

// Set default process for a project
router.put('/projects/:id/default-process', async (req, res) => {
  const db = getDB();
  const { processId } = req.body;
  if (!processId) return res.status(400).json({ error: 'processId is required' });

  // Verify process belongs to this project
  const proc = await db('processes').where({ id: processId, project_id: req.params.id }).first();
  if (!proc) return res.status(404).json({ error: 'Process not found in this project' });

  await db('projects').where('id', req.params.id).update({ default_process_id: processId });
  const project = await db('projects').where('id', req.params.id).first();
  res.json({ project });
});

// Toggle favorite
router.put('/projects/:id/favorite', async (req, res) => {
  const db = getDB();
  const { favorite } = req.body;
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).json({ error: 'Project not found' });
  await db('projects').where('id', req.params.id).update({ is_favorite: !!favorite });
  const updated = await db('projects').where('id', req.params.id).first();
  res.json({ project: updated });
});

// Get favorites
router.get('/favorites', async (req, res) => {
  const db = getDB();
  const projects = await db('projects').where('is_favorite', true).orderBy('name');
  res.json({ projects });
});

// Get favorited processes (pinned commands)
router.get('/favorites/processes', async (req, res) => {
  const db = getDB();
  const processes = await db('processes')
    .join('projects', 'processes.project_id', 'projects.id')
    .where('processes.is_favorite', true)
    .select('processes.*', 'projects.name as project_name', 'projects.type as project_type')
    .orderBy('projects.name')
    .orderBy('processes.sort_order');
  res.json({ processes });
});

// Toggle process favorite
router.put('/processes/:id/favorite', async (req, res) => {
  const db = getDB();
  const { favorite } = req.body;
  const proc = await db('processes').where('id', req.params.id).first();
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  await db('processes').where('id', req.params.id).update({ is_favorite: !!favorite });
  const updated = await db('processes').where('id', req.params.id).first();
  res.json({ process: updated });
});

// Get app types config
router.get('/settings/app-types', async (req, res) => {
  const types = await getAppTypes();
  res.json({ types });
});

// Update app types config
router.put('/settings/app-types', async (req, res) => {
  const db = getDB();
  const { types } = req.body;
  if (!Array.isArray(types)) return res.status(400).json({ error: 'types must be an array' });
  await db('settings').where('key', 'app_types').update({ value: JSON.stringify(types) });
  res.json({ types, ok: true });
});

// Start process
router.post('/processes/:id/start', async (req, res) => {
  try {
    await startProcess(parseInt(req.params.id));
    const db = getDB();
    const proc = await db('processes').where('id', parseInt(req.params.id)).first();
    res.json(proc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Stop process
router.post('/processes/:id/stop', async (req, res) => {
  try {
    await stopProcess(parseInt(req.params.id));
    const db = getDB();
    const proc = await db('processes').where('id', parseInt(req.params.id)).first();
    res.json(proc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add process manually
router.post('/processes', async (req, res) => {
  const db = getDB();
  const { project_id, label, command, port } = req.body;
  if (!project_id || !label || !command) return res.status(400).json({ error: 'All fields required' });

  // Check port uniqueness
  if (port) {
    const existing = await db('processes').where('port', port).first();
    if (existing) return res.status(400).json({ error: `Port ${port} already in use by process #${existing.id}` });
  }

  const maxOrder = await db('processes').where('project_id', project_id).max('sort_order as max');
  const result = await db('processes').insert({
    project_id, label, command, port: port || null,
    sort_order: (maxOrder[0]?.max || 0) + 1,
  });
  const proc = await db('processes').where('id', result[0]).first();
  res.json(proc);
});

// Reorder processes
router.post('/projects/:id/reorder', async (req, res) => {
  const db = getDB();
  const { order } = req.body;
  if (!order) return res.status(400).json({ error: 'No order data' });

  const ids = order.split(',').map(Number);
  for (let i = 0; i < ids.length; i++) {
    await db('processes').where('id', ids[i]).update({ sort_order: i });
  }
  res.json({ ok: true });
});

// Get process logs
router.get('/processes/:id/log', async (req, res) => {
  const logs = await getLogs(parseInt(req.params.id));
  res.json(logs);
});

// SSE stream for real-time log updates
router.get('/processes/:id/log/stream', (req, res) => {
  const processId = parseInt(req.params.id);
  log('INFO', `SSE stream requested for process ${processId}`);

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send current state
    const logs = processLogs.get(processId);
    const running = runningProcesses.has(processId);
    const allLines = logs ? logs.lines : [];
    const initData = JSON.stringify({ lines: allLines, status: running ? 'running' : 'stopped' });
    res.write(`event: init\ndata: ${initData}\n\n`);

    // Subscribe for future updates
    subscribeSSE(processId, res);

  // Cleanup on disconnect
  req.on('close', () => {
    log('INFO', `SSE client disconnected for process ${processId}`);
    unsubscribeSSE(processId, res);
  });

  req.on('error', (err) => {
    log('ERROR', `SSE error for process ${processId}`, { message: err.message });
    unsubscribeSSE(processId, res);
  });
  } catch (err) {
    log('ERROR', `SSE setup error for process ${processId}`, { message: err.message });
  }
});

// Clear process logs
router.post('/processes/:id/clear-logs', (req, res) => {
  try {
    clearLogs(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Send input to process
router.post('/processes/:id/input', (req, res) => {
  try {
    sendInput(parseInt(req.params.id), req.body.input || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all running processes (with project info)
router.get('/processes/running', async (req, res) => {
  const db = getDB();
  const processes = await db('processes')
    .join('projects', 'processes.project_id', 'projects.id')
    .where('processes.status', 'running')
    .select('processes.*', 'projects.name as project_name', 'projects.type as project_type')
    .orderBy('projects.name');
  res.json({ processes });
});

// Update process
router.put('/processes/:id', async (req, res) => {
  const db = getDB();
  const proc = await db('processes').where('id', req.params.id).first();
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const { label, command, port } = req.body;

  // Check port uniqueness (if changed)
  if (port !== undefined && Number(port) !== Number(proc.port)) {
    const existing = await db('processes').where('port', port).whereNot('id', req.params.id).first();
    if (existing) return res.status(400).json({ error: `Port ${port} already in use by process #${existing.id}` });
  }

  const update = {};
  if (label !== undefined) update.label = label;
  if (command !== undefined) update.command = command;
  if (port !== undefined) update.port = port || null;

  await db('processes').where('id', req.params.id).update(update);
  const updated = await db('processes').where('id', req.params.id).first();
  res.json(updated);
});

// Delete process
router.delete('/processes/:id', async (req, res) => {
  const db = getDB();
  await db('processes').where('id', req.params.id).del();
  res.json({ ok: true });
});

// Get scan folders
router.get('/settings/folders', async (req, res) => {
  const db = getDB();
  const folders = await db('scan_folders').orderBy('path');
  res.json({ folders });
});

// Add scan folder
router.post('/settings/folders', async (req, res) => {
  const folderPath = req.body.path?.trim();
  if (!folderPath) return res.status(400).json({ error: 'Path is required' });

  try {
    await scanFolder(folderPath);
    const db = getDB();
    const folders = await db('scan_folders').orderBy('path');
    res.json({ folders });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete scan folder
router.delete('/settings/folders/:id', async (req, res) => {
  const db = getDB();
  const folder = await db('scan_folders').where('id', req.params.id).first();
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const projects = await db('projects').where('scan_folder_id', req.params.id).select('id');
  const projectIds = projects.map(p => p.id);
  if (projectIds.length > 0) {
    await db('processes').whereIn('project_id', projectIds).del();
    await db('projects').whereIn('id', projectIds).del();
  }
  await db('scan_folders').where('id', req.params.id).del();

  res.json({ ok: true });
});

// Create project manually
router.post('/create-project', async (req, res) => {
  const db = getDB();
  const { name, type, path } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type required' });

  const [id] = await db('projects').insert({ name, type, path: path || '' });
  const project = await db('projects').where('id', id).first();

  // Add default templates for the type
  const templates = await db('command_templates').where('project_type', type);
  let maxOrder = 0;
  for (const tmpl of templates) {
    maxOrder++;
    await db('processes').insert({
      project_id: id, label: tmpl.label, command: tmpl.command, sort_order: maxOrder,
    });
  }

  // If no agent templates, add default 'pi' command
  if (type === 'agent' && templates.length === 0) {
    await db('processes').insert({
      project_id: id, label: 'Pi Agent', command: 'pi', sort_order: 1,
    });
  }

  res.json(project);
});

// Re-scan all
router.post('/scan', async (req, res) => {
  await scanAllFolders();
  res.json({ ok: true });
});

module.exports = router;

// routes/api.js — JSON API for React frontend
const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { scanAllFolders, scanFolder } = require('../services/scanner');
const { startProcess, stopProcess, sendInput, getLogs, clearLogs } = require('../services/process-manager');

// Get all projects
router.get('/projects', async (req, res) => {
  const db = getDB();
  const typeFilter = req.query.type;
  let projects;
  if (typeFilter === 'app') {
    projects = await db('projects').whereIn('type', ['flutter', 'laravel']).orderBy('name');
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
  if (!['flutter', 'laravel', 'agent'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

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

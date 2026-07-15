// routes/processes.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { scanAllFolders, scanFolder } = require('../services/scanner');
const { startProcess, stopProcess, sendInput, getLogs } = require('../services/process-manager');

// Dashboard
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

// Project detail — auto-populate processes from templates
router.get('/project/:id', async (req, res) => {
  const db = getDB();
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).send('Project not found');

  // Auto-add templates as processes if not already added
  const templates = await db('command_templates').where('project_type', project.type);
  for (const tmpl of templates) {
    const existing = await db('processes')
      .where({ project_id: project.id, command: tmpl.command })
      .first();
    if (!existing) {
      const maxOrder = await db('processes').where('project_id', project.id).max('sort_order as max');
      const nextOrder = (maxOrder[0]?.max || 0) + 1;
      await db('processes').insert({
        project_id: project.id,
        label: tmpl.label,
        command: tmpl.command,
        sort_order: nextOrder,
      });
    }
  }

  const processes = await db('processes').where('project_id', project.id).orderBy('sort_order', 'asc');
  res.render('pages/project-detail', { project, processes });
});

// Start process
router.post('/process/:id/start', async (req, res) => {
  try {
    await startProcess(parseInt(req.params.id));
    const db = getDB();
    const proc = await db('processes').where('id', parseInt(req.params.id)).first();
    res.render('partials/process-status', { proc, layout: false });
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
    res.render('partials/process-status', { proc, layout: false });
  } catch (err) {
    res.status(400).send(err.message);
  }
});

// Re-scan project folder
router.post('/project/:id/scan', async (req, res) => {
  const db = getDB();
  const project = await db('projects').where('id', req.params.id).first();
  if (!project) return res.status(404).send('Project not found');

  await scanFolder(project.path);
  res.redirect(`/project/${req.params.id}`);
});

// Settings
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

  // Set sort_order to end of list
  const maxOrder = await db('processes').where('project_id', project_id).max('sort_order as max');
  const nextOrder = (maxOrder[0]?.max || 0) + 1;
  await db('processes').insert({ project_id, label, command, sort_order: nextOrder });
  res.redirect(`/project/${project_id}`);
});

// Add template command to project
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
    const maxOrder = await db('processes').where('project_id', projectId).max('sort_order as max');
    const nextOrder = (maxOrder[0]?.max || 0) + 1;
    await db('processes').insert({
      project_id: projectId,
      label: template.label,
      command: template.command,
      sort_order: nextOrder,
    });
  }

  res.redirect(`/project/${projectId}`);
});

// Trigger full re-scan
router.get('/scan', async (req, res) => {
  await scanAllFolders();
  res.redirect('/');
});

// Auto-detect running processes
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

    res.render('partials/auto-detect-results', { processes: processes.slice(0, 50), layout: false });
  } catch (err) {
    res.status(500).send('Failed to list processes');
  }
});

// Save sort order after drag & drop
router.post('/project/:id/reorder', async (req, res) => {
  const db = getDB();
  const { order } = req.body;
  if (!order) return res.status(400).send('No order data');

  const ids = order.split(',').map(Number);
  for (let i = 0; i < ids.length; i++) {
    await db('processes').where('id', ids[i]).update({ sort_order: i });
  }
  res.send('OK');
});

// Get process logs
router.get('/process/:id/log', (req, res) => {
  const logs = getLogs(parseInt(req.params.id));
  const all = [...logs.stdout, ...logs.stderr].join('');
  res.type('text/plain').send(all || 'Waiting for output...');
});

// Send input to running process
router.post('/process/:id/input', (req, res) => {
  try {
    sendInput(parseInt(req.params.id), req.body.input || '');
    res.send('OK');
  } catch (err) {
    res.status(400).send(err.message);
  }
});

module.exports = router;

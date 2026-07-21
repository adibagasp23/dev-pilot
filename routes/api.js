// routes/api.js — JSON API for React frontend
const express = require('express');
const router = express.Router();
const { getDB } = require('../database/db');
const { scanAllFolders, scanFolder } = require('../services/scanner');

// Cari full path adb — cek beberapa lokasi umum + PATH
function findAdb() {
  const candidates = [
    '/Users/adibagaspratama/Library/Android/sdk/platform-tools/adb',
    process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : '',
    process.env.ANDROID_SDK_ROOT ? `${process.env.ANDROID_SDK_ROOT}/platform-tools/adb` : '',
    'adb', // fallback ke PATH
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      if (c === 'adb' || fs.existsSync(c)) return c;
    } catch {}
  }
  return 'adb';
}
const ADB = findAdb();
const { startProcess, stopProcess, sendInput, getLogs, clearLogs, subscribeSSE, unsubscribeSSE, processLogs, runningProcesses } = require('../services/process-manager');
const fs = require('fs');
const path = require('path');
const os = require('os');
const mime = require('mime-types');
const multer = require('multer');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads') });

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
    // Root projects: one per unique root (first path component)
    const rootMap = {};
    const roots = [];
    for (const p of projects) {
      const root = p.group_name || p.name.split('/')[0];
      if (!rootMap[root]) {
        rootMap[root] = true;
        roots.push({ name: root, projectId: p.id });
      }
    }
    return res.json({ groups: Object.values(groups), ungrouped, roots, countMap });
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

  // Find sibling projects (same parent folder or same group)
  let siblings = [];
  if (project.path) {
    const parentDir = path.dirname(project.path);
    let query = db('projects')
      .orderBy('type', 'name')
      .select('id', 'name', 'type');

    if (project.group_name) {
      // Use group_name for explicit grouping (e.g., standalone projects)
      query = query.where('group_name', project.group_name);
    } else {
      // Fallback: projects under same parent directory
      query = query.where('path', 'like', parentDir + '/%');
    }

    const folderProjects = await query;
    siblings = folderProjects.map(p => ({
      ...p,
      is_active: p.id === project.id
    }));
  }

  res.json({ project, processes, siblings });
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

// Stop all running processes
router.post('/processes/stop-all', async (req, res) => {
  try {
    const db = getDB();
    const running = await db('processes').where('status', 'running');
    for (const proc of running) {
      await stopProcess(proc.id);
    }
    res.json({ stopped: running.length });
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

// Get recent APK files from known projects
router.get('/push-apk-files', async (req, res) => {
  const db = getDB();
  const projects = await db('projects').where('type', 'flutter').orderBy('name');
  const groups = [];
  for (const p of projects) {
    const apkDir = path.join(p.path, 'build', 'app', 'outputs', 'flutter-apk');
    try {
      if (fs.existsSync(apkDir)) {
        let files = fs.readdirSync(apkDir)
          .filter(f => f.endsWith('.apk') || f.endsWith('.aab'))
          .map(f => ({ name: f, path: path.join(apkDir, f), mtime: fs.statSync(path.join(apkDir, f)).mtimeMs }));
        // Also check bundle/ subdirs for .aab
        const bundleDir = path.join(p.path, 'build', 'app', 'outputs', 'bundle');
        if (fs.existsSync(bundleDir)) {
          for (const flavor of fs.readdirSync(bundleDir)) {
            const flavorDir = path.join(bundleDir, flavor);
            if (fs.statSync(flavorDir).isDirectory()) {
              for (const f of fs.readdirSync(flavorDir).filter(f => f.endsWith('.aab'))) {
                const fp = path.join(flavorDir, f);
                files.push({ name: f, path: fp, mtime: fs.statSync(fp).mtimeMs });
              }
            }
          }
        }
        files.sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          groups.push({
            project: p.name.replace(/^~\//, ''),
            latestMtime: files[0].mtime,
            files: files.map(f => ({ path: f.path, name: f.name, time: new Date(f.mtime).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }))
          });
        }
      }
    } catch {}
  }
  groups.sort((a, b) => b.latestMtime - a.latestMtime);
  res.json({ groups });
});

// Get connected ADB devices
router.get('/adb-devices', async (req, res) => {
  const { execSync } = require('child_process');
  try {
    const output = execSync(ADB + ' devices', { encoding: 'utf8', timeout: 5000 });
    const devices = output.split('\n')
      .slice(1)
      .filter(l => l.includes('\tdevice') || l.includes('\toffline') || l.includes('\tunauthorized'))
      .map(l => {
        const [id, status] = l.split('\t');
        return { id, status: status.trim() };
      });

    // Ambil model name untuk device yang connected
    for (const d of devices) {
      if (d.status === 'device') {
        try {
          const model = execSync(ADB + ` -s ${d.id} shell getprop ro.product.model 2>/dev/null`, { encoding: 'utf8', timeout: 3000 }).trim().replace(/\r/g, '');
          if (model) d.model = model;
        } catch {}
      }
    }

    res.json({ devices });
  } catch (err) {
    res.json({ devices: [], error: err.message });
  }
});

// Scan network for ADB devices (port 5555)
router.post('/adb-scan', async (req, res) => {
  const { execSync } = require('child_process');
  const os = require('os');

  try {
    // Dapetin IP lokal + subnet
    const interfaces = os.networkInterfaces();
    let localIp = '';
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal && name.startsWith('en')) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp) break;
    }

    if (!localIp) {
      // fallback: pake hostname -I atau ipconfig
      try {
        localIp = execSync('ipconfig getifaddr en0', { encoding: 'utf8', timeout: 3000 }).trim();
      } catch {}
    }

    if (!localIp) {
      return res.json({ devices: [], error: 'Gagal deteksi IP lokal' });
    }

    const subnet = localIp.substring(0, localIp.lastIndexOf('.') + 1);

    // Ping scan parallel
    const tmpDir = os.tmpdir();
    const pingFile = `${tmpDir}/adb_ping_${Date.now()}`;
    const portFile = `${tmpDir}/adb_port_${Date.now()}`;

    // Ping semua IP di subnet (parallel)
    const pingScript = `
for i in $(seq 1 254); do
  (ping -c1 -W1 ${subnet}$i >/dev/null 2>&1 && echo $i >> ${pingFile}) &
  if [ \$((i % 20)) -eq 0 ]; then wait; fi
done
wait
`;
    execSync(pingScript, { timeout: 15000, shell: '/bin/bash' });

    // Baca hasil ping
    let activeHosts = [];
    try {
      const data = fs.readFileSync(pingFile, 'utf8').trim();
      activeHosts = data.split('\n').filter(Boolean);
    } catch {}
    try { fs.unlinkSync(pingFile); } catch {}

    if (activeHosts.length === 0) {
      return res.json({ devices: [], hosts: 0 });
    }

    // Cek port 5555 parallel via node
    const net = require('net');
    const adbHosts = [];

    await Promise.all(activeHosts.map(async (num) => {
      const ip = subnet + num;
      try {
        await new Promise((resolve, reject) => {
          const sock = new net.Socket();
          sock.setTimeout(1000);
          sock.on('connect', () => { sock.destroy(); resolve(undefined); });
          sock.on('error', reject);
          sock.on('timeout', reject);
          sock.connect(5555, ip);
        });
        adbHosts.push(ip);
      } catch {}
    }));

    try { fs.unlinkSync(portFile); } catch {}

    // Ambil hostname dari ARP
    let arpOutput = '';
    try { arpOutput = execSync('arp -a -n 2>/dev/null || arp -a 2>/dev/null', { encoding: 'utf8', timeout: 3000 }); } catch {}

    const devices = adbHosts.map(ip => {
      const match = arpOutput.match(new RegExp(ip.replace(/\./g, '\\.') + '.*'));
      const hostname = match ? match[0].split(' ')[0].replace(/\(.*\)/, '').trim() : '—';
      return { id: ip, status: 'discovered', hostname };
    });

    res.json({ devices, hosts: activeHosts.length });
  } catch (err) {
    res.json({ devices: [], error: err.message });
  }
});

// Connect to ADB device via WiFi
router.post('/adb-connect', async (req, res) => {
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ error: 'IP required' });

  const { execSync } = require('child_process');
  try {
    // Disconnect dulu (ignore error kalo belum connect)
    try { execSync(ADB + ' disconnect ' + ip, { timeout: 3000, shell: '/bin/bash' }); } catch {}
    const result = execSync(ADB + ' connect ' + ip + ':5555', { encoding: 'utf8', timeout: 10000, shell: '/bin/bash' });
    const ok = result.toLowerCase().includes('connected');
    res.json({ ok, output: result.trim() });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Disconnect all ADB devices
router.post('/adb-disconnect-all', async (req, res) => {
  const { execSync } = require('child_process');
  try {
    execSync(ADB + ' disconnect', { timeout: 5000 });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// Push APK to ADB device (by path or file upload)
router.post('/push-apk', upload.single('apk'), async (req, res) => {
  const { spawn, execSync } = require('child_process');
  let apkPath = '';
  let apkName = '';
  const deviceId = req.body.device || '';
  const targetDir = req.body.target || '/sdcard/Android/';

  // Prioritaskan file upload
  if (req.file) {
    apkPath = req.file.path;
    apkName = req.file.originalname;
  } else if (req.body.path) {
    const p = req.body.path.replace(/^~/, require('os').homedir());
    if (!fs.existsSync(p)) return res.status(400).json({ error: 'File not found: ' + p });
    apkPath = p;
    apkName = path.basename(p);
  } else {
    return res.status(400).json({ error: 'Provide apk path or upload file' });
  }

  log('INFO', 'Pushing APK', { device: deviceId, apk: apkName });

  try {
    let finalDevice = deviceId;
    if (!finalDevice) {
      const output = execSync(ADB + ' devices', { encoding: 'utf8', timeout: 5000 });
      const lines = output.split('\n').filter(l => l.includes('\tdevice'));
      if (lines.length === 0) return res.status(400).json({ error: 'No ADB device connected' });
      finalDevice = lines[0].split('\t')[0];
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Buat direktori target
    res.write('📁 Membuat direktori ' + targetDir + '...\n');
    try {
      execSync(ADB + ' -s ' + finalDevice + ' shell mkdir -p "' + targetDir + '"', { timeout: 5000 });
      res.write('✅ Direktori siap\n');
    } catch (e) {
      res.write('⚠️ Gagal buat direktori: ' + e.message + '\n');
    }

    res.write('🚀 Push ' + apkName + ' ke ' + finalDevice + ':' + targetDir + '\n');

    // Spawn ADB push untuk streaming output
    const child = spawn(ADB, ['-s', finalDevice, 'push', apkPath, targetDir]);
    let fullOutput = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      fullOutput += text;
      res.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      fullOutput += text;
      res.write(text);
    });

    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          res.write('\n✅ Push selesai: ' + apkName + '\n');
          resolve(undefined);
        } else {
          res.write('\n❌ Push gagal (exit code ' + code + ')\n');
          reject(new Error('Exit code ' + code));
        }
      });
      child.on('error', (err) => {
        res.write('\n❌ Error: ' + err.message + '\n');
        reject(err);
      });
    });

    // Bersihin upload temp file
    if (req.file) { try { fs.unlinkSync(apkPath); } catch {} }
    log('INFO', 'Push success', { device: finalDevice, apk: apkName });
    res.end();
  } catch (err) {
    log('ERROR', 'Push failed', { error: err.message });
    if (req.file) { try { fs.unlinkSync(apkPath); } catch {} }
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write('\n❌ ' + err.message + '\n');
      res.end();
    }
  }
});


// Tasks API
router.get('/tasks', async (req, res) => {
  try {
    const db = getDB();
    let query = db('tasks as t')
      .leftJoin('projects as p', 'p.id', 't.project_id')
      .select('t.*', 'p.name as project_name', 'p.path as project_path');

    if (req.query.project_id) {
      query = query.where('t.project_id', parseInt(req.query.project_id));
    }
    if (req.query.status) {
      query = query.where('t.status', req.query.status);
    }

    const tasks = await query.orderBy('t.sort_order', 'asc');
    res.json({ tasks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/tasks', async (req, res) => {
  try {
    const db = getDB();
    const { title, project_id, priority, due_date } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    // Get max sort_order for this status
    const maxOrder = await db('tasks').where('status', 'todo').max('sort_order as max');
    const insert = {
      title,
      project_id: project_id || null,
      priority: priority || 'medium',
      status: 'todo',
      sort_order: (maxOrder[0]?.max || -1) + 1,
    };
    if (due_date !== undefined) insert.due_date = due_date || null;
    const [id] = await db('tasks').insert(insert);
    const task = await db('tasks').where('id', id).first();
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/tasks/:id', async (req, res) => {
  try {
    const db = getDB();
    const { title, status, priority, project_id, due_date, description } = req.body;
    const update = { updated_at: db.fn.now() };
    if (title !== undefined) update.title = title;
    if (status !== undefined) update.status = status;
    if (priority !== undefined) update.priority = priority;
    if (project_id !== undefined) update.project_id = project_id;
    if (due_date !== undefined) update.due_date = due_date || null;
    if (description !== undefined) update.description = description;
    await db('tasks').where('id', req.params.id).update(update);
    const task = await db('tasks').where('id', req.params.id).first();
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/tasks/:id', async (req, res) => {
  try {
    const db = getDB();
    await db('tasks').where('id', req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /tasks/reorder — reorder tasks by status
router.post('/tasks/reorder', async (req, res) => {
  try {
    const db = getDB();
    const { status, taskIds } = req.body;
    if (!status || !Array.isArray(taskIds)) return res.status(400).json({ error: 'Invalid data' });
    for (let i = 0; i < taskIds.length; i++) {
      await db('tasks').where('id', taskIds[i]).update({ sort_order: i, status });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Task Statuses ---
router.get('/task-statuses', async (req, res) => {
  try {
    const db = getDB();
    const statuses = await db('task_statuses').orderBy('sort_order', 'asc');
    res.json({ statuses });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/task-statuses', async (req, res) => {
  try {
    const db = getDB();
    const { name, sort_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const finalSortOrder = parseInt(sort_order, 10);
    const [id] = await db('task_statuses').insert({
      name: name.trim(),
      sort_order: isNaN(finalSortOrder) ? 0 : finalSortOrder,
    });
    const status = await db('task_statuses').where('id', id).first();
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/task-statuses/:id', async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const { name, sort_order } = req.body;
    if (name !== undefined && !name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (sort_order !== undefined) update.sort_order = sort_order;
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No fields to update' });
    update.updated_at = db.fn.now();
    await db('task_statuses').where('id', id).update(update);
    const status = await db('task_statuses').where('id', id).first();
    res.json({ status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/task-statuses/:id', async (req, res) => {
  try {
    const db = getDB();
    const { id } = req.params;
    const status = await db('task_statuses').where('id', id).first();
    if (!status) return res.status(404).json({ error: 'Status not found' });
    const statusKey = status.name.toLowerCase().replace(/\s+/g, '_');
    const taskCount = await db('tasks').where('status', statusKey).count('id as c').first();
    if (taskCount.c > 0) return res.status(400).json({ error: `Cannot delete: ${taskCount.c} task(s) use this status` });
    await db('task_statuses').where('id', id).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ======== MEDIA / ASSET LIBRARY ========

// GET /media — list all media items
router.get('/media', async (req, res) => {
  try {
    const db = getDB();
    let query = db('media_items').orderBy('created_at', 'desc');
    if (req.query.project_id) {
      query = query.where('project_id', parseInt(req.query.project_id));
    }
    const items = await query;
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /media/upload — upload a file
router.post('/media/upload', upload.single('file'), async (req, res) => {
  let tempPath = '';
  try {
    const db = getDB();
    const project_id = req.body.project_id ? parseInt(req.body.project_id) : null;

    let originalname, filename, mimetype, size;

    if (req.body.localPath) {
      // Move file from local filesystem (localhost only)
      const localPath = req.body.localPath.replace(/^~/, os.homedir());
      if (!fs.existsSync(localPath)) return res.status(400).json({ error: 'File not found at path' });
      const stat = fs.statSync(localPath);
      originalname = path.basename(localPath);
      filename = originalname;
      mimetype = mime.lookup(localPath) || 'application/octet-stream';
      size = stat.size;
      tempPath = localPath;
    } else {
      // Regular upload from browser
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      originalname = req.file.originalname;
      filename = req.file.filename;
      mimetype = req.file.mimetype;
      size = req.file.size;
      tempPath = path.join(__dirname, '..', 'uploads', filename);
    }

    // Move file to project subfolder (root uploads/ if no project)
    const subdir = project_id ? String(project_id) : '';
    const destDir = path.join(__dirname, '..', 'uploads', subdir);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, originalname);
    // Avoid overwrite: add suffix if exists
    let finalPath = destPath;
    let finalName = originalname;
    let counter = 1;
    const ext = path.extname(originalname);
    const base = path.basename(originalname, ext);
    while (fs.existsSync(finalPath)) {
      finalName = `${base}_${counter}${ext}`;
      finalPath = path.join(destDir, finalName);
      counter++;
    }
    fs.renameSync(tempPath, finalPath);

    // Store relative path as filename
    const storedPath = subdir ? `${subdir}/${finalName}` : finalName;
    const [id] = await db('media_items').insert({
      filename: storedPath,
      original_name: finalName,
      mime_type: mimetype,
      size,
      project_id,
    });
    const item = await db('media_items').where('id', id).first();
    // Clean up temp file if still exists (safety) — relevance for browser uploads
    try { if (fs.existsSync(tempPath) && !req.body.localPath) fs.unlinkSync(tempPath); } catch {}
    res.json({ item });
  } catch (e) {
    // Clean up temp file on error too (only for browser uploads)
    try { if (fs.existsSync(tempPath) && !req.body.localPath) fs.unlinkSync(tempPath); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// DELETE /media/:id — delete a media item
router.delete('/media/:id', async (req, res) => {
  try {
    const db = getDB();
    const item = await db('media_items').where('id', req.params.id).first();
    if (!item) return res.status(404).json({ error: 'Not found' });
    // Delete file from disk
    const filePath = path.join(__dirname, '..', 'uploads', item.filename);
    try { fs.unlinkSync(filePath); } catch {}
    await db('media_items').where('id', req.params.id).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /media/open/:id — open file with default system app (WPS, etc.)
router.post('/media/open/:id', async (req, res) => {
  try {
    const db = getDB();
    const item = await db('media_items').where('id', req.params.id).first();
    if (!item) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(__dirname, '..', 'uploads', item.filename);
    const cmd = process.platform === 'win32'
      ? `start "" "${filePath}"`
      : `open "${filePath}"`;
    require('child_process').exec(cmd, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /media/batch-delete — delete multiple media items
router.post('/media/batch-delete', async (req, res) => {
  try {
    const db = getDB();
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    const items = await db('media_items').whereIn('id', ids);
    for (const item of items) {
      const filePath = path.join(__dirname, '..', 'uploads', item.filename);
      try { fs.unlinkSync(filePath); } catch {}
    }
    await db('media_items').whereIn('id', ids).delete();
    res.json({ success: true, deleted: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /media/batch-move — move multiple media items to a project
router.put('/media/batch-move', async (req, res) => {
  try {
    const db = getDB();
    const { ids, project_id } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    const items = await db('media_items').whereIn('id', ids);
    const targetProjectId = project_id ? parseInt(project_id) : null;
    const subdir = targetProjectId ? String(targetProjectId) : '';
    const destDir = path.join(__dirname, '..', 'uploads', subdir);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    for (const item of items) {
      const ext = path.extname(item.original_name);
      const base = path.basename(item.original_name, ext);
      let finalName = item.original_name;
      let finalPath = path.join(destDir, finalName);
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        finalName = `${base}_${counter}${ext}`;
        finalPath = path.join(destDir, finalName);
        counter++;
      }
      const oldPath = path.join(__dirname, '..', 'uploads', item.filename);
      try { fs.renameSync(oldPath, finalPath); } catch {}
      const storedPath = subdir ? `${subdir}/${finalName}` : finalName;
      await db('media_items').where('id', item.id).update({
        filename: storedPath,
        original_name: finalName,
        project_id: targetProjectId,
      });
    }
    res.json({ success: true, moved: ids.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Remote Config Run ──
router.post('/remote-config/run', async (req, res) => {
  try {
    const {
      mode,            // baseline | optional | force | custom
      suffix,          // _dev | ''
      target_version,  // untuk optional/force
      android_min, android_latest, ios_min, ios_latest,  // untuk custom
      android_store_url, ios_store_url,
      update_title, update_message,
    } = req.body;

    if (!mode) {
      return res.status(400).json({ error: 'mode wajib diisi' });
    }

    const scriptPath = path.join(process.env.HOME || '/Users/adibagaspratama', 'kit/tms/danareksa/tms-v.2/scripts/remote-config-update.sh');
    const env = {
      ...process.env,
      RC_TARGET_VERSION: target_version || '',
      RC_ANDROID_MIN: android_min || '',
      RC_ANDROID_LATEST: android_latest || '',
      RC_IOS_MIN: ios_min || '',
      RC_IOS_LATEST: ios_latest || '',
      RC_ANDROID_STORE_URL: android_store_url || '',
      RC_IOS_STORE_URL: ios_store_url || '',
      RC_UPDATE_TITLE: update_title || '',
      RC_UPDATE_MESSAGE: update_message || '',
      PROCESS_MANAGER_URL: 'http://localhost:9876',
    };

    const { spawn } = require('child_process');
    const child = spawn('bash', [scriptPath, 'tms-v2-cf453', mode, suffix || '', '-y'], {
      cwd: path.dirname(scriptPath),
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      res.json({
        code,
        success: code === 0,
        stdout,
        stderr,
      });
    });

    child.on('error', (err) => {
      res.status(500).json({ error: err.message });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Remote Config History ──
router.get('/remote-config-history/:projectId', async (req, res) => {
  try {
    const db = getDB();
    const rows = await db('remote_config_history')
      .where('project_id', req.params.projectId)
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ history: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/remote-config-history', async (req, res) => {
  try {
    const db = getDB();
    const { project_id, mode, suffix, android_min, android_latest, ios_min, ios_latest, status, error_message } = req.body;
    if (!project_id || !mode) {
      return res.status(400).json({ error: 'project_id dan mode wajib diisi' });
    }
    const [id] = await db('remote_config_history').insert({
      project_id, mode, suffix: suffix || '',
      android_min, android_latest, ios_min, ios_latest,
      status: status || 'success',
      error_message: error_message || null,
    });
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Remote Config Templates (Draft → Review → Publish) ──

// Create/save a template (draft)
// Sync current RC from Firebase (fill form with current values)
router.get('/remote-config/sync/:projectId', async (req, res) => {
  try {
    const rcConfig = require('../config');
    const apiKey = rcConfig.remoteConfig.apiKey;
    const endpoint = rcConfig.remoteConfig.endpoint;
    const env = req.query.env || 'dev';

    // Pick the right backend based on environment
    const backendUrl = env === 'dev' ? rcConfig.remoteConfig.devBackendUrl : rcConfig.remoteConfig.prodBackendUrl;

    const fetchBackend = async (url) => {
      const response = await fetch(`${url}${endpoint}`, {
        headers: { 'X-API-Key': apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''} dari ${url}${endpoint}`);
      const data = await response.json();
      return data.data || null;
    };

    let data;
    try {
      data = await fetchBackend(backendUrl);
    } catch (fetchErr) {
      const host = env === 'dev' ? 'localhost:8003' : 'kibumn.co.id';
      return res.status(502).json({ error: `${fetchErr.message}`, unreachable: true });
    }

    if (!data) {
      const host = env === 'dev' ? 'localhost:8003' : 'kibumn.co.id';
      return res.status(502).json({ error: `Server ${host} tidak mengembalikan data`, unreachable: true });
    }

    // Extract prod (no suffix) and dev (_dev suffix) values from the same backend
    // Mendukung format lama (android_minimum_version/ios_minimum_version) dan baru (minimum_version)
    const extractProd = (d) => ({
      android_min: d?.android_minimum_version || d?.minimum_version || '',
      android_latest: d?.android_latest_version || d?.latest_version || '',
      ios_min: d?.ios_minimum_version || d?.minimum_version || '',
      ios_latest: d?.ios_latest_version || d?.latest_version || '',
      android_store_url: d?.android_store_url || '',
      ios_store_url: d?.ios_store_url || '',
      update_title: d?.update_title || d?.android_update_title || d?.ios_update_title || '',
      update_message: d?.update_message || d?.android_update_message || d?.ios_update_message || '',
    });

    const extractDev = (d) => ({
      android_min: d?.['android_minimum_version_dev'] || d?.minimum_version_dev || d?.android_minimum_version || d?.minimum_version || '',
      android_latest: d?.['android_latest_version_dev'] || d?.latest_version_dev || d?.android_latest_version || d?.latest_version || '',
      ios_min: d?.['ios_minimum_version_dev'] || d?.minimum_version_dev || d?.ios_minimum_version || d?.minimum_version || '',
      ios_latest: d?.['ios_latest_version_dev'] || d?.latest_version_dev || d?.ios_latest_version || d?.latest_version || '',
      android_store_url: d?.['android_store_url_dev'] || d?.android_store_url || '',
      ios_store_url: d?.['ios_store_url_dev'] || d?.ios_store_url || '',
      update_title: d?.['update_title_dev'] || d?.update_title || d?.android_update_title || d?.ios_update_title || '',
      update_message: d?.['update_message_dev'] || d?.update_message || d?.android_update_message || d?.ios_update_message || '',
    });

    res.json({
      sync: {
        dev: extractDev(data),
        prod: extractProd(data),
      },
      version: data?.latest_version || data?.android_latest_version || data?.latest_version_dev || data?.['android_latest_version_dev'] || null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Gagal sync dari backend: ' + e.message });
  }
});

router.post('/remote-config/templates', async (req, res) => {
  try {
    const db = getDB();
    const {
      project_id, name, mode, suffix,
      target_version, android_min, android_latest,
      ios_min, ios_latest, android_store_url, ios_store_url,
      update_title, update_message,
    } = req.body;

    if (!project_id || !mode) {
      return res.status(400).json({ error: 'project_id dan mode wajib diisi' });
    }

    // Build params_json for review
    const params = {
      mode,
      suffix: suffix || '',
    };
    if (mode === 'optional' || mode === 'force') params.target_version = target_version || '';
    if (mode === 'custom') {
      params.android_min = android_min || '';
      params.android_latest = android_latest || '';
      params.ios_min = ios_min || '';
      params.ios_latest = ios_latest || '';
    }
    if (android_store_url) params.android_store_url = android_store_url;
    if (ios_store_url) params.ios_store_url = ios_store_url;
    if (update_title) params.update_title = update_title;
    if (update_message) params.update_message = update_message;

    const [id] = await db('remote_config_templates').insert({
      project_id,
      name: name || `Template ${new Date().toLocaleString('id-ID')}`,
      mode,
      suffix: suffix || '',
      target_version: target_version || null,
      android_min: android_min || null,
      android_latest: android_latest || null,
      ios_min: ios_min || null,
      ios_latest: ios_latest || null,
      android_store_url: android_store_url || null,
      ios_store_url: ios_store_url || null,
      update_title: update_title || null,
      update_message: update_message || null,
      params_json: JSON.stringify(params),
      status: 'draft',
    });

    const template = await db('remote_config_templates').where('id', id).first();
    res.json({ template });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List templates for a project
router.get('/remote-config/templates/:projectId', async (req, res) => {
  try {
    const db = getDB();
    const rows = await db('remote_config_templates')
      .where('project_id', req.params.projectId)
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({ templates: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single template
router.get('/remote-config/template/:id', async (req, res) => {
  try {
    const db = getDB();
    const row = await db('remote_config_templates').where('id', req.params.id).first();
    if (!row) return res.status(404).json({ error: 'Template tidak ditemukan' });
    res.json({ template: row });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update template
router.put('/remote-config/template/:id', async (req, res) => {
  try {
    const db = getDB();
    const {
      name, mode, suffix,
      target_version, android_min, android_latest,
      ios_min, ios_latest, android_store_url, ios_store_url,
      update_title, update_message,
    } = req.body;

    const existing = await db('remote_config_templates').where('id', req.params.id).first();
    if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
    if (existing.status === 'published') {
      return res.status(400).json({ error: 'Template sudah dipublish, tidak bisa diedit' });
    }

    const updateData = { updated_at: db.fn.now() };
    if (name !== undefined) updateData.name = name;
    if (mode !== undefined) updateData.mode = mode;
    if (suffix !== undefined) updateData.suffix = suffix;
    if (target_version !== undefined) updateData.target_version = target_version;
    if (android_min !== undefined) updateData.android_min = android_min;
    if (android_latest !== undefined) updateData.android_latest = android_latest;
    if (ios_min !== undefined) updateData.ios_min = ios_min;
    if (ios_latest !== undefined) updateData.ios_latest = ios_latest;
    if (android_store_url !== undefined) updateData.android_store_url = android_store_url;
    if (ios_store_url !== undefined) updateData.ios_store_url = ios_store_url;
    if (update_title !== undefined) updateData.update_title = update_title;
    if (update_message !== undefined) updateData.update_message = update_message;

    // Rebuild params_json
    const params = { mode: updateData.mode || existing.mode, suffix: updateData.suffix ?? existing.suffix };
    const m = params.mode;
    const tv = updateData.target_version ?? existing.target_version;
    if (m === 'optional' || m === 'force') params.target_version = tv || '';
    if (m === 'custom') {
      params.android_min = (updateData.android_min ?? existing.android_min) || '';
      params.android_latest = (updateData.android_latest ?? existing.android_latest) || '';
      params.ios_min = (updateData.ios_min ?? existing.ios_min) || '';
      params.ios_latest = (updateData.ios_latest ?? existing.ios_latest) || '';
    }
    const asu = updateData.android_store_url ?? existing.android_store_url;
    if (asu) params.android_store_url = asu;
    const isu = updateData.ios_store_url ?? existing.ios_store_url;
    if (isu) params.ios_store_url = isu;
    const ut = updateData.update_title ?? existing.update_title;
    if (ut) params.update_title = ut;
    const um = updateData.update_message ?? existing.update_message;
    if (um) params.update_message = um;
    updateData.params_json = JSON.stringify(params);

    await db('remote_config_templates').where('id', req.params.id).update(updateData);
    const template = await db('remote_config_templates').where('id', req.params.id).first();
    res.json({ template });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete template
router.delete('/remote-config/template/:id', async (req, res) => {
  try {
    const db = getDB();
    const existing = await db('remote_config_templates').where('id', req.params.id).first();
    if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
    await db('remote_config_templates').where('id', req.params.id).del();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Build config JSON from template
function buildConfigFromTemplate(t) {
  const suffix = t.suffix || '';
  const makeParam = (base, val) => {
    const key = suffix ? `${base}${suffix}` : base;
    const pair = {};
    pair[key] = val || '';
    return pair;
  };

  let config = {};
  const ver = t.mode === 'custom'
    ? { min: t.android_min || '', latest: t.android_latest || '' }
    : { min: t.target_version || '', latest: t.target_version || '' };

  // Kirim unified keys (baru)
  Object.assign(config, makeParam('minimum_version', ver.min));
  Object.assign(config, makeParam('latest_version', ver.latest));

  // Kirim platform-specific keys (lama) agar kompatibel dengan master
  Object.assign(config, makeParam('android_minimum_version', ver.min));
  Object.assign(config, makeParam('android_latest_version', ver.latest));
  Object.assign(config, makeParam('ios_minimum_version', ver.min));
  Object.assign(config, makeParam('ios_latest_version', ver.latest));

  // Unified title/message (baru)
  Object.assign(config, makeParam('update_title', t.update_title));
  Object.assign(config, makeParam('update_message', t.update_message));

  // Platform-specific title/message (lama, untuk kompatibilitas master)
  Object.assign(config, makeParam('android_update_title', t.update_title));
  Object.assign(config, makeParam('android_update_message', t.update_message));
  Object.assign(config, makeParam('ios_update_title', t.update_title));
  Object.assign(config, makeParam('ios_update_message', t.update_message));

  // Store URLs (tetap platform-specific)
  Object.assign(config, makeParam('android_store_url', t.android_store_url));
  Object.assign(config, makeParam('ios_store_url', t.ios_store_url));

  return config;
}

// ── Public API: Flutter app fetches version config from here (no auth) ──
router.get('/app-config/:slug', async (req, res) => {
  try {
    const db = getDB();
    const vc = await db('version_configs').where('slug', req.params.slug).first();
    if (!vc) {
      return res.json({ config: {} });
    }
    res.json({ config: JSON.parse(vc.config_json) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Publish template (Backend only — no Firebase)
// Simple semver compare: returns -1 if a < b, 0 if a == b, 1 if a > b
function compareSemver(a, b) {
  const pa = (a || '0.0.0').split('.').map(Number);
  const pb = (b || '0.0.0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

router.post('/remote-config/template/:id/publish', async (req, res) => {
  try {
    const db = getDB();
    const existing = await db('remote_config_templates').where('id', req.params.id).first();
    if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });

    // Determine version from template
    const newVersion = existing.mode === 'custom'
      ? (existing.android_latest || existing.ios_latest || '')
      : (existing.target_version || '');

    if (!newVersion) {
      return res.status(400).json({ error: 'Versi tidak boleh kosong' });
    }

    // Check against last published version for the same env
    const slug = 'tms-v2';
    const lastVc = await db('version_configs').where('slug', slug).first();
    if (lastVc) {
      const lastConfig = JSON.parse(lastVc.config_json);
      // Use suffix-derived key to compare same environment
      const suffix = existing.suffix || '';
      const lastKey = `latest_version${suffix}`;
      const lastVersion = lastConfig[lastKey] || '';
      if (lastVersion) {
        const cmp = compareSemver(newVersion, lastVersion);
        if (cmp <= 0) {
          return res.status(400).json({
            error: `Versi ${newVersion} tidak valid. Versi ${suffix ? 'Dev' : 'Prod'} terakhir: ${lastVersion}. Gunakan versi yang lebih baru.`,
            lastVersion,
            newVersion,
            suffix,
          });
        }
      }
    }

    // Build config JSON from template
    const config = buildConfigFromTemplate(existing);
    const configJson = JSON.stringify(config);

    // Project ID 16 = TMS v.2
    const projectId = existing.project_id;

    // Upsert into version_configs
    const existingVc = await db('version_configs').where('slug', slug).first();
    if (existingVc) {
      await db('version_configs').where('slug', slug).update({
        config_json: configJson,
        published_at: db.raw("CURRENT_TIMESTAMP"),
        template_id: existing.id,
      });
    } else {
      await db('version_configs').insert({
        project_id: projectId,
        slug,
        config_json: configJson,
        published_at: db.raw("CURRENT_TIMESTAMP"),
        template_id: existing.id,
      });
    }

    // Update template status
    await db('remote_config_templates').where('id', req.params.id).update({
      status: 'published',
      published_at: db.raw("CURRENT_TIMESTAMP"),
      updated_at: db.raw("CURRENT_TIMESTAMP"),
    });

    // Record in history
    const [historyId] = await db('remote_config_history').insert({
      project_id: existing.project_id,
      mode: existing.mode,
      suffix: existing.suffix || '',
      android_min: existing.android_min || existing.target_version,
      android_latest: existing.android_latest || existing.target_version,
      ios_min: existing.ios_min || existing.target_version,
      ios_latest: existing.ios_latest || existing.target_version,
      android_store_url: existing.android_store_url,
      ios_store_url: existing.ios_store_url,
      update_title: existing.update_title,
      update_message: existing.update_message,
      status: 'success',
      error_message: null,
    });

    await db('remote_config_templates').where('id', req.params.id).update({ history_id: historyId });

    // ── Push ke Backend API ──
    const rcConfig = require('../config');
    // Environment determined from template's stored suffix
    const env = (existing.suffix || '') === '_dev' ? 'dev' : 'prod';
    const backendUrl = env === 'dev' ? rcConfig.remoteConfig.devBackendUrl : rcConfig.remoteConfig.prodBackendUrl;
    const apiKey = rcConfig.remoteConfig.apiKey;
    const endpoint = rcConfig.remoteConfig.endpoint;

    let backendResult = null;
    try {
      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(10000),
      });
      backendResult = await response.json();
    } catch (backendErr) {
      backendResult = {
        error: backendErr.message,
        status: 'failed',
      };
    }

    res.json({
      success: true,
      code: 0,
      templateId: existing.id,
      status: 'published',
      config,
      backendResult,
      message: '✅ Template berhasil dipublish ke backend',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

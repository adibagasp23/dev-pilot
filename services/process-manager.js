// services/process-manager.js
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDB } = require('../database/db');

// Kill a process and all its descendants recursively
function killProcessTree(pid, signal = 'SIGTERM') {
  try {
    // Get all child PIDs recursively
    const children = getChildPids(pid);
    // Kill children first (deepest first via reverse)
    for (const childPid of children.reverse()) {
      try { process.kill(childPid, signal); } catch {}
    }
    // Kill the parent
    try { process.kill(pid, signal); } catch {}
  } catch {}
}

function getChildPids(pid) {
  const result = [];
  try {
    const out = execSync(`pgrep -P ${pid}`, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString().trim();
    if (!out) return result;
    const pids = out.split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    for (const childPid of pids) {
      result.push(childPid);
      // Recursively get grandchildren
      const grandChildren = getChildPids(childPid);
      result.push(...grandChildren);
    }
  } catch {}
  return result;
}

// Kill any remaining processes related to a project (orphans)
function killProjectProcesses(projectPath) {
  try {
    const ownPid = process.pid;
    // Use lsof to find processes with the project directory as cwd (reliable, no self-match)
    const out = execSync(
      `lsof +d "${projectPath}" -t 2>/dev/null`,
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
    ).toString().trim();
    if (!out) return;
    const pids = out.split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p !== ownPid);
    if (pids.length === 0) return;
    for (const pid of pids) {
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
    // SIGKILL orphans after 3s
    setTimeout(() => {
      try {
        const out2 = execSync(
          `lsof +d "${projectPath}" -t 2>/dev/null`,
          { stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }
        ).toString().trim();
        if (!out2) return;
        const pids2 = out2.split('\n').map(p => parseInt(p.trim())).filter(p => !isNaN(p) && p !== ownPid);
        for (const pid of pids2) {
          try { process.kill(pid, 'SIGKILL'); } catch {}
        }
      } catch {}
    }, 3000);
  } catch {}
}

// Logger (same format as index.js)
const logFile = path.join(__dirname, '..', 'logs', 'app.log');
function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
  try { process.stdout.write(line + '\n'); } catch {}
}

function makeAnsiStripper() {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    // Strip all escape sequences more aggressively
    // Remove OSC 8 hyperlinks: \u001b]8;;...\u0007
    buf = buf.replace(/\u001b\]8;;[^\u0007]*\u0007/g, '');
    // Remove other OSC sequences: \u001b]...\u0007 or \u001b]...\u001b\\
    buf = buf.replace(/\u001b\][^\u0007\u001b]*(\u0007|\u001b\\)/g, '');
    // Remove complete CSI sequences: \u001b[<params><letter>
    buf = buf.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '');
    // Remove private sequences: \u001b[?<params><letter>, \u001b[><params><letter>
    buf = buf.replace(/\u001b\[\?[0-9;]*[a-zA-Z]/g, '');
    buf = buf.replace(/\u001b\[>[0-9;]*[a-zA-Z]/g, '');
    // Remove single-char escapes: \u001b<letter>
    buf = buf.replace(/\u001b[a-zA-Z]/g, '');
    // Remove \u0007 (BEL) characters
    buf = buf.replace(/\u0007/g, '');
    // Return the clean buffer and reset
    const result = buf;
    buf = '';
    // But keep any incomplete escape for next chunk
    const escIdx = result.lastIndexOf('\u001b');
    if (escIdx >= 0 && result.slice(escIdx).length < 20) {
      // Might be incomplete
      buf = result.slice(escIdx);
      return result.slice(0, escIdx);
    }
    return result;
  };
}

const runningProcesses = new Map();
// Store logs per process: { processId: { stdout: [...], stderr: [...] } }
const processLogs = new Map();
const MAX_LOG_LINES = 2000;

// SSE clients: Map<processId, Set<Response>>
const processSSEClients = new Map();

function subscribeSSE(processId, res) {
  if (!processSSEClients.has(processId)) {
    processSSEClients.set(processId, new Set());
  }
  processSSEClients.get(processId).add(res);
}

function unsubscribeSSE(processId, res) {
  const clients = processSSEClients.get(processId);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) processSSEClients.delete(processId);
  }
}

function notifySSEClients(processId, event, data) {
  const clients = processSSEClients.get(processId);
  if (!clients) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(msg); } catch { clients.delete(res); }
  }
}

function pushLine(logs, line, processId) {
  logs.lines.push(line);
  if (logs.lines.length > MAX_LOG_LINES) {
    logs.lines.splice(0, logs.lines.length - MAX_LOG_LINES);
  }
  // Notify SSE clients
  if (processId) notifySSEClients(processId, 'line', line);
}

async function startProcess(processId) {
  log('INFO', `startProcess(${processId})`);
  const db = getDB();
  const proc = await db('processes as p')
    .join('projects as pr', 'pr.id', 'p.project_id')
    .where('p.id', processId)
    .select('p.*', 'pr.path as project_path', 'pr.name as project_name')
    .first();

  if (!proc) throw new Error('Process not found');
  if (proc.status === 'running') throw new Error('Process already running');

  // Kill any process already using the port
  if (proc.port) {
    try {
      const { execSync } = require('child_process');
      execSync(`lsof -ti:${proc.port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch {}
  }

  // Dynamic fvm detection: if command starts with 'flutter'
  let command = proc.command;
  if (command === 'pi') {
    // Use unbuffer (from expect) to create a PTY for TUI apps
    command = 'unbuffer pi';
  }
  if (command.startsWith('flutter') && !command.startsWith('fvm ')) {
    const { execSync } = require('child_process');
    try {
      execSync('which fvm', { stdio: 'ignore' });
      execSync('fvm flutter --version 2>/dev/null', { cwd: proc.project_path, stdio: 'ignore' });
      command = 'fvm ' + command;
    } catch {}
  }

  // Replace {PORT} placeholder with actual port from DB
  if (proc.port) {
    command = command.replace(/{PORT}/g, String(proc.port));
  }

  // Wrap in SIGPIPE-ignoring shell to prevent crash when parent dies (e.g., server restart)
  const wrappedCmd = `trap '' PIPE; exec ${command}`;
  const child = spawn(wrappedCmd, [], {
    cwd: proc.project_path,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    detached: true,
  });

  const pid = child.pid;
  runningProcesses.set(processId, child);

  // Init log buffer — combined lines with stream marker
  processLogs.set(processId, { lines: [] });
  const stripper = makeAnsiStripper();

  child.stdout.on('data', (data) => {
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'o', t: stripper(data.toString()) });
  });

  child.stderr.on('data', (data) => {
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'e', t: stripper(data.toString()) });
  });

  await db('processes').where('id', processId).update({
    status: 'running',
    pid: pid,
    started_at: db.fn.now(),
    stopped_at: null,
  });

  // Notify SSE clients that process is now running
  notifySSEClients(processId, 'status', { status: 'running' });

  child.on('exit', async (code) => {
    runningProcesses.delete(processId);
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: `\n⚠ Process exited with code ${code}\n` }, processId);
    await db('processes').where('id', processId).update({
      status: code === 0 ? 'stopped' : 'error',
      pid: null,
      stopped_at: db.fn.now(),
    });
    notifySSEClients(processId, 'status', { status: code === 0 ? 'stopped' : 'error' });
  });

  child.on('error', async (err) => {
    log('ERROR', `Process error (${processId})`, { message: err.message });
    runningProcesses.delete(processId);
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: `\n⚠ Failed to start: ${err.message}\n` });
    await db('processes').where('id', processId).update({ status: 'error' });
  });

  return { pid, status: 'running' };
}

// Send input to a running process (stdin)
function sendInput(processId, input) {
  const child = runningProcesses.get(processId);
  if (!child) throw new Error('Process not running');
  child.stdin.write(input + '\n');

  // Echo input to logs so frontend can see it
  const logs = processLogs.get(processId);
  if (logs) {
    pushLine(logs, { s: 'i', t: '❯ ' + input + '\n' });
  }
}

// Get logs for a process — returns combined lines in chronological order
async function getLogs(processId) {
  const logs = processLogs.get(processId);
  const running = runningProcesses.has(processId);
  let status = running ? 'running' : null;
  if (!status) {
    const db = getDB();
    const proc = await db('processes').where('id', processId).select('status').first();
    status = proc ? proc.status : 'stopped';
  }
  return { lines: logs ? logs.lines : [], status };
}

// Clear logs for a process
function clearLogs(processId) {
  // Reset log buffer, bukan delete — biar output baru tetap tertangkap
  const existing = processLogs.get(processId);
  if (existing) {
    existing.lines = [];
  } else {
    processLogs.set(processId, { lines: [] });
  }
}

async function stopProcess(processId) {
  log('INFO', `stopProcess(${processId})`);
  const db = getDB();
  const proc = await db('processes as p')
    .join('projects as pr', 'pr.id', 'p.project_id')
    .where('p.id', processId)
    .select('p.*', 'pr.path as project_path')
    .first();

  if (!proc) throw new Error('Process not found');
  if (proc.status !== 'running') throw new Error('Process is not running');

  const child = runningProcesses.get(processId);
  if (child) {
    // Kill entire process tree recursively
    await killProcessTree(child.pid, 'SIGTERM');
    // Also kill orphaned processes related to this project
    killProjectProcesses(proc.project_path);
    // Fallback: SIGKILL after 5s
    setTimeout(async () => {
      try { await killProcessTree(child.pid, 'SIGKILL'); } catch {}
    }, 5000);
    runningProcesses.delete(processId);
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: '\n⚠ Process stopped by user\n' }, processId);
  } else if (proc.pid) {
    try { process.kill(proc.pid, 'SIGINT'); } catch {}
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: '\n⚠ Process stopped by user\n' }, processId);
  }

  await db('processes').where('id', processId).update({
    status: 'stopped',
    pid: null,
    stopped_at: db.fn.now(),
  });

  // Notify SSE clients about status change
  notifySSEClients(processId, 'status', { status: 'stopped' });

  // Kill any process still holding the port
  if (proc.port) {
    try {
      const { execSync } = require('child_process');
      execSync(`lsof -ti:${proc.port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch {}
  }

  return { status: 'stopped' };
}

async function getProcessStatus(processId) {
  const db = getDB();
  return db('processes').where('id', processId).first();
}

function cleanup() {
  for (const [id, child] of runningProcesses) {
    killProcessTree(child.pid, 'SIGTERM');
  }
  runningProcesses.clear();
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

module.exports = { startProcess, stopProcess, getProcessStatus, sendInput, getLogs, clearLogs, cleanup, subscribeSSE, unsubscribeSSE, notifySSEClients, processSSEClients, processLogs, runningProcesses };

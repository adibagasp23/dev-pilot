// services/process-manager.js
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDB } = require('../database/db');
const stripAnsi = require('strip-ansi').default;

// Logger (same format as index.js)
const logFile = path.join(__dirname, '..', 'logs', 'app.log');
function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try { fs.appendFileSync(logFile, line + '\n'); } catch {}
  try { process.stdout.write(line + '\n'); } catch {}
}

const runningProcesses = new Map();
// Store logs per process: { processId: { stdout: [...], stderr: [...] } }
const processLogs = new Map();
const MAX_LOG_LINES = 2000;

function pushLine(logs, line) {
  logs.lines.push(line);
  if (logs.lines.length > MAX_LOG_LINES) {
    logs.lines.splice(0, logs.lines.length - MAX_LOG_LINES);
  }
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

  const child = spawn(command, [], {
    cwd: proc.project_path,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  const pid = child.pid;
  runningProcesses.set(processId, child);

  // Init log buffer — combined lines with stream marker
  processLogs.set(processId, { lines: [] });

  child.stdout.on('data', (data) => {
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'o', t: stripAnsi(data.toString()) });
  });

  child.stderr.on('data', (data) => {
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'e', t: stripAnsi(data.toString()) });
  });

  await db('processes').where('id', processId).update({
    status: 'running',
    pid: pid,
    started_at: db.fn.now(),
    stopped_at: null,
  });

  child.on('exit', async (code) => {
    runningProcesses.delete(processId);
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: `\n⚠ Process exited with code ${code}\n` });
    await db('processes').where('id', processId).update({
      status: code === 0 ? 'stopped' : 'error',
      pid: null,
      stopped_at: db.fn.now(),
    });
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
  processLogs.delete(processId);
}

async function stopProcess(processId) {
  log('INFO', `stopProcess(${processId})`);
  const db = getDB();
  const proc = await db('processes').where('id', processId).first();

  if (!proc) throw new Error('Process not found');
  if (proc.status !== 'running') throw new Error('Process is not running');

  const child = runningProcesses.get(processId);
  if (child) {
    // Send SIGINT (like Ctrl+C) to the process group
    try { process.kill(-child.pid, 'SIGINT'); } catch {
      try { process.kill(child.pid, 'SIGINT'); } catch {}
    }
    runningProcesses.delete(processId);
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: '\n⚠ Process stopped by user\n' });
  } else if (proc.pid) {
    try { process.kill(proc.pid, 'SIGINT'); } catch {}
    const logs = processLogs.get(processId);
    if (logs) pushLine(logs, { s: 'i', t: '\n⚠ Process stopped by user\n' });
  }

  await db('processes').where('id', processId).update({
    status: 'stopped',
    pid: null,
    stopped_at: db.fn.now(),
  });

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
    try { process.kill(-child.pid, 'SIGTERM'); } catch {
      try { process.kill(child.pid, 'SIGTERM'); } catch {}
    }
  }
  runningProcesses.clear();
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });

module.exports = { startProcess, stopProcess, getProcessStatus, sendInput, getLogs, clearLogs, cleanup };

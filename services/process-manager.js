// services/process-manager.js
const { spawn } = require('child_process');
const { getDB } = require('../database/db');

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

  const child = spawn(proc.command, [], {
    cwd: proc.project_path,
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

// services/backup.js
const fs = require('fs');
const path = require('path');
const config = require('../config');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_BACKUPS = 5; // Keep last 14 days

function getDbPath() {
  const conn = config.database.connection;
  if (typeof conn === 'object' && conn.filename) {
    return conn.filename;
  }
  return null; // Non-file based DB (postgres/mysql)
}

function getDateStr() {
  const d = new Date();
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
}

function getBackupFilename() {
  return `process-manager-${getDateStr()}.db`;
}

function getBackupPath() {
  return path.join(BACKUP_DIR, getBackupFilename());
}

function getLogFile() {
  return path.join(__dirname, '..', 'logs', 'app.log');
}

function log(level, msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  try { fs.appendFileSync(getLogFile(), line + '\n'); } catch {}
  try { process.stdout.write(line + '\n'); } catch {}
}

function backup() {
  const dbPath = getDbPath();
  if (!dbPath) {
    log('INFO', 'Backup skipped – non-file database');
    return false;
  }

  const dest = getBackupPath();

  // Check if today's backup already exists
  if (fs.existsSync(dest)) {
    log('INFO', `Backup already exists for today: ${getBackupFilename()}`);
    return false;
  }

  try {
    // Ensure backup dir exists
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Copy database file
    fs.copyFileSync(dbPath, dest);

    // Verify
    const srcStat = fs.statSync(dbPath);
    const dstStat = fs.statSync(dest);
    if (srcStat.size !== dstStat.size) {
      throw new Error(`Size mismatch: source ${srcStat.size} vs backup ${dstStat.size}`);
    }

    log('INFO', `Backup created: ${getBackupFilename()} (${(dstStat.size / 1024 / 1024).toFixed(2)} MB)`);

    // Cleanup old backups
    cleanup();

    return true;
  } catch (err) {
    log('ERROR', `Backup failed: ${err.message}`);
    return false;
  }
}

function cleanup() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('process-manager-') && f.endsWith('.db'))
      .sort()
      .reverse();

    if (files.length > MAX_BACKUPS) {
      const toRemove = files.slice(MAX_BACKUPS);
      for (const f of toRemove) {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        log('INFO', `Removed old backup: ${f}`);
      }
    }
  } catch (err) {
    log('ERROR', `Backup cleanup failed: ${err.message}`);
  }
}

function listBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return [];
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('process-manager-') && f.endsWith('.db'))
      .sort()
      .reverse()
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          date: f.replace('process-manager-', '').replace('.db', ''),
          size: stat.size,
          created: stat.birthtime,
        };
      });
  } catch {
    return [];
  }
}

module.exports = { backup, listBackups, getBackupPath };

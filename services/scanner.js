// services/scanner.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getDB } = require('../database/db');

const HOME_DIR = os.homedir();

function toRelativePath(absPath) {
  if (absPath.startsWith(HOME_DIR)) {
    return '~' + absPath.slice(HOME_DIR.length);
  }
  return absPath;
}

function detectProjectType(folderPath) {
  const files = fs.readdirSync(folderPath);
  if (files.includes('pubspec.yaml')) return 'flutter';
  if (files.includes('artisan')) return 'laravel';
  if (files.includes('next.config.ts') || files.includes('next.config.js') || files.includes('next.config.mjs')) return 'laravel';
  return 'other';
}

async function addProject(db, fullPath, type, scanFolderId, scanAbsPath, found) {
  const relativeName = toRelativePath(fullPath);
  const groupName = path.basename(scanAbsPath);
  const existing = await db('projects').where('path', fullPath).first();
  if (existing) {
    await db('projects').where('id', existing.id).update({ name: relativeName, last_scanned: db.fn.now(), group_name: groupName });
    found.push({ id: existing.id, name: relativeName, path: fullPath, type });
  } else {
    const [id] = await db('projects').insert({
      name: relativeName, path: fullPath, type, scan_folder_id: scanFolderId, group_name: groupName,
    });
    found.push({ id, name: relativeName, path: fullPath, type });
  }
}

async function scanFolder(folderPath) {
  const db = getDB();
  const absPath = path.resolve(folderPath);

  if (!fs.existsSync(absPath)) {
    return { error: `Folder not found: ${absPath}`, projects: [] };
  }

  let row = await db('scan_folders').where('path', absPath).first();
  if (!row) {
    const [id] = await db('scan_folders').insert({ path: absPath });
    row = { id };
  }
  const scanFolderId = row.id;

  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  const found = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(absPath, entry.name);
    let type = detectProjectType(fullPath);

    if (type !== 'other') {
      await addProject(db, fullPath, type, scanFolderId, absPath, found);
    } else {
      // Check one level deeper
      const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isDirectory()) continue;
        const subPath = path.join(fullPath, sub.name);
        const subType = detectProjectType(subPath);
        if (subType !== 'other') {
          await addProject(db, subPath, subType, scanFolderId, absPath, found);
        }
      }
    }
  }

  return { error: null, projects: found };
}

async function scanAllFolders() {
  const db = getDB();
  const folders = await db('scan_folders').select('*');
  const results = [];
  for (const folder of folders) {
    results.push(await scanFolder(folder.path));
  }
  return results;
}

module.exports = { detectProjectType, scanFolder, scanAllFolders };

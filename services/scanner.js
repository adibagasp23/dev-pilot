// services/scanner.js
const fs = require('fs');
const path = require('path');
const { getDB } = require('../database/db');

function detectProjectType(folderPath) {
  const files = fs.readdirSync(folderPath);
  if (files.includes('pubspec.yaml')) return 'flutter';
  if (files.includes('artisan')) return 'laravel';
  return 'other';
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
    const type = detectProjectType(fullPath);
    if (type === 'other') continue;

    const existing = await db('projects').where('path', fullPath).first();
    if (existing) {
      await db('projects').where('id', existing.id).update({ last_scanned: db.fn.now() });
      found.push({ id: existing.id, name: entry.name, path: fullPath, type });
    } else {
      const [id] = await db('projects').insert({
        name: entry.name, path: fullPath, type, scan_folder_id: scanFolderId,
      });
      found.push({ id, name: entry.name, path: fullPath, type });
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

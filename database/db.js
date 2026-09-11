// database/db.js
const knex = require('knex');
const path = require('path');
const config = require('../config');

let db;

function getDB() {
  if (!db) {
    const opts = {
      client: config.database.client,
      connection: config.database.connection,
      migrations: {
        directory: path.join(__dirname, 'migrations'),
      },
    };
    // useNullAsDefault hanya untuk SQLite
    if (config.database.client === 'better-sqlite3') {
      opts.useNullAsDefault = true;
    }
    db = knex(opts);
  }
  return db;
}

async function migrate() {
  const dbInstance = getDB();
  await dbInstance.migrate.latest();
  console.log('Migrations up to date');
}

module.exports = { getDB, migrate };

// database/db.js
const knex = require('knex');
const path = require('path');
const config = require('../config');

let db;

function getDB() {
  if (!db) {
    db = knex({
      client: config.database.client,
      connection: config.database.connection,
      useNullAsDefault: true,
      migrations: {
        directory: path.join(__dirname, 'migrations'),
      },
    });
  }
  return db;
}

async function migrate() {
  const db = getDB();
  await db.migrate.latest();
  console.log('Migrations up to date');
}

module.exports = { getDB, migrate };

const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const tableExists = await db.schema.hasTable('remote_config_history');
  if (tableExists) {
    const cols = await db('remote_config_history').columnInfo();
    if (!cols.android_store_url) {
      // Use raw SQL to avoid knex lock issues with alter table
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN android_store_url TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN ios_store_url TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN update_title TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN update_message TEXT');
    }
  }
};

exports.down = async function () {
  // SQLite doesn't support DROP COLUMN easily, skip
};

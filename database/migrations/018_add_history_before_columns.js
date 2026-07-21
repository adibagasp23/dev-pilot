const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const tableExists = await db.schema.hasTable('remote_config_history');
  if (tableExists) {
    const cols = await db('remote_config_history').columnInfo();
    if (!cols.before_android_min) {
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN before_android_min TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN before_android_latest TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN before_ios_min TEXT');
      await db.raw('ALTER TABLE remote_config_history ADD COLUMN before_ios_latest TEXT');
    }
  }
};

exports.down = async function () {
  // SQLite — skip
};

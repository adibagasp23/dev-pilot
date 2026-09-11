exports.up = async function (knex) {
  const tableExists = await knex.schema.hasTable('remote_config_history');
  if (tableExists) {
    const cols = await knex('remote_config_history').columnInfo();
    if (!cols.before_android_min) {
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN before_android_min TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN before_android_latest TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN before_ios_min TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN before_ios_latest TEXT');
    }
  }
};

exports.down = async function () {
  // Skip
};

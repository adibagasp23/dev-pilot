exports.up = async function (knex) {
  const tableExists = await knex.schema.hasTable('remote_config_history');
  if (tableExists) {
    const cols = await knex('remote_config_history').columnInfo();
    if (!cols.android_store_url) {
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN android_store_url TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN ios_store_url TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN update_title TEXT');
      await knex.raw('ALTER TABLE remote_config_history ADD COLUMN update_message TEXT');
    }
  }
};

exports.down = async function () {
  // Skip — drop column is complex in both engines
};

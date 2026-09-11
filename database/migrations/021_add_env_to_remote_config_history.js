exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('remote_config_history', 'env');
  if (!hasCol) {
    await knex.schema.table('remote_config_history', (table) => {
      table.string('env', 20).nullable();
    });
  }
};

exports.down = async function (knex) {
  const hasCol = await knex.schema.hasColumn('remote_config_history', 'env');
  if (hasCol) {
    await knex.schema.table('remote_config_history', (table) => {
      table.dropColumn('env');
    });
  }
};

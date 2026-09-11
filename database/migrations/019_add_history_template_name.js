exports.up = async function (knex) {
  const tableExists = await knex.schema.hasTable('remote_config_history');
  if (tableExists) {
    const cols = await knex('remote_config_history').columnInfo();
    if (!cols.template_name) {
      await knex.schema.table('remote_config_history', (table) => {
        table.text('template_name');
      });
    }
  }
};

exports.down = async function () {
  // Skip
};

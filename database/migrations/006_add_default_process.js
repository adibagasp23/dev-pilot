exports.up = async function (knex) {
  // Check if column already exists to make migration idempotent
  const hasColumn = await knex.schema.hasColumn('projects', 'default_process_id');
  if (!hasColumn) {
    await knex.schema.alterTable('projects', (table) => {
      table.integer('default_process_id').references('id').inTable('processes').onDelete('SET NULL');
    });
  }
};

exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn('projects', 'default_process_id');
  if (hasColumn) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropColumn('default_process_id');
    });
  }
};

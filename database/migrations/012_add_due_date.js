// database/migrations/012_add_due_date.js
exports.up = async function (knex) {
  const exists = await knex.schema.hasColumn('tasks', 'due_date');
  if (!exists) {
    await knex.schema.table('tasks', (table) => {
      table.timestamp('due_date').nullable();
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.table('tasks', (table) => {
    table.dropColumn('due_date');
  });
};

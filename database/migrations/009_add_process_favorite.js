// database/migrations/009_add_process_favorite.js
exports.up = async function (knex) {
  const hasCol = await knex.schema.hasColumn('processes', 'is_favorite');
  if (!hasCol) {
    await knex.schema.table('processes', (table) => {
      table.boolean('is_favorite').defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.table('processes', (table) => {
    table.dropColumn('is_favorite');
  });
};

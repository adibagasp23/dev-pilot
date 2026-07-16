// database/migrations/007_add_favorite.js
exports.up = async function (knex) {
  // Check if column already exists (idempotent)
  const hasCol = await knex.schema.hasColumn('projects', 'is_favorite');
  if (!hasCol) {
    await knex.schema.table('projects', (table) => {
      table.boolean('is_favorite').defaultTo(false);
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.table('projects', (table) => {
    table.dropColumn('is_favorite');
  });
};

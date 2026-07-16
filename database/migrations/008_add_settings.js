// database/migrations/008_add_settings.js
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('settings');
  if (!exists) {
    await knex.schema.createTable('settings', (table) => {
      table.string('key').primary();
      table.text('value');
    });
    // Seed default app types
    await knex('settings').insert({ key: 'app_types', value: JSON.stringify(['flutter', 'laravel', 'next', 'rust']) });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('settings');
};

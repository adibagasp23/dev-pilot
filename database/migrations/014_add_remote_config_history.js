exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('remote_config_history');
  if (!exists) {
    await knex.schema.createTable('remote_config_history', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('CASCADE');
      table.string('mode', 20).notNull();
      table.string('suffix', 10).defaultTo('');
      table.string('android_min', 20).nullable();
      table.string('android_latest', 20).nullable();
      table.string('ios_min', 20).nullable();
      table.string('ios_latest', 20).nullable();
      table.string('status', 20).defaultTo('success');
      table.text('error_message').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('remote_config_history');
};

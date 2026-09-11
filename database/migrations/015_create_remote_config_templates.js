exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('remote_config_templates');
  if (!exists) {
    await knex.schema.createTable('remote_config_templates', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('CASCADE');
      table.string('name', 255).notNull().defaultTo('');
      table.string('mode', 20).notNull();
      table.string('suffix', 10).defaultTo('');
      table.string('target_version', 20).nullable();
      table.string('android_min', 20).nullable();
      table.string('android_latest', 20).nullable();
      table.string('ios_min', 20).nullable();
      table.string('ios_latest', 20).nullable();
      table.text('android_store_url').nullable();
      table.text('ios_store_url').nullable();
      table.string('update_title', 255).nullable();
      table.text('update_message').nullable();
      table.text('params_json').nullable();
      table.string('status', 20).defaultTo('draft');
      table.timestamp('created_at').defaultTo(knex.raw("CURRENT_TIMESTAMP"));
      table.timestamp('updated_at').defaultTo(knex.raw("CURRENT_TIMESTAMP"));
      table.timestamp('published_at').nullable();
      table.integer('history_id').unsigned().nullable();
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('remote_config_templates');
};

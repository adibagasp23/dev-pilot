exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('version_configs');
  if (!exists) {
    await knex.schema.createTable('version_configs', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned();
      table.string('slug', 100);
      table.text('config_json').notNull();
      table.timestamp('created_at').defaultTo(knex.raw("CURRENT_TIMESTAMP"));
      table.timestamp('published_at').nullable();
      table.integer('template_id').unsigned().nullable();
    });
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_slug ON version_configs(slug)');
    await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_project ON version_configs(project_id)');
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('version_configs');
};

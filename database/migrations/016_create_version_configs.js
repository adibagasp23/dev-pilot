const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const exists = await db.schema.hasTable('version_configs');
  if (!exists) {
    await db.schema.createTable('version_configs', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned();
      table.string('slug', 100);
      table.text('config_json').notNull();
      table.timestamp('created_at').defaultTo(db.raw("CURRENT_TIMESTAMP"));
      table.timestamp('published_at').nullable();
      table.integer('template_id').unsigned().nullable();
    });
    // Add unique indexes after table creation to avoid lock issues
    await db.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_slug ON version_configs(slug)');
    await db.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_project ON version_configs(project_id)');
  }
};

exports.down = async function () {
  const db = getDB();
  await db.schema.dropTableIfExists('version_configs');
};

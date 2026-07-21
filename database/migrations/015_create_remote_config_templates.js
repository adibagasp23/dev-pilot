const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const exists = await db.schema.hasTable('remote_config_templates');
  if (!exists) {
    // better-sqlite3 has issues with db.fn.now() in defaultTo, use raw directly
    await db.schema.createTable('remote_config_templates', (table) => {
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
      table.timestamp('created_at').defaultTo(db.raw("CURRENT_TIMESTAMP"));
      table.timestamp('updated_at').defaultTo(db.raw("CURRENT_TIMESTAMP"));
      table.timestamp('published_at').nullable();
      table.integer('history_id').unsigned().nullable();
    });
  }
};

exports.down = async function () {
  const db = getDB();
  await db.schema.dropTableIfExists('remote_config_templates');
};

const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const exists = await db.schema.hasTable('remote_config_history');
  if (!exists) {
    await db.schema.createTable('remote_config_history', (table) => {
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
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
  }
};

exports.down = async function () {
  const db = getDB();
  await db.schema.dropTableIfExists('remote_config_history');
};

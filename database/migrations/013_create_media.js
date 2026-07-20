const { getDB } = require('../db');

exports.up = async function () {
  const db = getDB();
  const exists = await db.schema.hasTable('media_items');
  if (!exists) {
    await db.schema.createTable('media_items', (table) => {
      table.increments('id').primary();
      table.integer('project_id').references('id').inTable('projects').onDelete('SET NULL').nullable();
      table.string('filename').notNullable();
      table.string('original_name').notNullable();
      table.string('mime_type').notNullable();
      table.integer('size').notNullable().defaultTo(0);
      table.timestamps(true, true);
    });
  }
};

exports.down = async function () {
  const db = getDB();
  await db.schema.dropTableIfExists('media_items');
};

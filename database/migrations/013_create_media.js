exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('media_items');
  if (!exists) {
    await knex.schema.createTable('media_items', (table) => {
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

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('media_items');
};

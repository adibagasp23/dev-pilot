// database/migrations/010_add_tasks.js
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('tasks');
  if (!exists) {
    await knex.schema.createTable('tasks', (table) => {
      table.increments('id').primary();
      table.integer('project_id').unsigned().nullable().references('id').inTable('projects').onDelete('SET NULL');
      table.string('title').notNullable();
      table.text('description').nullable();
      table.string('status').defaultTo('todo'); // todo, in_progress, done
      table.string('priority').defaultTo('medium'); // low, medium, high
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tasks');
};

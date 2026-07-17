// database/migrations/011_add_task_statuses.js
exports.up = async function(knex) {
  await knex.schema.createTable('task_statuses', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });

  // Seed default statuses
  const count = await knex('task_statuses').count('id as c').first();
  if (count.c === 0) {
    await knex('task_statuses').insert([
      { name: 'Todo', sort_order: 0 },
      { name: 'In Progress', sort_order: 1 },
      { name: 'Done', sort_order: 2 },
    ]);
  }
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('task_statuses');
};

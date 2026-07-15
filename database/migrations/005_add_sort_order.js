// database/migrations/005_add_sort_order.js
exports.up = async function(knex) {
  await knex.schema.table('processes', (table) => {
    table.integer('sort_order').defaultTo(0);
  });
};

exports.down = async function(knex) {
  await knex.schema.table('processes', (table) => {
    table.dropColumn('sort_order');
  });
};

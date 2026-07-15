// database/migrations/001_create_tables.js
exports.up = function(knex) {
  return knex.schema
    .createTable('scan_folders', (table) => {
      table.increments('id').primary();
      table.string('path').notNullable().unique();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('projects', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('path').notNullable().unique();
      table.enu('type', ['flutter', 'laravel', 'other']).notNullable();
      table.integer('scan_folder_id').references('id').inTable('scan_folders');
      table.timestamp('last_scanned').defaultTo(knex.fn.now());
    })
    .createTable('command_templates', (table) => {
      table.increments('id').primary();
      table.string('project_type').notNullable();
      table.string('label').notNullable();
      table.string('command').notNullable();
    })
    .createTable('processes', (table) => {
      table.increments('id').primary();
      table.integer('project_id').references('id').inTable('projects');
      table.string('label').notNullable();
      table.string('command').notNullable();
      table.enu('status', ['running', 'stopped', 'error']).defaultTo('stopped');
      table.integer('pid');
      table.integer('port');
      table.string('log_path');
      table.timestamp('started_at');
      table.timestamp('stopped_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('processes')
    .dropTableIfExists('command_templates')
    .dropTableIfExists('projects')
    .dropTableIfExists('scan_folders');
};

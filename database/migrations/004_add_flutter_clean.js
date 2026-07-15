// database/migrations/004_add_flutter_clean.js
exports.up = async function(knex) {
  const existing = await knex('command_templates')
    .where({ project_type: 'flutter', command: 'flutter clean' })
    .first();
  if (!existing) {
    await knex('command_templates').insert({
      project_type: 'flutter',
      label: 'Flutter Clean',
      command: 'flutter clean',
    });
  }
};

exports.down = async function(knex) {
  await knex('command_templates')
    .where({ project_type: 'flutter', command: 'flutter clean' })
    .del();
};

exports.up = async function(knex) {
  const command = {
    project_type: 'flutter',
    label: 'Remote Config Update',
    command: 'bash scripts/remote-config-update.sh',
  };

  const existing = await knex('command_templates')
    .where({ project_type: command.project_type, command: command.command })
    .first();

  if (!existing) {
    await knex('command_templates').insert(command);
  }
};

exports.down = async function(knex) {
  await knex('command_templates')
    .where({ project_type: 'flutter', command: 'bash scripts/remote-config-update.sh' })
    .del();
};

exports.up = async function (knex) {
  // 1. Add env column
  const hasCol = await knex.schema.hasColumn('remote_config_templates', 'env');
  if (!hasCol) {
    await knex.schema.table('remote_config_templates', (table) => {
      table.string('env', 20).nullable();
    });
  }

  // 2. Migrate data: suffix → env
  await knex('remote_config_templates')
    .where('suffix', '_dev')
    .update({ env: 'dev' });
  await knex('remote_config_templates')
    .where('suffix', '_dev-server')
    .orWhere('suffix', '_devsv')
    .update({ env: 'dev-server' });
  // Everything else (suffix = '' or null) → 'prod'
  await knex('remote_config_templates')
    .whereNull('env')
    .update({ env: 'prod' });

  // 3. Drop suffix column
  const hasSuffix = await knex.schema.hasColumn('remote_config_templates', 'suffix');
  if (hasSuffix) {
    await knex.schema.table('remote_config_templates', (table) => {
      table.dropColumn('suffix');
    });
  }
};

exports.down = async function (knex) {
  const hasSuffix = await knex.schema.hasColumn('remote_config_templates', 'suffix');
  if (!hasSuffix) {
    await knex.schema.table('remote_config_templates', (table) => {
      table.string('suffix', 10).defaultTo('');
    });
  }

  // Rollback data
  await knex('remote_config_templates')
    .where('env', 'dev')
    .update({ suffix: '_dev' });
  await knex('remote_config_templates')
    .where('env', 'dev-server')
    .update({ suffix: '_dev' });
  await knex('remote_config_templates')
    .where('env', 'prod')
    .update({ suffix: '' });

  await knex.schema.table('remote_config_templates', (table) => {
    table.dropColumn('env');
  });
};

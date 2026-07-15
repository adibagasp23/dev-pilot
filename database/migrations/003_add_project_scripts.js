// database/migrations/003_add_project_scripts.js
exports.up = async function(knex) {
  // Flutter script-based commands (khusus project KSI)
  const flutterScripts = [
    { project_type: 'flutter', label: 'Run Dev (Mobile)', command: 'bash run-dev.sh' },
    { project_type: 'flutter', label: 'Run Dev (Web)', command: 'bash run-dev-web.sh' },
    { project_type: 'flutter', label: 'Run Prod (Mobile)', command: 'bash run-prodv2.sh' },
    { project_type: 'flutter', label: 'Run Prod (Web)', command: 'bash run-prodv2-web.sh' },
    { project_type: 'flutter', label: 'Build Web', command: 'bash build.sh dev' },
    { project_type: 'flutter', label: 'Build Web (Prod)', command: 'bash build.sh prod' },
    { project_type: 'flutter', label: 'Compile APK', command: 'bash compile-apk.sh dev' },
    { project_type: 'flutter', label: 'Compile APK (Prod)', command: 'bash compile-apk.sh prodv2' },
    { project_type: 'flutter', label: 'Serve Web', command: 'bash serve.sh' },
    { project_type: 'flutter', label: 'Stage', command: 'bash stage.sh' },
    { project_type: 'flutter', label: 'Sync Version', command: 'bash sync-version.sh' },
  ];

  for (const cmd of flutterScripts) {
    const existing = await knex('command_templates')
      .where({ project_type: cmd.project_type, command: cmd.command })
      .first();
    if (!existing) {
      await knex('command_templates').insert(cmd);
    }
  }

  // Laravel tambahan
  const laravelScripts = [
    { project_type: 'laravel', label: 'Artisan Serve', command: 'php artisan serve' },
    { project_type: 'laravel', label: 'NPM Dev', command: 'npm run dev' },
    { project_type: 'laravel', label: 'Queue Work', command: 'php artisan queue:work' },
    { project_type: 'laravel', label: 'Migrate', command: 'php artisan migrate' },
    { project_type: 'laravel', label: 'Config Cache', command: 'php artisan config:cache' },
    { project_type: 'laravel', label: 'Route List', command: 'php artisan route:list' },
  ];

  for (const cmd of laravelScripts) {
    const existing = await knex('command_templates')
      .where({ project_type: cmd.project_type, command: cmd.command })
      .first();
    if (!existing) {
      await knex('command_templates').insert(cmd);
    }
  }
};

exports.down = async function(knex) {
  await knex('command_templates')
    .whereIn('command', [
      'bash run-dev.sh', 'bash run-dev-web.sh', 'bash run-prodv2.sh',
      'bash run-prodv2-web.sh', 'bash build.sh dev', 'bash build.sh prod',
      'bash compile-apk.sh dev', 'bash compile-apk.sh prodv2',
      'bash serve.sh', 'bash stage.sh', 'bash sync-version.sh',
      'php artisan migrate', 'php artisan config:cache', 'php artisan route:list',
    ])
    .del();
};

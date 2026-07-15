// database/migrations/002_seed_templates.js
exports.up = async function(knex) {
  const count = await knex('command_templates').count('* as cnt');
  if (count[0].cnt === 0) {
    await knex('command_templates').insert([
      { project_type: 'flutter', label: 'Flutter Run', command: 'flutter run' },
      { project_type: 'flutter', label: 'Pub Get', command: 'flutter pub get' },
      { project_type: 'flutter', label: 'Build Runner', command: 'flutter pub run build_runner watch' },
      { project_type: 'laravel', label: 'Artisan Serve', command: 'php artisan serve' },
      { project_type: 'laravel', label: 'NPM Dev', command: 'npm run dev' },
      { project_type: 'laravel', label: 'Queue Work', command: 'php artisan queue:work' },
    ]);
  }
};

exports.down = function(knex) {
  return knex('command_templates').del();
};

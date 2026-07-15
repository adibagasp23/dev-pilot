// config.js
const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  
  // Database — ganti client & connection buat pake PostgreSQL/MySQL
  database: {
    client: process.env.DB_CLIENT || 'better-sqlite3',
    connection: process.env.DB_CLIENT === 'better-sqlite3'
      ? { filename: path.join(__dirname, 'database', 'process-manager.db') }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'process_manager',
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASS || 'secret',
        },
    useNullAsDefault: true,
  },

  scanFolders: [],

  commands: {
    flutter: [
      { label: 'Flutter Run', command: 'flutter run' },
      { label: 'Pub Get', command: 'flutter pub get' },
      { label: 'Build Runner', command: 'flutter pub run build_runner watch' },
    ],
    laravel: [
      { label: 'Artisan Serve', command: 'php artisan serve' },
      { label: 'NPM Dev', command: 'npm run dev' },
      { label: 'Queue Work', command: 'php artisan queue:work' },
    ],
  },
};

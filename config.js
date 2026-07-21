// config.js
const path = require('path');

module.exports = {
  port: process.env.PORT || 9876,
  
  // Database — ganti client & connection buat pake PostgreSQL/MySQL
  database: {
    client: process.env.DB_CLIENT || 'better-sqlite3',
    connection: (process.env.DB_CLIENT || 'better-sqlite3') === 'better-sqlite3'
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

  // Remote Config — backend API tujuan publish
  remoteConfig: {
    backendUrl: process.env.RC_BACKEND_URL || 'http://127.0.0.1:8003',
    prodBackendUrl: process.env.RC_PROD_BACKEND_URL || 'https://kibumn.co.id',
    devBackendUrl: process.env.RC_DEV_BACKEND_URL || 'http://127.0.0.1:8003',
    apiKey: process.env.RC_API_KEY || 'REDACTED_API_KEY',
    endpoint: '/api/remote-config',
  },

  scanFolders: [],

  commands: {
    flutter: [
      { label: 'Run Dev (Mobile)', command: 'bash run-dev.sh' },
      { label: 'Run Dev (Web)', command: 'bash run-dev-web.sh' },
      { label: 'Run Prod (Mobile)', command: 'bash run-prodv2.sh' },
      { label: 'Run Prod (Web)', command: 'bash run-prodv2-web.sh' },
      { label: 'Build Web', command: 'bash build.sh dev' },
      { label: 'Build Web (Prod)', command: 'bash build.sh prod' },
      { label: 'Compile APK', command: 'bash compile-apk.sh dev' },
      { label: 'Compile APK (Prod)', command: 'bash compile-apk.sh prodv2' },
      { label: 'Serve Web', command: 'bash serve.sh' },
      { label: 'Flutter Run', command: 'flutter run' },
      { label: 'Pub Get', command: 'flutter pub get' },
      { label: 'Flutter Clean', command: 'flutter clean' },
    ],
    laravel: [
      { label: 'Artisan Serve', command: 'php artisan serve' },
      { label: 'NPM Dev', command: 'npm run dev' },
      { label: 'Queue Work', command: 'php artisan queue:work' },
      { label: 'Migrate', command: 'php artisan migrate' },
      { label: 'Config Cache', command: 'php artisan config:cache' },
      { label: 'Route List', command: 'php artisan route:list' },
    ],
  },
};

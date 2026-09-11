// config.js
const path = require('path');

module.exports = {
  port: process.env.PORT || 9876,
  
  // Database — PostgreSQL (default) / SQLite (fallback via DB_CLIENT=better-sqlite3)
  database: {
    client: process.env.DB_CLIENT || 'pg',
    connection: (process.env.DB_CLIENT || 'pg') === 'pg'
      ? {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          database: process.env.DB_NAME || 'process_manager',
          user: process.env.DB_USER || process.env.USER || 'postgres',
          password: process.env.DB_PASS || '',
        }
      : { filename: path.join(__dirname, 'database', 'process-manager.db') },
    useNullAsDefault: (process.env.DB_CLIENT || 'pg') !== 'pg',
  },

  // Remote Config — backend API tujuan publish
  remoteConfig: {
    backendUrl: process.env.RC_BACKEND_URL || 'http://127.0.0.1:8003',
    prodBackendUrl: process.env.RC_PROD_BACKEND_URL || 'https://kibumn.co.id',
    devBackendUrl: process.env.RC_DEV_BACKEND_URL || 'http://127.0.0.1:8003',
    devServerBackendUrl: process.env.RC_DEV_SERVER_BACKEND_URL || 'https://dev-v2.kibumn.co.id',
    // API key TIDAK boleh di-hardcode. Isi lewat .env / variabel lingkungan.
    apiKey: process.env.RC_API_KEY || '',
    endpoint: '/api/remote-config',
  },

  scanFolders: [],

  commands: {
    flutter: [
      { label: 'Flutter Run', command: 'flutter run' },
      { label: 'Pub Get', command: 'flutter pub get' },
      { label: 'Build Runner', command: 'flutter pub run build_runner watch' },
      { label: 'Run Dev (Mobile)', command: 'bash run.sh dev' },
      { label: 'Run Prod (Mobile)', command: 'bash run.sh prod' },
      { label: 'Run Local (Auto IP)', command: 'bash scripts/run_dev.sh' },
      { label: 'Generate Dart Define', command: 'bash scripts/generate_dart_define.sh' },
      { label: 'ADB Connect', command: 'bash scripts/adb_connect.sh' },
      { label: 'Remote Config Update', command: 'bash scripts/remote-config-update.sh' },
      { label: 'Build APK (Debug)', command: 'flutter build apk --debug --dart-define=BASE_URL=https://nitipkuy-api.ciptaantaradigital.com' },
      { label: 'Build APK (Release)', command: 'flutter build apk --release --dart-define=BASE_URL=https://nitipkuy-api.ciptaantaradigital.com' },
      { label: 'Build iOS (Debug)', command: 'flutter build ios --debug --dart-define=BASE_URL=https://nitipkuy-api.ciptaantaradigital.com' },
      { label: 'Build iOS (Release)', command: 'flutter build ios --release --dart-define=BASE_URL=https://nitipkuy-api.ciptaantaradigital.com' },
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

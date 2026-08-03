import { strict as assert } from 'node:assert';
import { getFlutterDevice } from '../src/utils/flutterDevice.ts';

// Primary regex — Android
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on SM-A515F in debug mode...'),
  { device: 'SM-A515F', icon: '📱' }
);

// Primary regex — iOS simulator
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on iPhone 15 Pro in debug mode...'),
  { device: 'iPhone 15 Pro', icon: '🍎' }
);

// Primary regex — entry file berbeda + web
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main_dev.dart on Chrome in debug mode...'),
  { device: 'Chrome', icon: '🌐' }
);

// Primary regex — macOS desktop
assert.deepStrictEqual(
  getFlutterDevice('Launching lib/main.dart on macOS in debug mode...'),
  { device: 'macOS', icon: '🖥' }
);

// Fallback regex (primary tidak ada)
assert.deepStrictEqual(
  getFlutterDevice('Syncing files to device Pixel 7...'),
  { device: 'Pixel 7', icon: '📱' }
);

// Match terakhir dari primary yang diambil
const multi =
  'Launching lib/main.dart on SM-A515F in debug mode...\n' +
  'Launching lib/main.dart on Pixel 7 in debug mode...';
assert.deepStrictEqual(getFlutterDevice(multi), { device: 'Pixel 7', icon: '📱' });

// Tidak ada match → null
assert.strictEqual(getFlutterDevice(''), null);
assert.strictEqual(getFlutterDevice('Flutter run key commands.'), null);

console.log('✅ Semua test lulus');

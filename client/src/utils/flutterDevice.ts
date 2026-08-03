export interface FlutterDeviceInfo {
  device: string;
  icon: string;
}

export function getFlutterDevice(logText: string): FlutterDeviceInfo | null {
  if (!logText) return null;

  let device: string | null = null;
  let match: RegExpExecArray | null;

  // Primary: "Launching lib/main.dart on <device> in debug mode..."
  const launchRe = new RegExp('Launching .+? on (.+?) in (debug|profile|release) mode', 'gi');
  while ((match = launchRe.exec(logText)) !== null) {
    device = match[1].trim();
  }

  // Fallback: "Syncing files to device <device>..." (hanya jika primary tidak match)
  if (!device) {
    const syncRe = new RegExp('Syncing files to device (.+?)\\.', 'gi');
    while ((match = syncRe.exec(logText)) !== null) {
      device = match[1].trim();
    }
  }

  if (!device) return null;
  return { device, icon: deviceIcon(device) };
}

function deviceIcon(device: string): string {
  const d = device.toLowerCase();
  if (/iphone|ipad|simulator/.test(d)) return '🍎';
  if (d === 'macos' || /linux|windows/.test(d)) return '🖥';
  if (/chrome|edge|safari/.test(d)) return '🌐';
  return '📱';
}

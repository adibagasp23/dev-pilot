#!/bin/bash
# flutter-run.sh — Menjalankan flutter run dan otomatis buka DevTools
# Usage: ./flutter-run.sh [flutter-args...]

# Simpan output ke file log
LOGFILE="/tmp/flutter-run-$$.log"

# Run flutter dan simpan output
flutter run "$@" 2>&1 | tee "$LOGFILE" &

FLUTTER_PID=$!

# Fungsi untuk menunggu dan mencari DevTools URL
wait_for_devtools() {
  local timeout=30
  while [ $timeout -gt 0 ]; do
    if grep -qE 'DevTools.*https?://' "$LOGFILE" 2>/dev/null; then
      # Extract DevTools URL
      URL=$(grep -oP 'https?://[^ ]+/devtools/\?uri=ws://[^ ]+' "$LOGFILE" | head -1)
      if [ -n "$URL" ]; then
        echo ""
        echo "🔗 Membuka DevTools..."
        open "$URL"
        return 0
      fi
    fi
    sleep 1
    ((timeout--))
  done
  echo ""
  echo "⚠️  DevTools URL tidak ditemukan dalam 30 detik."
  echo "   Cek manual dari output di atas."
  return 1
}

# Tunggu sebentar lalu cari DevTools URL
(sleep 3 && wait_for_devtools) &

# Tunggu flutter selesai
wait $FLUTTER_PID
rm -f "$LOGFILE"

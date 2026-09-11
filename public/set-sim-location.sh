#!/bin/bash
# ============================================================
# set-sim-location.sh
# Set lokasi simulator (iOS Simulator & Android Emulator) ke
# koordinat yang diinginkan.
#
# URL akses: http://localhost:9876/set-sim-location.sh
#            http://localhost:5173/set-sim-location.sh
#
# Penggunaan:
#   bash set-sim-location.sh            # pakai koordinat default
#   LAT=-6.2 LON=106.8 bash set-sim-location.sh   # koordinat custom
# ============================================================

# Koordinat default (lokasi Indonesia)
LAT="${LAT:--6.010275570837686}"
LON="${LON:-106.0162313511048}"

echo "============================================="
echo "📍 Set Simulator Location"
echo "   Latitude : $LAT"
echo "   Longitude: $LON"
echo "============================================="

# ------------------------------------------------------------
# 1. iOS Simulator (xcrun simctl)
# ------------------------------------------------------------
if command -v xcrun >/dev/null 2>&1; then
  # Ambil UDID semua simulator yang sedang booted
  DEVICES=$(xcrun simctl list devices booted 2>/dev/null \
    | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}')

  if [ -n "$DEVICES" ]; then
    echo ""
    echo "🍎 iOS Simulator aktif:"
    while IFS= read -r UDID; do
      NAME=$(xcrun simctl list devices booted 2>/dev/null \
        | grep "$UDID" | sed 's/^ *//;s/ (Booted)//')
      printf "   - %s (%s)\n" "$UDID" "$NAME"
      if xcrun simctl location "$UDID" set "$LAT,$LON" 2>/dev/null; then
        echo "     ✅ Lokasi berhasil diset"
      else
        echo "     ❌ Gagal set lokasi"
      fi
    done <<< "$DEVICES"
  else
    echo ""
    echo "🍎 Tidak ada iOS Simulator yang sedang booted."
    echo "   Jalankan: open -a Simulator"
  fi
else
  echo ""
  echo "🍎 xcrun tidak ditemukan — lewati iOS Simulator"
fi

# ------------------------------------------------------------
# 2. Android Emulator (adb)
# ------------------------------------------------------------
if command -v adb >/dev/null 2>&1; then
  ANDROID_DEVICES=$(adb devices 2>/dev/null | awk '$2=="device"{print $1}')
  if [ -n "$ANDROID_DEVICES" ]; then
    echo ""
    echo "🤖 Android Emulator aktif:"
    while IFS= read -r DEV; do
      echo "   - $DEV"
      # adb emu geo fix <longitude> <latitude>
      if adb -s "$DEV" emu geo fix "$LON" "$LAT" 2>/dev/null; then
        echo "     ✅ Lokasi berhasil diset"
      else
        echo "     ❌ Gagal set lokasi (emulator harus dibuka dengan -no-snapshot-load)"
      fi
    done <<< "$ANDROID_DEVICES"
  else
    echo ""
    echo "🤖 Tidak ada Android Emulator terhubung (adb devices kosong)."
  fi
else
  echo ""
  echo "🤖 adb tidak ditemukan — lewati Android Emulator"
fi

echo ""
echo "============================================="
echo "✅ Selesai"
echo "============================================="

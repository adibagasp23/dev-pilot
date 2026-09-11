#!/bin/bash
# adb-scan.sh — Scan subnet untuk host dengan port 5555 (ADB)
# Usage: adb-scan.sh <subnet>   (e.g. 10.88.6.)
SUBNET="${1:-$(ipconfig getifaddr en0 2>/dev/null | sed 's/\.[0-9]*$/./')}"

if [ -z "$SUBNET" ] || [ "$SUBNET" = "." ]; then
  echo "ERROR: no subnet"
  exit 1
fi

PINGFILE=$(mktemp)
trap "rm -f $PINGFILE" EXIT

# Ping 20 paralel per batch, timeout 500ms per host
for i in $(seq 1 254); do
  (ping -c1 -W500 ${SUBNET}${i} >/dev/null 2>&1 && echo $i >> "$PINGFILE") &
  if [ $((i % 20)) -eq 0 ]; then wait; fi
done
wait

# Output aktif hosts (satu IP per baris)
sort -n "$PINGFILE" 2>/dev/null | while read num; do
  echo "${SUBNET}${num}"
done

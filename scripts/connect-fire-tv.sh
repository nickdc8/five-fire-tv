#!/usr/bin/env bash
set -euo pipefail

serial="${1:-}"
launch="${2:-}"

if ! command -v adb >/dev/null 2>&1; then
  echo "Android platform-tools (adb) are required." >&2
  exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to check the local helper." >&2
  exit 1
fi

if [[ -z "$serial" ]]; then
  devices=()
  while IFS= read -r device; do devices+=("$device"); done < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')
  if [[ ${#devices[@]} -ne 1 ]]; then
    echo "Connect one Fire TV with ADB, or pass its serial: $0 <device-serial> [--launch]" >&2
    adb devices >&2
    exit 1
  fi
  serial="${devices[0]}"
fi

if ! curl --fail --silent http://127.0.0.1:4186/api/health >/dev/null; then
  echo "Five helper is not responding at 127.0.0.1:4186." >&2
  echo "Start it from the project root with: node local-helper/server.mjs" >&2
  exit 1
fi

adb -s "$serial" reverse tcp:4186 tcp:4186
if ! adb -s "$serial" reverse --list | grep -q 'tcp:4186 tcp:4186'; then
  echo "ADB did not establish the Five helper tunnel for $serial." >&2
  exit 1
fi

echo "Five helper tunnel is active for $serial. Keep the helper running."
if [[ "$launch" == "--launch" ]]; then
  adb -s "$serial" shell monkey -p tv.five.fire 1 >/dev/null
  echo "Five launched. Channels 4 and 5 can now reach the helper."
fi

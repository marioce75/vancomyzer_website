#!/usr/bin/env bash
set -euo pipefail

MESSAGE_FILE="scripts/telegram_message.txt"
STATE_FILE=".openclaw/last_telegram_sha.txt"

mkdir -p .openclaw
touch "$MESSAGE_FILE"

last_sha=""
if [ -f "$STATE_FILE" ]; then
  last_sha="$(cat "$STATE_FILE" 2>/dev/null || true)"
fi

echo "Auto Telegram notifier watching $MESSAGE_FILE"

while true; do
  if [ -f "$MESSAGE_FILE" ]; then
    current_sha="$(shasum "$MESSAGE_FILE" | awk '{print $1}')"
    if [ -n "$current_sha" ] && [ "$current_sha" != "$last_sha" ]; then
      ./scripts/notify_from_file.sh "$MESSAGE_FILE"
      echo "$current_sha" > "$STATE_FILE"
      last_sha="$current_sha"
    fi
  fi
  sleep 15
done

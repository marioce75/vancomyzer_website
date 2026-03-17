#!/usr/bin/env bash
set -euo pipefail

MESSAGE_FILE="${1:-scripts/telegram_message.txt}"

if [ ! -f "$MESSAGE_FILE" ]; then
  echo "Message file not found: $MESSAGE_FILE" >&2
  exit 1
fi

python scripts/send_telegram.py "$(cat "$MESSAGE_FILE")"

import os
import sys
import requests

bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
chat_id = os.getenv("TELEGRAM_CHAT_ID")

if not bot_token:
    raise RuntimeError("Missing TELEGRAM_BOT_TOKEN")
if not chat_id:
    raise RuntimeError("Missing TELEGRAM_CHAT_ID")

text = " ".join(sys.argv[1:]).strip() or "Vancomyzer test message"

resp = requests.post(
    f"https://api.telegram.org/bot{bot_token}/sendMessage",
    json={"chat_id": chat_id, "text": text},
    timeout=30,
)
print(resp.status_code)
print(resp.text)

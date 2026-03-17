from pathlib import Path
from datetime import datetime, timezone
import json
import urllib.request
import re
import hashlib

TARGETS = {
    "vancocalc": [
        "https://vancocalc.com/",
    ],
    "dosemerx": [
        "https://doseme-rx.com/",
    ],
    "insightrx": [
        "https://www.insight-rx.com/",
    ],
    "precisepk": [
        "https://www.precisepk.com/",
    ],
}

BASE_OUT = Path("data/raw/competitors")
BASE_OUT.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 VancomyzerCompetitiveIntel/1.0"
}

def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")

def clean_text(html: str) -> str:
    text = re.sub(r"<script.*?>.*?</script>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<style.*?>.*?</style>", " ", text, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:25000]

def main():
    generated_at = datetime.now(timezone.utc).isoformat()

    for competitor, urls in TARGETS.items():
        results = []
        outdir = BASE_OUT / competitor
        outdir.mkdir(parents=True, exist_ok=True)

        for url in urls:
            try:
                html = fetch(url)
                text = clean_text(html)
                sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
                results.append({
                    "url": url,
                    "status": "ok",
                    "content_sha256": sha,
                    "text_excerpt": text[:2500],
                })
            except Exception as e:
                results.append({
                    "url": url,
                    "status": "error",
                    "error": str(e),
                })

        payload = {
            "generated_at": generated_at,
            "competitor": competitor,
            "results": results,
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        outfile = outdir / f"snapshot_{timestamp}.json"
        latest = outdir / "latest_snapshot.json"

        outfile.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
        latest.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

        print(f"Wrote {outfile}")
        print(f"Updated {latest}")

if __name__ == "__main__":
    main()

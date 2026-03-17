from pathlib import Path
from datetime import datetime, timezone
import json
import urllib.request
import hashlib
import re

PAGES = [
    "https://www.idsociety.org/",
    "https://www.ashp.org/",
    "https://www.fda.gov/drugs/drug-safety-and-availability",
]

OUTDIR = Path("data/raw/guidelines")
OUTDIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 VancomyzerGuidelineMonitor/1.0"
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
    return text[:20000]

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    results = []

    for url in PAGES:
        try:
            html = fetch(url)
            text = clean_text(html)
            sha = hashlib.sha256(text.encode("utf-8")).hexdigest()
            results.append({
                "url": url,
                "status": "ok",
                "content_sha256": sha,
                "text_excerpt": text[:1500],
            })
        except Exception as e:
            results.append({
                "url": url,
                "status": "error",
                "error": str(e),
            })

    payload = {
        "generated_at": generated_at,
        "source": "guideline_pages",
        "results": results,
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    outfile = OUTDIR / f"guideline_results_{timestamp}.json"
    latest = OUTDIR / "latest_guideline_results.json"

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    with open(latest, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Wrote {outfile}")
    print(f"Updated {latest}")

if __name__ == "__main__":
    main()

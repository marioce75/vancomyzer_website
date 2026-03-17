from pathlib import Path
from datetime import datetime, timezone
import json
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

QUERIES = [
    "vancomycin dosing",
    "vancomycin auc",
    "vancomycin therapeutic drug monitoring",
    "bayesian vancomycin dosing",
]

OUTDIR = Path("data/raw/discussions")
OUTDIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 VancomyzerResearchMonitor/1.0"
}

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def parse_rss(xml_bytes: bytes, query: str):
    root = ET.fromstring(xml_bytes)
    items = []
    for item in root.findall(".//item"):
        title = item.findtext("title", default="").strip()
        link = item.findtext("link", default="").strip()
        pubdate = item.findtext("pubDate", default="").strip()
        source = ""
        source_el = item.find("source")
        if source_el is not None and source_el.text:
            source = source_el.text.strip()
        items.append({
            "query": query,
            "title": title,
            "url": link,
            "pubDate": pubdate,
            "source": source,
        })
    return items

def main():
    results = []
    for query in QUERIES:
        try:
            encoded = urllib.parse.quote(query)
            url = f"https://news.google.com/rss/search?q={encoded}"
            xml_bytes = fetch(url)
            items = parse_rss(xml_bytes, query)
            results.append({
                "query": query,
                "count": len(items),
                "items": items[:10],
            })
        except Exception as e:
            results.append({
                "query": query,
                "error": str(e),
                "items": [],
            })

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "google_news_rss",
        "results": results,
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    outfile = OUTDIR / f"google_news_results_{timestamp}.json"
    latest = OUTDIR / "latest_google_news_results.json"

    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    with open(latest, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Saved: {outfile}")
    print(f"Updated: {latest}")

if __name__ == "__main__":
    main()

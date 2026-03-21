import argparse
import json
import os
from pathlib import Path
from firecrawl import Firecrawl

parser = argparse.ArgumentParser()
parser.add_argument("url")
parser.add_argument("--name", default="scrape")
args = parser.parse_args()

api_key = os.getenv("FIRECRAWL_API_KEY")
if not api_key:
    raise RuntimeError("Missing FIRECRAWL_API_KEY")

client = Firecrawl(api_key=api_key)
doc = client.scrape(args.url)

outdir = Path("reports/scrapes")
outdir.mkdir(parents=True, exist_ok=True)

md_path = outdir / f"{args.name}.md"
json_path = outdir / f"{args.name}.json"

markdown = getattr(doc, "markdown", "") or ""
data = doc.model_dump() if hasattr(doc, "model_dump") else (
    doc.dict() if hasattr(doc, "dict") else {"raw": str(doc)}
)

md_path.write_text(markdown, encoding="utf-8")
json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

print(f"Saved markdown: {md_path}")
print(f"Saved json: {json_path}")

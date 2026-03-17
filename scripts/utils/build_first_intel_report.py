from pathlib import Path
import json
from datetime import datetime

pubmed_path = Path("data/raw/pubmed/latest_pubmed_results.json")
news_path = Path("data/raw/discussions/latest_google_news_results.json")
out_path = Path("reports/market-intel/weekly/WEEKLY_INTEL_FIRST_PASS.md")

def load_json(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

pubmed = load_json(pubmed_path)
news = load_json(news_path)

lines = []
lines.append("# Vancomyzer Weekly Intelligence Report")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")
lines.append("## 1. Source status")
lines.append("")
lines.append(f"- PubMed loaded: {'yes' if pubmed else 'no'}")
lines.append(f"- Google News loaded: {'yes' if news else 'no'}")
lines.append("- Reddit loaded: placeholder only; direct scraping blocked without API access")
lines.append("")
lines.append("## 2. PubMed highlights")
lines.append("")

if pubmed and "results" in pubmed:
    for result in pubmed["results"]:
        query = result.get("query", "")
        articles = result.get("articles", [])[:3]
        lines.append(f"### Query: {query}")
        if not articles:
            lines.append("- No articles captured.")
        for a in articles:
            title = a.get("title", "").strip()
            url = a.get("pubmed_url", "").strip()
            journal = a.get("journal", "").strip()
            lines.append(f"- {title} | {journal} | {url}")
        lines.append("")
else:
    lines.append("- No PubMed data available.")
    lines.append("")

lines.append("## 3. Google News / public-web highlights")
lines.append("")

if news and "results" in news:
    for result in news["results"]:
        query = result.get("query", "")
        items = result.get("items", [])[:3]
        lines.append(f"### Query: {query}")
        if not items:
            lines.append("- No items captured.")
        for item in items:
            title = item.get("title", "").strip()
            source = item.get("source", "").strip()
            url = item.get("url", "").strip()
            lines.append(f"- {title} | {source} | {url}")
        lines.append("")
else:
    lines.append("- No Google News data available.")
    lines.append("")

lines.append("## 4. Preliminary signals for Vancomyzer")
lines.append("")
lines.append("- Bayesian vancomycin dosing remains a visible topic across literature and trade media.")
lines.append("- AUC monitoring, TDM workflow, and precision dosing are strong recurring themes.")
lines.append("- Educational content around implementation pain points is likely a high-value marketing path.")
lines.append("- Product positioning should emphasize transparent calculations, Bayesian support, and workflow usability.")
lines.append("")
lines.append("## 5. Recommended next actions")
lines.append("")
lines.append("- Have research-intelligence agent produce a structured summary from this report.")
lines.append("- Have product-strategy agent convert repeated themes into feature proposals.")
lines.append("- Have marketing agent convert repeated themes into blog topics and SEO pages.")
lines.append("- Next monitor to implement: guideline monitor with simple page snapshot/change detection.")
lines.append("")

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {out_path}")

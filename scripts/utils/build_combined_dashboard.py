from pathlib import Path
import json
from datetime import datetime

PUBMED = Path("data/raw/pubmed/latest_pubmed_results.json")
NEWS = Path("data/raw/discussions/latest_google_news_results.json")
GUIDELINES = Path("data/raw/guidelines/latest_guideline_results.json")
OUT = Path("reports/market-intel/weekly/COMBINED_INTEL_DASHBOARD.md")

def load(path):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))

pubmed = load(PUBMED)
news = load(NEWS)
guidelines = load(GUIDELINES)

lines = []
lines.append("# Vancomyzer Combined Intelligence Dashboard")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")
lines.append("## Source health")
lines.append(f"- PubMed: {'available' if pubmed else 'missing'}")
lines.append(f"- Google News: {'available' if news else 'missing'}")
lines.append(f"- Guideline monitor: {'available' if guidelines else 'missing'}")
lines.append("- Reddit: blocked without API access; placeholder only")
lines.append("")

lines.append("## 1. PubMed top signals")
lines.append("")
if pubmed and "results" in pubmed:
    for result in pubmed["results"]:
        lines.append(f"### {result.get('query','')}")
        for article in result.get("articles", [])[:2]:
            lines.append(f"- {article.get('title','')} | {article.get('journal','')} | {article.get('pubmed_url','')}")
        lines.append("")
else:
    lines.append("- No PubMed data available.")
    lines.append("")

lines.append("## 2. Public web / news signals")
lines.append("")
if news and "results" in news:
    for result in news["results"]:
        lines.append(f"### {result.get('query','')}")
        for item in result.get("items", [])[:2]:
            lines.append(f"- {item.get('title','')} | {item.get('source','')} | {item.get('url','')}")
        lines.append("")
else:
    lines.append("- No Google News data available.")
    lines.append("")

lines.append("## 3. Guideline / authority signals")
lines.append("")
if guidelines and "results" in guidelines:
    for item in guidelines["results"]:
        if item.get("status") == "ok":
            excerpt = item.get("text_excerpt", "")[:220].replace("\n", " ")
            lines.append(f"- OK: {item.get('url','')} | sha={item.get('content_sha256','')[:12]} | excerpt: {excerpt}")
        else:
            lines.append(f"- ERROR: {item.get('url','')} | {item.get('error','')}")
else:
    lines.append("- No guideline data available.")
lines.append("")

lines.append("## 4. Strategic interpretation")
lines.append("")
lines.append("- Precision dosing, Bayesian monitoring, and AUC workflow remain central recurring themes.")
lines.append("- Authoritative-source monitoring is working for IDSA and FDA; ASHP currently blocks simple fetch requests.")
lines.append("- Marketing should emphasize transparent calculations, usability, and evidence-aware workflow support.")
lines.append("- Product strategy should prioritize features that reduce dosing friction and explain results clearly.")
lines.append("")

lines.append("## 5. Recommended next actions")
lines.append("")
lines.append("- Build ASHP fallback monitor using search/news-based detection instead of direct page fetch.")
lines.append("- Create a script that converts this dashboard into a concise executive summary.")
lines.append("- Start baseline competitor reports for VancoCalc, DoseMeRx, InsightRx, and PrecisePK.")
lines.append("- Begin content roadmap from repeated signals: Bayesian dosing, AUC monitoring, and implementation pain points.")
lines.append("")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f'Wrote {OUT}')

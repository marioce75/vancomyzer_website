from pathlib import Path
from datetime import datetime, timezone
import json
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

CONFIG_QUERIES = [
    "vancomycin auc bayesian",
    "vancomycin therapeutic drug monitoring",
    "vancomycin dosing guideline",
    "vancomycin auc mic",
]

OUTDIR = Path("data/raw/pubmed")
OUTDIR.mkdir(parents=True, exist_ok=True)

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"

def fetch(url: str) -> bytes:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "VancomyzerResearchMonitor/1.0 (contact: local-project)",
            "Accept": "application/xml, application/json, text/plain",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()

def esearch(query: str, retmax: int = 10):
    params = {
        "db": "pubmed",
        "term": query,
        "retmax": str(retmax),
        "sort": "pub date",
        "retmode": "json",
    }
    url = BASE + "esearch.fcgi?" + urllib.parse.urlencode(params)
    data = json.loads(fetch(url).decode("utf-8"))
    return data.get("esearchresult", {}).get("idlist", [])

def efetch(ids):
    if not ids:
        return []
    params = {
        "db": "pubmed",
        "id": ",".join(ids),
        "retmode": "xml",
    }
    url = BASE + "efetch.fcgi?" + urllib.parse.urlencode(params)
    xml_bytes = fetch(url)
    root = ET.fromstring(xml_bytes)

    articles = []
    for article in root.findall(".//PubmedArticle"):
        pmid = article.findtext(".//MedlineCitation/PMID", default="").strip()
        title = article.findtext(".//Article/ArticleTitle", default="").strip()

        abstract_parts = []
        for elem in article.findall(".//Article/Abstract/AbstractText"):
            label = elem.attrib.get("Label")
            text = "".join(elem.itertext()).strip()
            if not text:
                continue
            abstract_parts.append(f"{label}: {text}" if label else text)
        abstract = "\n".join(abstract_parts).strip()

        journal = article.findtext(".//Article/Journal/Title", default="").strip()

        year = ""
        month = ""
        day = ""
        pubdate = article.find(".//Article/Journal/JournalIssue/PubDate")
        if pubdate is not None:
            year = pubdate.findtext("Year", default="").strip()
            month = pubdate.findtext("Month", default="").strip()
            day = pubdate.findtext("Day", default="").strip()

        doi = ""
        for aid in article.findall(".//ArticleIdList/ArticleId"):
            if aid.attrib.get("IdType") == "doi":
                doi = "".join(aid.itertext()).strip()
                break

        articles.append({
            "pmid": pmid,
            "title": title,
            "abstract": abstract,
            "journal": journal,
            "pubdate": {"year": year, "month": month, "day": day},
            "doi": doi,
            "pubmed_url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "",
        })
    return articles

def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    results = []

    for query in CONFIG_QUERIES:
        try:
            ids = esearch(query, retmax=10)
            time.sleep(0.4)
            articles = efetch(ids)
            time.sleep(0.4)
            results.append({
                "query": query,
                "count": len(articles),
                "articles": articles,
            })
        except Exception as e:
            results.append({
                "query": query,
                "error": str(e),
                "articles": [],
            })

    payload = {
        "generated_at": generated_at,
        "source": "PubMed E-utilities",
        "results": results,
    }

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    outfile = OUTDIR / f"pubmed_results_{timestamp}.json"
    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    latest = OUTDIR / "latest_pubmed_results.json"
    with open(latest, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)

    print(f"Wrote {outfile}")
    print(f"Updated {latest}")

if __name__ == "__main__":
    main()

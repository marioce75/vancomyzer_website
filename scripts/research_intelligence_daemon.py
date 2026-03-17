from __future__ import annotations

import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
VENDOR_SITE_PACKAGES = ROOT / "vendor" / "site-packages"
CONFIG_PATH = ROOT / "configs" / "research_intelligence_schedule.json"
STATE_PATH = ROOT / "logs" / "state" / "research_intelligence_daemon_state.json"
LOCK_PATH = ROOT / "logs" / "state" / "research_intelligence_daemon.lock"
DEFAULT_REPORT_DIR = ROOT / "reports" / "market-intel"
DEFAULT_TASK_RECOMMENDATION_DIR = DEFAULT_REPORT_DIR / "task-recommendations"
USER_AGENT = "VancomyzerResearchIntelBot/1.0 (+public-page-monitoring; bounded periodic fetch)"
FIRECRAWL_ENV_KEYS = ("FIRECRAWL_API_KEY", "FIRECRAWL_KEY")


@dataclass
class SourceTarget:
    name: str
    url: str
    notes: str = ""


@dataclass
class SourceConfig:
    enabled: bool
    min_interval_hours: float
    max_items_per_run: int
    prefer_firecrawl: bool = True
    targets: List[SourceTarget] = field(default_factory=list)


@dataclass
class FetchResult:
    url: str
    ok: bool
    method: str
    title: str
    excerpt: str
    error: str = ""


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def load_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_config() -> Dict[str, Any]:
    config = load_json(CONFIG_PATH)
    if not config:
        raise SystemExit(f"Missing config: {CONFIG_PATH}")
    return config


def load_state() -> Dict[str, Any]:
    state = load_json(STATE_PATH)
    if "last_runs" not in state:
        state["last_runs"] = {}
    return state


def should_run_source(name: str, source: SourceConfig, state: Dict[str, Any], now_ts: float) -> bool:
    if not source.enabled:
        return False
    last_run = state.get("last_runs", {}).get(name)
    if last_run is None:
        return True
    return (now_ts - float(last_run)) >= source.min_interval_hours * 3600


def strip_html(html: str) -> str:
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", html, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def sentence_excerpt(text: str, max_chars: int = 700) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if len(cleaned) <= max_chars:
        return cleaned
    clipped = cleaned[:max_chars]
    last_stop = max(clipped.rfind(". "), clipped.rfind("; "), clipped.rfind(": "))
    if last_stop > int(max_chars * 0.5):
        clipped = clipped[: last_stop + 1]
    return clipped.strip() + " …"


def load_firecrawl_class() -> tuple[Any | None, str | None, bool]:
    try:
        from firecrawl.v1.client import V1FirecrawlApp  # type: ignore

        return V1FirecrawlApp, None, False
    except Exception as first_exc:
        if VENDOR_SITE_PACKAGES.exists() and str(VENDOR_SITE_PACKAGES) not in sys.path:
            sys.path.insert(0, str(VENDOR_SITE_PACKAGES))
            try:
                from firecrawl.v1.client import V1FirecrawlApp  # type: ignore

                return V1FirecrawlApp, None, True
            except Exception as second_exc:
                return None, repr(second_exc), True
        return None, repr(first_exc), False


def firecrawl_client() -> Any | None:
    api_key = next((os.getenv(key) for key in FIRECRAWL_ENV_KEYS if os.getenv(key)), None)
    if not api_key:
        return None
    klass, _, _ = load_firecrawl_class()
    if klass is None:
        return None
    return klass(api_key=api_key, api_url=os.getenv("FIRECRAWL_API_URL"))


def firecrawl_status() -> Dict[str, Any]:
    api_key_present = any(bool(os.getenv(key)) for key in FIRECRAWL_ENV_KEYS)
    klass, detail, used_vendor_path = load_firecrawl_class()
    return {
        "api_key_present": api_key_present,
        "import_ok": klass is not None,
        "available": api_key_present and klass is not None,
        "import_error": detail,
        "vendor_site_packages": str(VENDOR_SITE_PACKAGES),
        "used_vendor_path": used_vendor_path,
        "python_executable": sys.executable,
    }


def fetch_with_firecrawl(url: str, client: Any) -> FetchResult:
    try:
        response = client.scrape_url(url, formats=["markdown"], only_main_content=True)
        markdown = getattr(response, "markdown", "") or ""
        title = getattr(response, "title", "") or ""
        metadata = getattr(response, "metadata", None) or {}

        if not markdown and isinstance(response, dict):
            data = response.get("data", response)
            if isinstance(data, dict):
                markdown = data.get("markdown") or data.get("content") or ""
                metadata = data.get("metadata") or metadata
                title = data.get("title") or title

        if isinstance(metadata, dict):
            title = metadata.get("title") or title

        excerpt = sentence_excerpt(strip_html(markdown or ""))
        if not excerpt:
            excerpt = "No extractable content."
        return FetchResult(url=url, ok=True, method="firecrawl", title=title or url, excerpt=excerpt)
    except Exception as exc:
        return FetchResult(url=url, ok=False, method="firecrawl", title=url, excerpt="", error=str(exc))


def fetch_basic(url: str) -> FetchResult:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=20) as resp:
            raw = resp.read(300000)
            charset = resp.headers.get_content_charset() or "utf-8"
            html = raw.decode(charset, errors="replace")
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
        title = strip_html(title_match.group(1)) if title_match else url
        text = strip_html(html)
        return FetchResult(url=url, ok=True, method="basic_fetch", title=title, excerpt=sentence_excerpt(text))
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        return FetchResult(url=url, ok=False, method="basic_fetch", title=url, excerpt="", error=str(exc))


def collect_target(target: SourceTarget, prefer_firecrawl: bool, client: Any | None) -> FetchResult:
    if prefer_firecrawl and client is not None:
        result = fetch_with_firecrawl(target.url, client)
        if result.ok:
            return result
    return fetch_basic(target.url)


def classify_signal(source_name: str, result: FetchResult, target: SourceTarget) -> str:
    text = f"{result.title} {result.excerpt} {target.notes}".lower()
    if source_name in {"pubmed", "guidelines"} and any(k in text for k in ["guideline", "consensus", "monitor", "pharmacokinetic", "auc", "vancomycin"]):
        return "evidence_or_guideline"
    if source_name in {"reddit", "studentdoctor", "pharmacy_forums"} and any(k in text for k in ["dosing", "auc", "trough", "workflow", "calculator", "bayesian"]):
        return "clinician_workflow_signal"
    if source_name == "competitor_tools":
        return "competitor_signal"
    return "background_monitoring"


def recommendation_for_findings(source_name: str, findings: List[Dict[str, str]]) -> Dict[str, str] | None:
    important = [f for f in findings if f["signal_type"] not in {"background_monitoring", "collection_error"}]
    if not important:
        return None
    top = important[0]
    if top["signal_type"] == "evidence_or_guideline":
        owner = "docs/validation/compliance"
        why = "Potential evidence or guideline change may affect product claims, documentation, or validation language."
    elif top["signal_type"] == "competitor_signal":
        owner = "product/competitive-intel"
        why = "Competitor messaging or workflow shifts may change positioning and comparison-page priorities."
    else:
        owner = "product/docs/content"
        why = "Repeated workflow discussion may indicate friction worth addressing in UX, education, or support content."
    return {
        "signal_summary": top["summary"],
        "owner": owner,
        "why_it_matters": why,
    }


def write_report(report_dir: Path, source_name: str, source_cfg: SourceConfig, findings: List[Dict[str, str]], firecrawl_available: bool) -> Path:
    report_dir.mkdir(parents=True, exist_ok=True)
    timestamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
    path = report_dir / f"{timestamp}_{source_name}_monitoring_report.md"
    lines = [
        f"# {source_name} monitoring report",
        "",
        f"Generated: {utc_now().isoformat()}",
        "",
        "## Status",
        f"Bounded periodic monitoring run completed for {source_name}.",
        "",
        "## Collection constraints",
        "- Publicly accessible sources only",
        "- Non-aggressive periodic monitoring",
        f"- Max items per run: {source_cfg.max_items_per_run}",
        f"- Firecrawl available: {'yes' if firecrawl_available else 'no'}",
        f"- Preferred collection path: {'Firecrawl with fallback to basic fetch' if source_cfg.prefer_firecrawl else 'basic fetch'}",
        "",
        "## Findings",
    ]
    if not findings:
        lines.append("- No targets were configured or no findings were collected in this run.")
    else:
        for item in findings:
            lines.extend([
                f"### {item['target_name']}",
                f"- URL: {item['url']}",
                f"- Method: {item['method']}",
                f"- Signal type: {item['signal_type']}",
                f"- Summary: {item['summary']}",
                f"- Notes: {item['notes'] or 'None'}",
                "",
            ])
    lines.extend([
        "## Proposed follow-on tasks",
        "- Create explicit tasks only for evidence updates, repeated workflow pain, or meaningful competitor movement.",
    ])
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def write_task_recommendation(task_dir: Path, source_name: str, recommendation: Dict[str, str] | None) -> Path | None:
    if recommendation is None:
        return None
    task_dir.mkdir(parents=True, exist_ok=True)
    timestamp = utc_now().strftime("%Y%m%dT%H%M%SZ")
    path = task_dir / f"{timestamp}_{source_name}_task_recommendation.md"
    path.write_text(
        "\n".join([
            f"# Task recommendation from {source_name} monitoring",
            "",
            f"Generated: {utc_now().isoformat()}",
            "",
            f"- Signal summary: {recommendation['signal_summary']}",
            f"- Recommended owner: {recommendation['owner']}",
            f"- Why it matters: {recommendation['why_it_matters']}",
            "- Do not implement code from this recommendation directly; convert it into an explicit reviewed task first.",
        ]),
        encoding="utf-8",
    )
    return path


def parse_source_config(raw: Dict[str, Any]) -> SourceConfig:
    targets = [
        SourceTarget(name=item.get("name", item.get("url", "target")), url=item["url"], notes=item.get("notes", ""))
        for item in raw.get("targets", [])
        if item.get("url")
    ]
    return SourceConfig(
        enabled=bool(raw.get("enabled", False)),
        min_interval_hours=float(raw.get("min_interval_hours", 24)),
        max_items_per_run=int(raw.get("max_items_per_run", 10)),
        prefer_firecrawl=bool(raw.get("prefer_firecrawl", True)),
        targets=targets,
    )


def run_once(force_source: str | None = None) -> int:
    config = load_config()
    if not config.get("enabled", True):
        return 0

    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd: int | None = None
    try:
        fd = os.open(str(LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode("utf-8"))

        state = load_state()
        now = utc_now().timestamp()
        report_dir = ROOT / config.get("report_output_dir", str(DEFAULT_REPORT_DIR.relative_to(ROOT)))
        task_dir = ROOT / config.get("task_recommendation_dir", str(DEFAULT_TASK_RECOMMENDATION_DIR.relative_to(ROOT)))
        client = firecrawl_client()
        firecrawl_available = client is not None

        ran = 0
        for name, raw in config.get("sources", {}).items():
            if force_source and name != force_source:
                continue
            source = parse_source_config(raw)
            if not force_source and not should_run_source(name, source, state, now):
                continue

            findings: List[Dict[str, str]] = []
            for target in source.targets[: source.max_items_per_run]:
                result = collect_target(target, source.prefer_firecrawl, client)
                findings.append({
                    "target_name": target.name,
                    "url": target.url,
                    "method": result.method,
                    "signal_type": classify_signal(name, result, target) if result.ok else "collection_error",
                    "summary": result.excerpt if result.ok else f"Collection failed: {result.error}",
                    "notes": target.notes,
                })

            write_report(report_dir, name, source, findings, firecrawl_available)
            recommendation = recommendation_for_findings(name, findings)
            write_task_recommendation(task_dir, name, recommendation)
            state.setdefault("last_runs", {})[name] = now
            ran += 1

        save_json(STATE_PATH, state)
        return ran
    except FileExistsError:
        print("Another research intelligence run is already in progress; skipping overlap.")
        return 0
    finally:
        if fd is not None:
            os.close(fd)
        try:
            LOCK_PATH.unlink(missing_ok=True)
        except OSError:
            pass


def run_loop() -> None:
    config = load_config()
    sleep_seconds = max(300, int(config.get("loop_sleep_seconds", 900)))
    while True:
        run_once()
        time.sleep(sleep_seconds)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "once"
    if mode == "once":
        force_source = sys.argv[2] if len(sys.argv) > 2 else None
        count = run_once(force_source=force_source)
        print(f"Completed {count} scheduled monitoring runs.")
    elif mode == "loop":
        print("Starting research intelligence daemon loop.")
        run_loop()
    elif mode == "firecrawl-status":
        print(json.dumps(firecrawl_status(), indent=2))
    else:
        raise SystemExit("Usage: python3 scripts/research_intelligence_daemon.py [once|loop|firecrawl-status] [optional_source]")

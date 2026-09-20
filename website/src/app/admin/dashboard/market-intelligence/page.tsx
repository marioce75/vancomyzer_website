"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface AnalysisRun {
  run_id: number;
  run_date: string;
  total_posts_scraped: number;
  new_posts_this_run: number;
  top_pain_points: string;
  drug_mentions: string;
  competitor_mentions: string;
  top_posts: string;
  geographic_signals: string;
  run_duration_seconds: number;
  status: string;
  error_message: string | null;
  source_health?: string;
}

interface HighSignalPost {
  title: string;
  source: string;
  source_identifier: string;
  url: string;
  upvote_count: number;
}

interface JobStatus { state: string; message: string; started_at: string | null }

interface DashboardData {
  scraper?: JobStatus;
  analyst?: JobStatus;
  analystConfigured?: boolean;
  analystModel?: string;
  runs: AnalysisRun[];
  latest: AnalysisRun | null;
  highSignal: HighSignalPost[];
  competitorChanges: { competitor_name: string; url: string; scraped_at: string }[];
  aiReport?: {
    id: number;
    run_id: number;
    evidence_json?: string;
    model?: string;
    report_date: string;
    executive_brief: string;
    market_opportunities: string;
    competitive_gaps: string;
    innovation_ideas: string;
    strategic_recommendations: string;
    risk_signals: string;
  } | null;
  scraperRunning?: boolean;
  scraperStartedAt?: string | null;
}

function serverDate(value: string): Date { return new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z"); }
function safeJSON<T>(value: string | undefined, fallback: T): T {
  try { const parsed = JSON.parse(value || "null"); return parsed ?? fallback; } catch { return fallback; }
}
function Sources({ urls }: { urls?: string[] }) {
  return urls?.length ? <p className="text-xs mt-2">Sources: {urls.filter(url => /^https?:\/\//i.test(url)).map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline text-teal-700 mr-2">[{i+1}]</a>)}</p> : null;
}
const card = "bg-white border border-gray-200 rounded-lg p-5";
const heading = "text-sm font-bold text-slate-900 uppercase tracking-wider mb-3";

export default function MarketIntelligencePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [analystRunning, setAnalystRunning] = useState(false);
  const [analystResult, setAnalystResult] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string>("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/scraper", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 403 ? "Your admin session expired. Sign in again." : "Could not load Market Intel. Retry shortly.");
      const next: DashboardData = await res.json();
      setData(next); setLoadError("");
      setRunning(next.scraper?.state === "running");
      setAnalystRunning(next.analyst?.state === "running");
      if (next.scraper) setRunResult(next.scraper.message);
      if (next.analyst) setAnalystResult(next.analyst.message);
    } catch (error) { setLoadError((error as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!running && !analystRunning) return;
    const timer = setInterval(() => { void fetchData(); }, 5000);
    return () => clearInterval(timer);
  }, [running, analystRunning, fetchData]);

  const startJob = async (analyst: boolean) => {
    const setBusy = analyst ? setAnalystRunning : setRunning;
    const setMessage = analyst ? setAnalystResult : setRunResult;
    setBusy(true); setMessage(analyst ? "Analyzing collected evidence…" : "Collecting public sources…");
    try {
      const res = await fetch(`/api/admin/scraper${analyst ? "?action=run_analyst" : ""}`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not start the job.");
      setMessage(result.message); await fetchData();
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  };
  const handleRunScraper = () => startJob(false);

  const download = async (action: string) => {
    try {
      const res = await fetch(`/api/admin/scraper?action=${action}`);
      if (!res.ok) { alert("Download failed: " + (await res.text())); return; }
      const contentType = res.headers.get("content-type") ?? "";
      const blob = await res.blob();
      const ext = contentType.includes("csv") ? "csv" : "json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vancomyzer-${action}-${new Date().toISOString().split("T")[0]}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Download failed."); }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading market intelligence...</div>;

  const latest = data?.latest;
  const painPoints = latest ? safeJSON(latest.top_pain_points, []) as { text: string; count: number }[] : [];
  const drugMentions = latest ? safeJSON(latest.drug_mentions, {}) as Record<string, number> : {};
  const competitorMentions = latest ? safeJSON(latest.competitor_mentions, {}) as Record<string, { count: number; positive: number; neutral: number; negative: number; posts: string[] }> : {};
  const topPosts = latest ? safeJSON(latest.top_posts, []) as { title: string; source: string; url: string; upvote_count: number }[] : [];
  const geoSignals = latest ? safeJSON(latest.geographic_signals, {}) as Record<string, number> : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Market Intelligence</h1>
          <p className="text-sm text-gray-500">Public-source monitoring and evidence-linked research</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunScraper}
            disabled={running}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            {running ? "Running..." : "Run Scraper Now"}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        <span className="px-4 py-2 text-sm font-medium text-teal-700 border-b-2 border-teal-600">
          Dashboard
        </span>
        <Link
          href="/admin/dashboard/market-intelligence/files"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
        >
          Files
        </Link>
      </div>

      {runResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${runResult.includes("Failed") ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
          {runResult}
        </div>
      )}

      {loadError && <div role="alert" className="p-3 bg-red-50 text-red-800">{loadError} <button onClick={() => void fetchData()} className="underline">Retry</button></div>}
      <div className={card}>
        <h2 className={heading}>Source coverage</h2>
        <p className="text-xs text-gray-600 mb-3">Totals count unique records actually collected. Keyword summaries cover records seen in the last 30 days, not market size. Vendor pages are self-reported; country mentions do not establish demand or location. Older totals used estimated query limits and are not comparable.</p>
        {!latest?.source_health && <p className="text-sm text-amber-800">Run the updated scraper to measure source coverage.</p>}
        <div className="space-y-2">{safeJSON<{name: string; url: string; state: string; records: number; detail?: string}[]>(latest?.source_health, []).map((source, i) => (
          <div key={i} className="text-xs border-b pb-2"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">{source.name}</a> — {source.state}, {source.records} records{source.detail && <span className="block text-gray-600">{source.detail}</span>}</div>
        ))}</div>
      </div>
      {/* Run History */}
      <div className={card}>
        <h2 className={heading}>Run History</h2>
        {(data?.runs?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400">No scrape runs yet. Click &quot;Run Scraper Now&quot; to start.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Collected</th>
                <th className="pb-2 font-medium">New</th>
                <th className="pb-2 font-medium">Duration</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.runs?.map(r => (
                <tr key={r.run_id} className="border-b border-gray-100">
                  <td className="py-2">{serverDate(r.run_date).toLocaleDateString()}</td>
                  <td className="py-2">{r.total_posts_scraped}</td>
                  <td className="py-2 font-semibold">{r.new_posts_this_run}</td>
                  <td className="py-2">{r.run_duration_seconds.toFixed(1)}s</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${r.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pain Points */}
        <div className={card}>
          <h2 className={heading}>Discussion phrase signals</h2>
          {painPoints.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {painPoints.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{p.text}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, (p.count / (painPoints[0]?.count || 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 w-8 text-right">{p.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drug Opportunities */}
        <div className={card}>
          <h2 className={heading}>Drug Mention Frequency</h2>
          {Object.keys(drugMentions).length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(drugMentions).filter(([, c]) => c > 0).map(([drug, count]) => (
                <div key={drug} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 capitalize">{drug}</span>
                  <span className="text-xs font-semibold text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Competitor Intelligence */}
        <div className={card}>
          <h2 className={heading}>Competitor Intelligence</h2>
          {Object.keys(competitorMentions).length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(competitorMentions).map(([name, data]) => (
                <div key={name} className="border-b border-gray-100 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">{name}</span>
                    <span className="text-xs text-gray-500">{data.count} mentions</span>
                  </div>
                  <div className="flex gap-2 mt-1 text-xs">
                    <span className="text-green-600">+{data.positive}</span>
                    <span className="text-gray-400">~{data.neutral}</span>
                    <span className="text-red-600">-{data.negative}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Geographic Signals */}
        <div className={card}>
          <h2 className={heading}>Country mentions (not demand)</h2>
          {Object.keys(geoSignals).length === 0 ? (
            <p className="text-sm text-gray-400">No data yet.</p>
          ) : (
            <div className="space-y-1">
              {Object.entries(geoSignals).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
                <div key={region} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{region}</span>
                  <span className="text-xs font-semibold text-gray-500">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* High Signal Posts */}
      <div className={card}>
        <h2 className={heading}>High-engagement Reddit posts</h2>
        {(data?.highSignal?.length ?? 0) === 0 ? (
          <p className="text-sm text-gray-400">No high-signal posts in the last 30 days.</p>
        ) : (
          <div className="space-y-2">
            {data?.highSignal?.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                <div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{p.title.substring(0, 80)}</a>
                  <span className="ml-2 text-xs text-gray-400">r/{p.source_identifier}</span>
                </div>
                <span className="text-xs font-bold text-orange-600">{p.upvote_count} ▲</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Competitor Changes */}
      {(data?.competitorChanges?.length ?? 0) > 0 && (
        <div className={`${card} border-amber-200 bg-amber-50`}>
          <h2 className={heading}>Competitor Page Changes Detected</h2>
          {data?.competitorChanges?.map((c, i) => (
            <div key={i} className="text-sm text-amber-800">
              <strong>{c.competitor_name}</strong> — change detected at {serverDate(c.scraped_at).toLocaleDateString()}
            </div>
          ))}
        </div>
      )}

      {/* AI Market Research Analyst */}
      <div className={`${card} border-indigo-200`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={heading + " mb-0"}>AI Market Research Analyst</h2>
          <button
            onClick={() => void startJob(true)}
            disabled={analystRunning || running}
            className="px-3 py-1 text-xs font-semibold text-indigo-700 border border-indigo-300 rounded hover:bg-indigo-50"
          >
            {analystRunning ? "Analyzing…" : "Re-run Analysis"}
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-2">AI draft: review source context and factual claims before using this analysis for outreach or business decisions.</p>
        <p className="text-xs text-gray-600 mb-2">{data?.analystConfigured ? `AI service configured · ${data.analystModel}` : "AI service needs an Anthropic API key in the hosting environment."}</p>
        {analystResult && <p role="status" className="p-3 mb-3 bg-slate-50 text-sm text-slate-800">{analystResult}</p>}
        {data?.aiReport && data.aiReport.run_id !== latest?.run_id && <p className="text-sm text-amber-800 mb-3">This report predates the latest collection. Re-run analysis to refresh it.</p>}
        {data?.aiReport && (!data.aiReport.evidence_json || data.aiReport.evidence_json === "[]") && <p className="text-sm text-amber-800 mb-3">Legacy report: source links and evidence quality were not verified. Regenerate before using its conclusions.</p>}
        {!data?.aiReport ? (
          <p className="text-sm text-gray-400">No AI analysis yet. Run the scraper to generate insights.</p>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-gray-600">Linked evidence used in this report:
              <ul className="list-disc pl-4">{safeJSON<{title:string;url:string;source:string}[]>(data.aiReport.evidence_json, []).map((source, i) => <li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 underline">{source.title}</a> ({source.source})</li>)}</ul>
            </div>
            {/* Executive Brief */}
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-1">Executive Brief</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{data.aiReport.executive_brief || "—"}</p>
              <p className="text-xs text-indigo-400 mt-2">Generated: {serverDate(data.aiReport.report_date).toLocaleString()}</p>
            </div>

            {/* Market Opportunities */}
            {(() => {
              const opps = safeJSON(data.aiReport.market_opportunities, []) as { title: string; description: string; priority: string; action_items?: string[]; source_urls?: string[] }[];
              if (opps.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Market Opportunities</p>
                  <div className="space-y-2">
                    {opps.map((o, i) => (
                      <div key={i} className="border border-gray-100 rounded p-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${o.priority === "high" ? "bg-red-100 text-red-700" : o.priority === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{o.priority}</span>
                          <span className="text-sm font-semibold text-gray-900">{o.title}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{o.description}</p><Sources urls={o.source_urls} />
                        {o.action_items && o.action_items.length > 0 && (
                          <ul className="mt-1 text-xs text-gray-500 list-disc pl-4">
                            {o.action_items.map((a, j) => <li key={j}>{a}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Competitive Gaps */}
            {(() => {
              const gaps = safeJSON(data.aiReport.competitive_gaps, []) as { competitor: string; gap: string; vancomyzer_advantage: string; action: string; source_urls?: string[] }[];
              if (gaps.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Competitive Gaps</p>
                  <div className="space-y-2">
                    {gaps.map((g, i) => (
                      <div key={i} className="border border-gray-100 rounded p-3 text-xs">
                        <span className="font-bold text-gray-900">{g.competitor}</span>
                        <span className="text-gray-400"> — </span>
                        <span className="text-gray-700">{g.gap}</span>
                        <p className="text-green-700 mt-1">Vancomyzer advantage: {g.vancomyzer_advantage}</p>
                        <p className="text-gray-500">Action: {g.action}</p><Sources urls={g.source_urls} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Innovation Ideas */}
            {(() => {
              const ideas = safeJSON(data.aiReport.innovation_ideas, []) as { idea: string; rationale: string; effort: string; impact: string; timeline: string; source_urls?: string[] }[];
              if (ideas.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Innovation Ideas</p>
                  <div className="space-y-2">
                    {ideas.map((idea, i) => (
                      <div key={i} className="border border-gray-100 rounded p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{idea.idea}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${idea.impact === "high" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{idea.impact} impact</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 text-blue-600">{idea.effort} effort</span>
                        </div>
                        <p className="text-gray-600 mt-1">{idea.rationale}</p>
                        <p className="text-gray-400 mt-1">Timeline: {idea.timeline}</p><Sources urls={idea.source_urls} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Strategic Recommendations */}
            {(() => {
              const recs = safeJSON(data.aiReport.strategic_recommendations, []) as { recommendation: string; rationale: string; priority: number; timeline: string; source_urls?: string[] }[];
              if (recs.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Strategic Recommendations</p>
                  <ol className="space-y-2 list-decimal pl-4">
                    {recs.sort((a, b) => a.priority - b.priority).map((r, i) => (
                      <li key={i} className="text-xs text-gray-700">
                        <span className="font-semibold">{r.recommendation}</span>
                        <span className="text-gray-400"> — {r.timeline}</span>
                        <p className="text-gray-500 mt-0.5">{r.rationale}</p><Sources urls={r.source_urls} />
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })()}

            {/* Risk Signals */}
            {(() => {
              const risks = safeJSON(data.aiReport.risk_signals, []) as { risk: string; severity: string; evidence: string; mitigation: string; source_urls?: string[] }[];
              if (risks.length === 0) return null;
              return (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Risk Signals</p>
                  <div className="space-y-2">
                    {risks.map((r, i) => (
                      <div key={i} className={`border rounded p-3 text-xs ${r.severity === "high" ? "border-red-200 bg-red-50" : r.severity === "medium" ? "border-amber-200 bg-amber-50" : "border-gray-100"}`}>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${r.severity === "high" ? "bg-red-200 text-red-800" : r.severity === "medium" ? "bg-amber-200 text-amber-800" : "bg-gray-200 text-gray-700"}`}>{r.severity}</span>
                          <span className="font-semibold text-gray-900">{r.risk}</span>
                        </div>
                        <p className="text-gray-600 mt-1">Evidence: {r.evidence}</p>
                        <p className="text-gray-500 mt-1">Mitigation: {r.mitigation}</p><Sources urls={r.source_urls} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Export Center */}
      <div className={card}>
        <h2 className={heading}>Download Reports</h2>
        <p className="text-xs text-gray-500 mb-3">Last data: {latest ? serverDate(latest.run_date).toLocaleDateString() : "No runs yet"}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download("export_summary_json")} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50">
            Latest Collection (JSON)
          </button>
          <button onClick={() => download("export_posts_csv")} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50">
            Recent Records (CSV)
          </button>
          <button onClick={() => download("export_all_posts")} className="px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded hover:bg-gray-50">
            Full Export (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface IndexEntry {
  filename: string;
  path: string;
  run_date: string;
  post_count: number;
  file_size_bytes: number;
  description: string;
}

const card = "bg-white border border-gray-200 rounded-lg p-5";
const heading = "text-sm font-bold text-slate-900 uppercase tracking-wider mb-3";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MarketIntelligenceFilesPage() {
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [miDir, setMiDir] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<IndexEntry | null>(null);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [generatingReport, setGeneratingReport] = useState(false);
  const [importResult, setImportResult] = useState<string>("");

  const fetchIndex = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/market-intelligence?action=index");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setMiDir(data.mi_dir || "");
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchIndex(); }, [fetchIndex]);

  const loadAnalysis = async (entry: IndexEntry) => {
    setSelectedEntry(entry);
    setAnalysisLoading(true);
    try {
      const dateStr = entry.run_date.split("T")[0];
      const res = await fetch(`/api/admin/market-intelligence?action=run&date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setAnalysis(Array.isArray(data) ? data[0] : data);
      }
    } catch { /* ignore */ }
    setAnalysisLoading(false);
  };

  const downloadFile = async (filePath: string) => {
    const res = await fetch(`/api/admin/market-intelligence?action=download&file=${encodeURIComponent(filePath)}`);
    if (!res.ok) { alert("Download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filePath.split("/").pop() || "download";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCsv = async (action: string, filePath: string) => {
    const res = await fetch(`/api/admin/market-intelligence?action=${action}&file=${encodeURIComponent(filePath)}`);
    if (!res.ok) { alert("Download failed"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${action}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateRangeReport = async () => {
    if (!rangeStart || !rangeEnd) { alert("Select both start and end dates."); return; }
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/admin/market-intelligence?action=range&start=${rangeStart}&end=${rangeEnd}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `range-report_${rangeStart}_to_${rangeEnd}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { alert("Failed to generate report."); }
    setGeneratingReport(false);
  };

  const runImport = async () => {
    setImportResult("Importing...");
    try {
      const res = await fetch("/api/admin/market-intelligence?action=import_historical");
      if (res.ok) {
        const result = await res.json();
        setImportResult(`Imported ${result.imported} files. ${result.errors?.length || 0} error(s).`);
        fetchIndex();
      }
    } catch { setImportResult("Import failed."); }
  };

  // Filter to analysis entries only for the run list
  const analysisEntries = entries
    .filter(e => e.path.startsWith("analysis/"))
    .sort((a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime());

  // Find matching raw path for an analysis entry
  const findRawPath = (entry: IndexEntry): string | null => {
    const ts = entry.filename.replace("_analysis.json", "");
    const rawFilename = `${ts}_raw_posts.json`;
    return entries.find(e => e.filename === rawFilename)?.path ?? null;
  };

  if (loading) return <div className="p-8 text-gray-500">Loading file index...</div>;

  // Parse analysis fields safely
  const painPoints = (analysis?.top_pain_points || []) as { text: string; count: number }[];
  const drugMentions = (analysis?.drug_mentions || {}) as Record<string, number>;
  const competitorMentions = (analysis?.competitor_mentions || {}) as Record<string, { count: number; positive: number; neutral: number; negative: number }>;
  const geoSignals = (analysis?.geographic_signals || {}) as Record<string, number>;
  const topPosts = (analysis?.top_posts || []) as { title: string; source: string; url: string; upvote_count: number }[];

  return (
    <div className="space-y-6">
      {/* Header + Tab Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Market Intelligence — Files</h1>
          <p className="text-sm text-gray-500">Browse, retrieve, and export all historical scrape data</p>
        </div>
        <button
          onClick={runImport}
          className="px-3 py-1.5 text-xs font-semibold text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          Import Historical Data
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        <Link
          href="/admin/dashboard/market-intelligence"
          className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent"
        >
          Dashboard
        </Link>
        <span className="px-4 py-2 text-sm font-medium text-teal-700 border-b-2 border-teal-600">
          Files
        </span>
      </div>

      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${importResult.includes("fail") ? "bg-red-50 text-red-800 border border-red-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
          {importResult}
        </div>
      )}

      {/* Three-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Panel — Run List */}
        <div className={`${card} lg:col-span-3 max-h-[600px] overflow-y-auto`}>
          <h2 className={heading}>Scrape Runs</h2>
          {analysisEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No runs yet.</p>
          ) : (
            <div className="space-y-1">
              {analysisEntries.map(entry => {
                const d = new Date(entry.run_date);
                const isSelected = selectedEntry?.path === entry.path;
                return (
                  <button
                    key={entry.path}
                    onClick={() => loadAnalysis(entry)}
                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                      isSelected
                        ? "bg-teal-50 border border-teal-200 text-teal-900"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    <div className="font-semibold">{d.toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500">
                      {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} &middot; {entry.post_count} posts &middot; {formatBytes(entry.file_size_bytes)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Center Panel — Analysis Viewer */}
        <div className={`${card} lg:col-span-6 max-h-[600px] overflow-y-auto`}>
          <h2 className={heading}>Analysis</h2>
          {!selectedEntry ? (
            <p className="text-sm text-gray-400">Select a run from the left panel to view its analysis.</p>
          ) : analysisLoading ? (
            <p className="text-sm text-gray-500">Loading analysis...</p>
          ) : !analysis ? (
            <p className="text-sm text-gray-400">No analysis data available.</p>
          ) : (
            <div className="space-y-4">
              {/* Run metadata */}
              <div className="p-3 bg-gray-50 rounded text-xs text-gray-600">
                <div>Run #{analysis.run_id as number} &middot; {analysis.status as string}</div>
                <div>{analysis.total_posts_scraped as number} total posts &middot; {analysis.new_posts_this_run as number} new &middot; {((analysis.run_duration_seconds as number) || 0).toFixed(1)}s</div>
              </div>

              {/* Pain Points */}
              {painPoints.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Pain Points</p>
                  <div className="space-y-1.5">
                    {painPoints.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.text}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-500 rounded-full" style={{ width: `${Math.min(100, (p.count / (painPoints[0]?.count || 1)) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-500 w-6 text-right">{p.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drug Mentions */}
              {Object.keys(drugMentions).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Drug Mentions</p>
                  <div className="space-y-1">
                    {Object.entries(drugMentions).filter(([, c]) => c > 0).map(([drug, count]) => (
                      <div key={drug} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 capitalize">{drug}</span>
                        <span className="text-xs font-semibold text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitor Intelligence */}
              {Object.keys(competitorMentions).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Competitors</p>
                  <div className="space-y-2">
                    {Object.entries(competitorMentions).filter(([, d]) => d.count > 0).map(([name, d]) => (
                      <div key={name} className="border-b border-gray-100 pb-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-gray-900">{name}</span>
                          <span className="text-xs text-gray-500">{d.count} mentions</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-green-600">+{d.positive}</span>
                          <span className="text-gray-400">~{d.neutral}</span>
                          <span className="text-red-600">-{d.negative}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Geographic Signals */}
              {Object.keys(geoSignals).length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Geographic Signals</p>
                  <div className="space-y-1">
                    {Object.entries(geoSignals).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
                      <div key={region} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{region}</span>
                        <span className="text-xs font-semibold text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Posts */}
              {topPosts.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">High Signal Posts</p>
                  <div className="space-y-1.5">
                    {topPosts.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate max-w-[80%]">
                          {p.title.substring(0, 80)}
                        </a>
                        <span className="text-xs font-bold text-orange-600 flex-shrink-0">{p.upvote_count} ^</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel — Downloads */}
        <div className={`${card} lg:col-span-3`}>
          <h2 className={heading}>Downloads</h2>
          {!selectedEntry ? (
            <p className="text-sm text-gray-400">Select a run to see download options.</p>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const rawPath = findRawPath(selectedEntry);
                    if (rawPath) downloadFile(rawPath);
                    else alert("Raw posts file not found for this run.");
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-left border border-gray-300 rounded hover:bg-gray-50"
                >
                  Download Raw Posts (JSON)
                </button>
                <button
                  onClick={() => downloadFile(selectedEntry.path)}
                  className="w-full px-3 py-2 text-xs font-semibold text-left border border-gray-300 rounded hover:bg-gray-50"
                >
                  Download Analysis (JSON)
                </button>
                <button
                  onClick={() => {
                    const rawPath = findRawPath(selectedEntry);
                    if (rawPath) downloadCsv("posts_csv", rawPath);
                    else alert("Raw posts file not found for this run.");
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold text-left border border-gray-300 rounded hover:bg-gray-50"
                >
                  Download Posts (CSV)
                </button>
                <button
                  onClick={() => downloadCsv("painpoints_csv", selectedEntry.path)}
                  className="w-full px-3 py-2 text-xs font-semibold text-left border border-gray-300 rounded hover:bg-gray-50"
                >
                  Download Pain Points (CSV)
                </button>
              </div>

              {/* File path info */}
              <div className="mt-4 p-3 bg-gray-50 rounded">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">File Path</p>
                <p className="text-xs text-gray-600 font-mono break-all">{miDir}/{selectedEntry.path}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Range Report */}
      <div className={card}>
        <h2 className={heading}>Custom Date Range Export</h2>
        <p className="text-xs text-gray-500 mb-3">
          Generate an aggregated analysis across all runs within a date range. Use this for quarterly business reviews or custom reporting periods.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <button
            onClick={generateRangeReport}
            disabled={generatingReport}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
          >
            {generatingReport ? "Generating..." : "Generate Range Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

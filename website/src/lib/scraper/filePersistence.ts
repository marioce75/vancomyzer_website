/**
 * Market Intelligence — File Persistence Layer.
 *
 * Saves every scrape run to a structured directory hierarchy on disk,
 * maintains an index of all files, and provides retrieval functions
 * for the admin dashboard and API routes.
 *
 * Directory structure:
 *   market_intelligence/
 *     raw/              — one JSON per run (YYYY-MM-DD_HH-MM_raw_posts.json)
 *     analysis/         — one JSON per run (YYYY-MM-DD_HH-MM_analysis.json)
 *     weekly_digests/   — one JSON per week (YYYY-WNN_weekly_digest.json)
 *     reports/          — archive of downloaded reports (YYYY-MM/ subdirs)
 *     latest_raw.json
 *     latest_analysis.json
 *     scraper_index.json
 */

import fs from "fs";
import path from "path";
import type { ScraperAnalysisRow } from "./db";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function findRepoRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export const REPO_ROOT = findRepoRoot();
export const MI_DIR = path.join(REPO_ROOT, "market_intelligence");
export const RAW_DIR = path.join(MI_DIR, "raw");
export const ANALYSIS_DIR = path.join(MI_DIR, "analysis");
export const WEEKLY_DIR = path.join(MI_DIR, "weekly_digests");
export const REPORTS_DIR = path.join(MI_DIR, "reports");
export const LATEST_RAW = path.join(MI_DIR, "latest_raw.json");
export const LATEST_ANALYSIS = path.join(MI_DIR, "latest_analysis.json");
export const INDEX_FILE = path.join(MI_DIR, "scraper_index.json");

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface RawPost {
  source: string;
  source_identifier: string;
  post_id: string;
  title: string;
  body_text: string | null;
  url: string | null;
  upvote_count: number;
  comment_count: number;
  published_at: string | null;
  top_comments: string;
}

export interface IndexEntry {
  filename: string;
  path: string;
  run_date: string;
  post_count: number;
  file_size_bytes: number;
  description: string;
}

export interface ScraperIndex {
  entries: IndexEntry[];
  last_updated: string;
}

interface WeeklyDigest {
  week: string;
  runs: string[];
  aggregated: {
    total_posts: number;
    new_posts: number;
    pain_points: { text: string; count: number }[];
    drug_mentions: Record<string, number>;
    competitor_mentions: Record<string, { count: number; positive: number; neutral: number; negative: number; posts: string[] }>;
    geographic_signals: Record<string, number>;
  };
  individual_runs: { run_date: string; analysis: Record<string, unknown> }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatTimestamp(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}_${pad2(date.getHours())}-${pad2(date.getMinutes())}`;
}

export function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

function safeJsonParse<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Directory management
// ---------------------------------------------------------------------------

export function ensureDirectories(): void {
  for (const dir of [MI_DIR, RAW_DIR, ANALYSIS_DIR, WEEKLY_DIR, REPORTS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ entries: [], last_updated: new Date().toISOString() }, null, 2));
  }
}

// ---------------------------------------------------------------------------
// Index management
// ---------------------------------------------------------------------------

function readIndex(): ScraperIndex {
  if (!fs.existsSync(INDEX_FILE)) return { entries: [], last_updated: new Date().toISOString() };
  return safeJsonParse(fs.readFileSync(INDEX_FILE, "utf-8"), { entries: [], last_updated: new Date().toISOString() });
}

function writeIndex(index: ScraperIndex): void {
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function addToIndex(entry: IndexEntry): void {
  const index = readIndex();
  const existing = index.entries.findIndex(e => e.path === entry.path);
  if (existing >= 0) {
    index.entries[existing] = entry;
  } else {
    index.entries.push(entry);
  }
  writeIndex(index);
}

// ---------------------------------------------------------------------------
// Weekly digest merge
// ---------------------------------------------------------------------------

function mergeAnalysisIntoDigest(
  digest: WeeklyDigest,
  analysis: ScraperAnalysisRow,
  runTimestamp: string,
): void {
  if (!digest.runs.includes(runTimestamp)) digest.runs.push(runTimestamp);

  digest.individual_runs.push({
    run_date: analysis.run_date,
    analysis: {
      run_id: analysis.run_id,
      total_posts_scraped: analysis.total_posts_scraped,
      new_posts_this_run: analysis.new_posts_this_run,
      top_pain_points: analysis.top_pain_points,
      drug_mentions: analysis.drug_mentions,
      competitor_mentions: analysis.competitor_mentions,
      top_posts: analysis.top_posts,
      geographic_signals: analysis.geographic_signals,
      run_duration_seconds: analysis.run_duration_seconds,
      status: analysis.status,
    },
  });

  digest.aggregated.total_posts += analysis.total_posts_scraped;
  digest.aggregated.new_posts += analysis.new_posts_this_run;

  // Pain points
  const newPP = safeJsonParse<{ text: string; count: number }[]>(analysis.top_pain_points, []);
  for (const pp of newPP) {
    const ex = digest.aggregated.pain_points.find(e => e.text === pp.text);
    if (ex) ex.count += pp.count;
    else digest.aggregated.pain_points.push({ ...pp });
  }
  digest.aggregated.pain_points.sort((a, b) => b.count - a.count);

  // Drug mentions
  const newDrugs = safeJsonParse<Record<string, number>>(analysis.drug_mentions, {});
  for (const [drug, count] of Object.entries(newDrugs)) {
    digest.aggregated.drug_mentions[drug] = (digest.aggregated.drug_mentions[drug] ?? 0) + count;
  }

  // Competitor mentions
  const newComps = safeJsonParse<Record<string, { count: number; positive: number; neutral: number; negative: number; posts: string[] }>>(analysis.competitor_mentions, {});
  for (const [name, data] of Object.entries(newComps)) {
    if (!digest.aggregated.competitor_mentions[name]) {
      digest.aggregated.competitor_mentions[name] = { ...data };
    } else {
      const ex = digest.aggregated.competitor_mentions[name];
      ex.count += data.count || 0;
      ex.positive += data.positive || 0;
      ex.neutral += data.neutral || 0;
      ex.negative += data.negative || 0;
      if (data.posts) ex.posts = [...ex.posts, ...data.posts].slice(0, 10);
    }
  }

  // Geographic signals
  const newGeo = safeJsonParse<Record<string, number>>(analysis.geographic_signals, {});
  for (const [region, count] of Object.entries(newGeo)) {
    digest.aggregated.geographic_signals[region] = (digest.aggregated.geographic_signals[region] ?? 0) + count;
  }
}

function emptyDigest(weekStr: string): WeeklyDigest {
  return {
    week: weekStr,
    runs: [],
    aggregated: {
      total_posts: 0, new_posts: 0,
      pain_points: [], drug_mentions: {},
      competitor_mentions: {}, geographic_signals: {},
    },
    individual_runs: [],
  };
}

// ---------------------------------------------------------------------------
// Build analysis data object from DB row (parse JSON fields)
// ---------------------------------------------------------------------------

function analysisToObject(row: ScraperAnalysisRow): Record<string, unknown> {
  return {
    run_id: row.run_id,
    run_date: row.run_date,
    total_posts_scraped: row.total_posts_scraped,
    new_posts_this_run: row.new_posts_this_run,
    top_pain_points: safeJsonParse(row.top_pain_points, []),
    drug_mentions: safeJsonParse(row.drug_mentions, {}),
    competitor_mentions: safeJsonParse(row.competitor_mentions, {}),
    top_posts: safeJsonParse(row.top_posts, []),
    geographic_signals: safeJsonParse(row.geographic_signals, {}),
    run_duration_seconds: row.run_duration_seconds,
    status: row.status,
    error_message: row.error_message,
  };
}

// ---------------------------------------------------------------------------
// Main save sequence
// ---------------------------------------------------------------------------

export function saveRunToFiles(
  rawPosts: RawPost[],
  analysis: ScraperAnalysisRow,
  runDate?: Date,
): { filesWritten: string[]; errors: string[] } {
  const now = runDate ?? new Date();
  const timestamp = formatTimestamp(now);
  const filesWritten: string[] = [];
  const errors: string[] = [];

  // Step 0 — ensure directories
  try {
    ensureDirectories();
  } catch (err) {
    errors.push(`Step 0 (ensure directories): ${(err as Error).message}`);
    return { filesWritten, errors };
  }

  // Step 1 — save raw posts
  const rawFilename = `${timestamp}_raw_posts.json`;
  const rawPath = path.join(RAW_DIR, rawFilename);
  try {
    fs.writeFileSync(rawPath, JSON.stringify(rawPosts, null, 2));
    filesWritten.push(rawPath);
    console.log(`[FILES] Step 1: Saved ${rawPosts.length} raw posts → ${rawFilename}`);
  } catch (err) {
    errors.push(`Step 1 (save raw posts): ${(err as Error).message}`);
  }

  // Step 2 — save analysis
  const analysisFilename = `${timestamp}_analysis.json`;
  const analysisPath = path.join(ANALYSIS_DIR, analysisFilename);
  const analysisData = analysisToObject(analysis);
  try {
    fs.writeFileSync(analysisPath, JSON.stringify(analysisData, null, 2));
    filesWritten.push(analysisPath);
    console.log(`[FILES] Step 2: Saved analysis → ${analysisFilename}`);
  } catch (err) {
    errors.push(`Step 2 (save analysis): ${(err as Error).message}`);
  }

  // Step 3 — overwrite latest_raw.json
  try {
    fs.writeFileSync(LATEST_RAW, JSON.stringify(rawPosts, null, 2));
    filesWritten.push(LATEST_RAW);
    console.log("[FILES] Step 3: Updated latest_raw.json");
  } catch (err) {
    errors.push(`Step 3 (latest_raw.json): ${(err as Error).message}`);
  }

  // Step 4 — overwrite latest_analysis.json
  try {
    fs.writeFileSync(LATEST_ANALYSIS, JSON.stringify(analysisData, null, 2));
    filesWritten.push(LATEST_ANALYSIS);
    console.log("[FILES] Step 4: Updated latest_analysis.json");
  } catch (err) {
    errors.push(`Step 4 (latest_analysis.json): ${(err as Error).message}`);
  }

  // Step 5 — update weekly digest
  const weekStr = getISOWeekString(now);
  const weekFilename = `${weekStr}_weekly_digest.json`;
  const weekPath = path.join(WEEKLY_DIR, weekFilename);
  try {
    const digest: WeeklyDigest = fs.existsSync(weekPath)
      ? safeJsonParse(fs.readFileSync(weekPath, "utf-8"), emptyDigest(weekStr))
      : emptyDigest(weekStr);
    mergeAnalysisIntoDigest(digest, analysis, timestamp);
    fs.writeFileSync(weekPath, JSON.stringify(digest, null, 2));
    filesWritten.push(weekPath);
    console.log(`[FILES] Step 5: Updated weekly digest → ${weekFilename}`);
  } catch (err) {
    errors.push(`Step 5 (weekly digest): ${(err as Error).message}`);
  }

  // Step 6 — update scraper_index.json
  try {
    const rawSize = fs.existsSync(rawPath) ? fs.statSync(rawPath).size : 0;
    const analysisSize = fs.existsSync(analysisPath) ? fs.statSync(analysisPath).size : 0;
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;

    addToIndex({
      filename: rawFilename,
      path: `raw/${rawFilename}`,
      run_date: now.toISOString(),
      post_count: rawPosts.length,
      file_size_bytes: rawSize,
      description: `Raw posts from scrape run on ${dateStr} ${timeStr}`,
    });
    addToIndex({
      filename: analysisFilename,
      path: `analysis/${analysisFilename}`,
      run_date: now.toISOString(),
      post_count: rawPosts.length,
      file_size_bytes: analysisSize,
      description: `Analysis from scrape run on ${dateStr} — ${analysis.new_posts_this_run} new posts`,
    });
    filesWritten.push(INDEX_FILE);
    console.log("[FILES] Step 6: Updated scraper_index.json");
  } catch (err) {
    errors.push(`Step 6 (scraper index): ${(err as Error).message}`);
  }

  // Step 7 — DB write already handled by engine.ts

  // Step 8 — log summary
  console.log(`[FILES] Save complete: ${filesWritten.length} files written, ${rawPosts.length} posts saved`);
  if (errors.length > 0) {
    console.error(`[FILES] ${errors.length} error(s) during save:`);
    errors.forEach(e => console.error(`  - ${e}`));
  }
  filesWritten.forEach(f => console.log(`  - ${f}`));

  // Write .last_run_summary for GitHub Actions commit message
  try {
    const localDate = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
    const summaryPath = path.join(MI_DIR, ".last_run_summary");
    fs.writeFileSync(summaryPath, `date=${localDate}\nposts=${rawPosts.length}\nnew_posts=${analysis.new_posts_this_run}\nfiles=${filesWritten.length}\n`);
  } catch { /* non-critical */ }

  return { filesWritten, errors };
}

// ---------------------------------------------------------------------------
// Report archiving (called when admin downloads a report)
// ---------------------------------------------------------------------------

export function archiveReport(content: string, filename: string, ext: "csv" | "json"): string {
  ensureDirectories();
  const now = new Date();
  const monthDir = path.join(REPORTS_DIR, `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
  if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });

  const ts = formatTimestamp(now);
  const archiveFilename = `${ts}_${filename}.${ext}`;
  const archivePath = path.join(monthDir, archiveFilename);
  fs.writeFileSync(archivePath, content);

  addToIndex({
    filename: archiveFilename,
    path: `reports/${now.getFullYear()}-${pad2(now.getMonth() + 1)}/${archiveFilename}`,
    run_date: now.toISOString(),
    post_count: 0,
    file_size_bytes: Buffer.byteLength(content),
    description: `Downloaded report: ${filename}`,
  });

  return archivePath;
}

// ---------------------------------------------------------------------------
// Retrieval functions (used by API routes)
// ---------------------------------------------------------------------------

export function getIndex(): ScraperIndex {
  ensureDirectories();
  return readIndex();
}

export function getLatestAnalysisFile(): Record<string, unknown> | null {
  if (!fs.existsSync(LATEST_ANALYSIS)) return null;
  return safeJsonParse(fs.readFileSync(LATEST_ANALYSIS, "utf-8"), null);
}

export function getRunsByDate(dateStr: string): Record<string, unknown>[] {
  const index = readIndex();
  const matching = index.entries.filter(
    e => e.path.startsWith("analysis/") && e.run_date.startsWith(dateStr),
  );
  const results: Record<string, unknown>[] = [];
  for (const entry of matching) {
    const fp = path.join(MI_DIR, entry.path);
    if (fs.existsSync(fp)) {
      results.push(safeJsonParse(fs.readFileSync(fp, "utf-8"), {}));
    }
  }
  return results;
}

export function getWeeklyDigestFile(weekStr: string): WeeklyDigest | null {
  const fp = path.join(WEEKLY_DIR, `${weekStr}_weekly_digest.json`);
  if (!fs.existsSync(fp)) return null;
  return safeJsonParse(fs.readFileSync(fp, "utf-8"), null);
}

export function getAnalysisRange(startDate: string, endDate: string): Record<string, unknown> {
  const index = readIndex();
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const matching = index.entries.filter(e => {
    if (!e.path.startsWith("analysis/")) return false;
    const d = new Date(e.run_date);
    return d >= start && d <= end;
  });

  const merged = {
    date_range: { start: startDate, end: endDate },
    run_count: 0,
    total_posts: 0,
    total_new_posts: 0,
    pain_points: [] as { text: string; count: number }[],
    drug_mentions: {} as Record<string, number>,
    competitor_mentions: {} as Record<string, Record<string, unknown>>,
    geographic_signals: {} as Record<string, number>,
    runs: [] as Record<string, unknown>[],
  };

  for (const entry of matching) {
    const fp = path.join(MI_DIR, entry.path);
    if (!fs.existsSync(fp)) continue;
    const a = safeJsonParse<Record<string, unknown>>(fs.readFileSync(fp, "utf-8"), {});

    merged.run_count++;
    merged.total_posts += (a.total_posts_scraped as number) || 0;
    merged.total_new_posts += (a.new_posts_this_run as number) || 0;
    merged.runs.push({
      run_date: a.run_date,
      total_posts_scraped: a.total_posts_scraped,
      new_posts_this_run: a.new_posts_this_run,
      run_duration_seconds: a.run_duration_seconds,
    });

    // Pain points
    const pp = (a.top_pain_points || []) as { text: string; count: number }[];
    for (const p of pp) {
      const ex = merged.pain_points.find(e => e.text === p.text);
      if (ex) ex.count += p.count; else merged.pain_points.push({ ...p });
    }

    // Drug mentions
    const dm = (a.drug_mentions || {}) as Record<string, number>;
    for (const [drug, count] of Object.entries(dm)) {
      merged.drug_mentions[drug] = (merged.drug_mentions[drug] ?? 0) + count;
    }

    // Competitor mentions
    const cm = (a.competitor_mentions || {}) as Record<string, { count: number; positive: number; neutral: number; negative: number }>;
    for (const [name, data] of Object.entries(cm)) {
      if (!merged.competitor_mentions[name]) {
        merged.competitor_mentions[name] = { ...data };
      } else {
        const ex = merged.competitor_mentions[name] as Record<string, number>;
        ex.count = (ex.count || 0) + (data.count || 0);
        ex.positive = (ex.positive || 0) + (data.positive || 0);
        ex.neutral = (ex.neutral || 0) + (data.neutral || 0);
        ex.negative = (ex.negative || 0) + (data.negative || 0);
      }
    }

    // Geographic signals
    const geo = (a.geographic_signals || {}) as Record<string, number>;
    for (const [region, count] of Object.entries(geo)) {
      merged.geographic_signals[region] = (merged.geographic_signals[region] ?? 0) + count;
    }
  }

  merged.pain_points.sort((a, b) => b.count - a.count);
  return merged;
}

export function getFileContents(relativePath: string): Buffer | null {
  const fullPath = path.resolve(MI_DIR, relativePath);
  if (!fullPath.startsWith(path.resolve(MI_DIR))) return null; // prevent traversal
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath);
}

// ---------------------------------------------------------------------------
// Historical data import
// ---------------------------------------------------------------------------

export function importHistoricalData(): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  ensureDirectories();

  // 1. Check for legacy JSON files at project root
  const legacyFiles = [
    { raw: "market_research_raw.json", summary: "market_research_summary.json" },
  ];

  for (const { raw, summary } of legacyFiles) {
    const rawPath = path.join(REPO_ROOT, raw);
    if (fs.existsSync(rawPath)) {
      try {
        const stat = fs.statSync(rawPath);
        const ts = formatTimestamp(stat.mtime);
        const content = fs.readFileSync(rawPath, "utf-8");
        const posts = safeJsonParse<unknown[]>(content, []);

        const destFilename = `${ts}_raw_posts.json`;
        const dest = path.join(RAW_DIR, destFilename);
        if (!fs.existsSync(dest)) {
          fs.writeFileSync(dest, JSON.stringify(posts, null, 2));
          addToIndex({
            filename: destFilename, path: `raw/${destFilename}`,
            run_date: stat.mtime.toISOString(), post_count: posts.length,
            file_size_bytes: fs.statSync(dest).size,
            description: `Historical import from ${raw}`,
          });
          imported++;
          console.log(`[IMPORT] Imported ${raw} → ${destFilename}`);
        }
      } catch (err) { errors.push(`Import ${raw}: ${(err as Error).message}`); }
    }

    const summaryPath = path.join(REPO_ROOT, summary);
    if (fs.existsSync(summaryPath)) {
      try {
        const stat = fs.statSync(summaryPath);
        const ts = formatTimestamp(stat.mtime);
        const content = fs.readFileSync(summaryPath, "utf-8");
        const data = safeJsonParse<Record<string, unknown>>(content, {});

        const destFilename = `${ts}_analysis.json`;
        const dest = path.join(ANALYSIS_DIR, destFilename);
        if (!fs.existsSync(dest)) {
          fs.writeFileSync(dest, JSON.stringify(data, null, 2));
          addToIndex({
            filename: destFilename, path: `analysis/${destFilename}`,
            run_date: stat.mtime.toISOString(), post_count: 0,
            file_size_bytes: fs.statSync(dest).size,
            description: `Historical import from ${summary}`,
          });
          imported++;
          console.log(`[IMPORT] Imported ${summary} → ${destFilename}`);
        }
      } catch (err) { errors.push(`Import ${summary}: ${(err as Error).message}`); }
    }
  }

  // 2. Import from database
  try {
    const dbMod = require("./db") as typeof import("./db"); // dynamic require for standalone script compat
    dbMod.ensureScraperTables();
    const runs = dbMod.getRecentRuns(100);
    const allPosts = dbMod.getAllPosts();

    for (const run of runs) {
      const runDate = new Date(run.run_date);
      const ts = formatTimestamp(runDate);

      // Analysis file
      const analysisFilename = `${ts}_analysis.json`;
      const analysisDest = path.join(ANALYSIS_DIR, analysisFilename);
      if (!fs.existsSync(analysisDest)) {
        const obj = analysisToObject(run);
        fs.writeFileSync(analysisDest, JSON.stringify(obj, null, 2));
        addToIndex({
          filename: analysisFilename, path: `analysis/${analysisFilename}`,
          run_date: runDate.toISOString(), post_count: run.total_posts_scraped,
          file_size_bytes: fs.statSync(analysisDest).size,
          description: `Historical import from DB run #${run.run_id} — ${run.new_posts_this_run} new posts`,
        });
        imported++;
      }

      // Raw posts — only for most recent run (we can't distinguish per-run posts)
      if (run.run_id === runs[0]?.run_id && allPosts.length > 0) {
        const rawFilename = `${ts}_raw_posts.json`;
        const rawDest = path.join(RAW_DIR, rawFilename);
        if (!fs.existsSync(rawDest)) {
          const rawData = allPosts.map(p => ({
            source: p.source, source_identifier: p.source_identifier,
            post_id: p.post_id, title: p.title, body_text: p.body_text,
            url: p.url, upvote_count: p.upvote_count, comment_count: p.comment_count,
            published_at: p.published_at, top_comments: p.top_comments,
          }));
          fs.writeFileSync(rawDest, JSON.stringify(rawData, null, 2));
          addToIndex({
            filename: rawFilename, path: `raw/${rawFilename}`,
            run_date: runDate.toISOString(), post_count: rawData.length,
            file_size_bytes: fs.statSync(rawDest).size,
            description: `Historical import — all posts from DB (${rawData.length} total)`,
          });
          imported++;

          // Set as latest
          fs.writeFileSync(LATEST_RAW, JSON.stringify(rawData, null, 2));
        }
      }

      // Weekly digest
      const weekStr = getISOWeekString(runDate);
      const weekPath = path.join(WEEKLY_DIR, `${weekStr}_weekly_digest.json`);
      let digest: WeeklyDigest = fs.existsSync(weekPath)
        ? safeJsonParse(fs.readFileSync(weekPath, "utf-8"), emptyDigest(weekStr))
        : emptyDigest(weekStr);
      if (!digest.runs.includes(ts)) {
        mergeAnalysisIntoDigest(digest, run, ts);
        fs.writeFileSync(weekPath, JSON.stringify(digest, null, 2));
      }
    }

    // Set latest_analysis from most recent run
    if (runs.length > 0) {
      const latestObj = analysisToObject(runs[0]);
      fs.writeFileSync(LATEST_ANALYSIS, JSON.stringify(latestObj, null, 2));
    }
  } catch (err) {
    errors.push(`Database import: ${(err as Error).message}`);
  }

  console.log(`[IMPORT] Complete: ${imported} files imported, ${errors.length} error(s)`);
  return { imported, errors };
}

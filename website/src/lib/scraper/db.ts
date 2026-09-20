/**
 * Market Intelligence Scraper — database layer.
 * Separate tables in the same SQLite file.
 */

import db from "@/lib/db";

let _initialized = false;

export function ensureScraperTables(): void {
  if (_initialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS scraper_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_identifier TEXT NOT NULL,
      post_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body_text TEXT,
      url TEXT,
      upvote_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      published_at TEXT,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      top_comments TEXT DEFAULT '[]',
      UNIQUE(source, post_id)
    );

    CREATE TABLE IF NOT EXISTS scraper_analysis (
      run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL DEFAULT (datetime('now')),
      total_posts_scraped INTEGER DEFAULT 0,
      new_posts_this_run INTEGER DEFAULT 0,
      top_pain_points TEXT DEFAULT '[]',
      drug_mentions TEXT DEFAULT '{}',
      competitor_mentions TEXT DEFAULT '{}',
      top_posts TEXT DEFAULT '[]',
      geographic_signals TEXT DEFAULT '{}',
      run_duration_seconds REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS competitor_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      competitor_name TEXT NOT NULL,
      url TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      change_detected INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS scraper_request_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      error TEXT,
      scraped_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_analyst_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER,
      report_date TEXT NOT NULL DEFAULT (datetime('now')),
      market_opportunities TEXT DEFAULT '[]',
      competitive_gaps TEXT DEFAULT '[]',
      innovation_ideas TEXT DEFAULT '[]',
      strategic_recommendations TEXT DEFAULT '[]',
      risk_signals TEXT DEFAULT '[]',
      executive_brief TEXT DEFAULT '',
      raw_prompt TEXT DEFAULT '',
      raw_response TEXT DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_scraper_posts_source ON scraper_posts(source, post_id);
    CREATE INDEX IF NOT EXISTS idx_scraper_posts_scraped ON scraper_posts(scraped_at);
  `);

  for (const sql of [
    "ALTER TABLE scraper_analysis ADD COLUMN source_health TEXT DEFAULT '[]'",
    "ALTER TABLE ai_analyst_reports ADD COLUMN evidence_json TEXT DEFAULT '[]'",
    "ALTER TABLE ai_analyst_reports ADD COLUMN model TEXT DEFAULT ''",
  ]) { try { db.exec(sql); } catch (error) { if (!(error as Error).message.includes("duplicate column")) throw error; } }
  db.exec(`CREATE TABLE IF NOT EXISTS scraper_jobs (kind TEXT PRIMARY KEY, state TEXT NOT NULL, started_at TEXT, expires_at TEXT, message TEXT, updated_at TEXT)`);
  _initialized = true;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface ScraperPost {
  id: number;
  source: string;
  source_identifier: string;
  post_id: string;
  title: string;
  body_text: string | null;
  url: string | null;
  upvote_count: number;
  comment_count: number;
  published_at: string | null;
  scraped_at: string;
  top_comments: string;
}

export function insertPost(post: Omit<ScraperPost, "id" | "scraped_at">): boolean {
  ensureScraperTables();
  const existed = Boolean(db.prepare("SELECT 1 FROM scraper_posts WHERE source = ? AND post_id = ?").get(post.source, post.post_id));
  db.prepare(`INSERT INTO scraper_posts
    (source, source_identifier, post_id, title, body_text, url, upvote_count, comment_count, published_at, top_comments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, post_id) DO UPDATE SET title=excluded.title, body_text=excluded.body_text,
      url=excluded.url, upvote_count=excluded.upvote_count, comment_count=excluded.comment_count,
      published_at=excluded.published_at, scraped_at=datetime('now')`).run(
    post.source, post.source_identifier, post.post_id, post.title, post.body_text?.substring(0, 2000) ?? null,
    post.url, post.upvote_count, post.comment_count, post.published_at, post.top_comments);
  return !existed;
}

export function getRecentPosts(days = 30, limit = 500): ScraperPost[] {
  ensureScraperTables();
  return db.prepare(
    `SELECT * FROM scraper_posts WHERE scraped_at > datetime('now', '-${days} days') ORDER BY upvote_count DESC LIMIT ?`
  ).all(limit) as ScraperPost[];
}

export function getHighSignalPosts(minUpvotes = 200, days = 30): ScraperPost[] {
  ensureScraperTables();
  return db.prepare(
    `SELECT * FROM scraper_posts WHERE upvote_count >= ? AND scraped_at > datetime('now', '-${days} days') ORDER BY upvote_count DESC`
  ).all(minUpvotes) as ScraperPost[];
}

export function getAllPosts(): ScraperPost[] {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_posts ORDER BY scraped_at DESC").all() as ScraperPost[];
}

// ---------------------------------------------------------------------------
// Analysis runs
// ---------------------------------------------------------------------------

export interface ScraperAnalysisRow {
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

export function insertAnalysisRun(run: Omit<ScraperAnalysisRow, "run_id">): number {
  ensureScraperTables();
  const result = db.prepare(`INSERT INTO scraper_analysis
    (run_date, total_posts_scraped, new_posts_this_run, top_pain_points, drug_mentions,
     competitor_mentions, top_posts, geographic_signals, run_duration_seconds, status, error_message, source_health)
    VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    run.total_posts_scraped, run.new_posts_this_run, run.top_pain_points,
    run.drug_mentions, run.competitor_mentions, run.top_posts,
    run.geographic_signals, run.run_duration_seconds, run.status, run.error_message, run.source_health ?? "[]"
  );
  return Number(result.lastInsertRowid);
}

export function getRecentRuns(limit = 10): ScraperAnalysisRow[] {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_analysis ORDER BY run_id DESC LIMIT ?").all(limit) as ScraperAnalysisRow[];
}

export function getLatestRun(): ScraperAnalysisRow | undefined {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_analysis ORDER BY run_id DESC LIMIT 1").get() as ScraperAnalysisRow | undefined;
}

export function getRunById(runId: number): ScraperAnalysisRow | undefined {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_analysis WHERE run_id = ?").get(runId) as ScraperAnalysisRow | undefined;
}

// ---------------------------------------------------------------------------
// AI Analyst Reports
// ---------------------------------------------------------------------------

export interface AiAnalystReport {
  id: number;
  run_id: number | null;
  report_date: string;
  market_opportunities: string;
  competitive_gaps: string;
  innovation_ideas: string;
  strategic_recommendations: string;
  risk_signals: string;
  executive_brief: string;
  raw_prompt: string;
  raw_response: string;
  evidence_json: string;
  model: string;
}

export function insertAiReport(report: Omit<AiAnalystReport, "id" | "report_date">): number {
  ensureScraperTables();
  const result = db.prepare(`INSERT INTO ai_analyst_reports
    (run_id, market_opportunities, competitive_gaps, innovation_ideas,
     strategic_recommendations, risk_signals, executive_brief, raw_prompt, raw_response, evidence_json, model)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    report.run_id, report.market_opportunities, report.competitive_gaps,
    report.innovation_ideas, report.strategic_recommendations,
    report.risk_signals, report.executive_brief, report.raw_prompt, report.raw_response, report.evidence_json, report.model
  );
  return Number(result.lastInsertRowid);
}

export function getLatestAiReport(): AiAnalystReport | undefined {
  ensureScraperTables();
  return db.prepare("SELECT * FROM ai_analyst_reports ORDER BY id DESC LIMIT 1").get() as AiAnalystReport | undefined;
}

export function getAiReports(limit = 10): AiAnalystReport[] {
  ensureScraperTables();
  return db.prepare("SELECT * FROM ai_analyst_reports ORDER BY id DESC LIMIT ?").all(limit) as AiAnalystReport[];
}

// ---------------------------------------------------------------------------
// Competitor snapshots
// ---------------------------------------------------------------------------

export function getLatestSnapshot(competitor: string, url: string): { content_hash: string } | undefined {
  ensureScraperTables();
  return db.prepare(
    "SELECT content_hash FROM competitor_snapshots WHERE competitor_name = ? AND url = ? ORDER BY id DESC LIMIT 1"
  ).get(competitor, url) as { content_hash: string } | undefined;
}

export function insertSnapshot(competitor: string, url: string, hash: string, changed: boolean): void {
  ensureScraperTables();
  db.prepare(
    "INSERT INTO competitor_snapshots (competitor_name, url, content_hash, change_detected) VALUES (?, ?, ?, ?)"
  ).run(competitor, url, hash, changed ? 1 : 0);
}

export function getCompetitorChanges(days = 30): { competitor_name: string; url: string; scraped_at: string; change_detected: number }[] {
  ensureScraperTables();
  return db.prepare(
    `SELECT competitor_name, url, scraped_at, change_detected FROM competitor_snapshots s
     WHERE length(content_hash) = 64 AND EXISTS (SELECT 1 FROM competitor_snapshots prior WHERE prior.competitor_name=s.competitor_name AND prior.url=s.url AND prior.id<s.id AND length(prior.content_hash)=64) AND scraped_at > datetime('now', '-${days} days') AND change_detected = 1
     ORDER BY scraped_at DESC`
  ).all() as { competitor_name: string; url: string; scraped_at: string; change_detected: number }[];
}

// ---------------------------------------------------------------------------
// Request log
// ---------------------------------------------------------------------------

export function logRequest(url: string, statusCode: number | null, responseTimeMs: number, error?: string): void {
  ensureScraperTables();
  db.prepare("INSERT INTO scraper_request_log (url, status_code, response_time_ms, error) VALUES (?, ?, ?, ?)").run(
    url, statusCode, responseTimeMs, error ?? null
  );
}


export function getEvidencePosts(): ScraperPost[] {
  ensureScraperTables();
  const sources = db.prepare("SELECT DISTINCT source, source_identifier FROM scraper_posts WHERE scraped_at > datetime('now','-30 days')").all() as { source: string; source_identifier: string }[];
  return sources.flatMap(({ source, source_identifier }) => db.prepare("SELECT * FROM scraper_posts WHERE source = ? AND source_identifier = ? AND scraped_at > datetime('now','-30 days') ORDER BY scraped_at DESC, id DESC LIMIT 8").all(source, source_identifier) as ScraperPost[]);
}
export interface JobStatus { kind: string; state: string; started_at: string | null; expires_at: string | null; message: string; updated_at: string }
export function getJob(kind: string): JobStatus | undefined {
  ensureScraperTables();
  db.prepare("UPDATE scraper_jobs SET state='failed', message='Run interrupted or timed out. Retry the job.', updated_at=datetime('now') WHERE kind=? AND state='running' AND expires_at < datetime('now')").run(kind);
  return db.prepare("SELECT * FROM scraper_jobs WHERE kind=?").get(kind) as JobStatus | undefined;
}
export function acquireJob(kind: string, seconds = 900): boolean {
  ensureScraperTables();
  getJob(kind);
  return db.prepare(`INSERT INTO scraper_jobs(kind,state,started_at,expires_at,message,updated_at)
    VALUES (?, 'running', datetime('now'), datetime('now', ?), 'Working…', datetime('now'))
    ON CONFLICT(kind) DO UPDATE SET state='running', started_at=excluded.started_at, expires_at=excluded.expires_at, message=excluded.message, updated_at=excluded.updated_at
    WHERE scraper_jobs.state <> 'running'`).run(kind, `+${seconds} seconds`).changes > 0;
}
export function finishJob(kind: string, state: string, message: string): void {
  ensureScraperTables();
  db.prepare("UPDATE scraper_jobs SET state=?,message=?,updated_at=datetime('now') WHERE kind=?").run(state, message, kind);
}

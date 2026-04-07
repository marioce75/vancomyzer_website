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

    CREATE INDEX IF NOT EXISTS idx_scraper_posts_source ON scraper_posts(source, post_id);
    CREATE INDEX IF NOT EXISTS idx_scraper_posts_scraped ON scraper_posts(scraped_at);
  `);

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
  try {
    db.prepare(`INSERT OR IGNORE INTO scraper_posts
      (source, source_identifier, post_id, title, body_text, url, upvote_count, comment_count, published_at, top_comments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      post.source, post.source_identifier, post.post_id, post.title,
      post.body_text?.substring(0, 2000) ?? null,
      post.url, post.upvote_count, post.comment_count, post.published_at,
      post.top_comments
    );
    return (db.prepare("SELECT changes() as c").get() as { c: number }).c > 0;
  } catch {
    return false;
  }
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
}

export function insertAnalysisRun(run: Omit<ScraperAnalysisRow, "run_id">): number {
  ensureScraperTables();
  const result = db.prepare(`INSERT INTO scraper_analysis
    (run_date, total_posts_scraped, new_posts_this_run, top_pain_points, drug_mentions,
     competitor_mentions, top_posts, geographic_signals, run_duration_seconds, status, error_message)
    VALUES (datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    run.total_posts_scraped, run.new_posts_this_run, run.top_pain_points,
    run.drug_mentions, run.competitor_mentions, run.top_posts,
    run.geographic_signals, run.run_duration_seconds, run.status, run.error_message
  );
  return Number(result.lastInsertRowid);
}

export function getRecentRuns(limit = 10): ScraperAnalysisRow[] {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_analysis ORDER BY run_date DESC LIMIT ?").all(limit) as ScraperAnalysisRow[];
}

export function getLatestRun(): ScraperAnalysisRow | undefined {
  ensureScraperTables();
  return db.prepare("SELECT * FROM scraper_analysis ORDER BY run_date DESC LIMIT 1").get() as ScraperAnalysisRow | undefined;
}

// ---------------------------------------------------------------------------
// Competitor snapshots
// ---------------------------------------------------------------------------

export function getLatestSnapshot(competitor: string, url: string): { content_hash: string } | undefined {
  ensureScraperTables();
  return db.prepare(
    "SELECT content_hash FROM competitor_snapshots WHERE competitor_name = ? AND url = ? ORDER BY scraped_at DESC LIMIT 1"
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
    `SELECT competitor_name, url, scraped_at, change_detected FROM competitor_snapshots
     WHERE scraped_at > datetime('now', '-${days} days') AND change_detected = 1
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

/**
 * Market Intelligence Scraper Engine.
 *
 * Fetches posts from Reddit, PubMed, and competitor pages.
 * Stores results in SQLite and runs analysis.
 */

import crypto from "crypto";
import { insertPost, logRequest, getLatestSnapshot, insertSnapshot } from "./db";
import { REDDIT_SOURCES, PUBMED_SEARCHES, COMPETITOR_URLS } from "./sources";
import { runAnalysis } from "./analysis";

const USER_AGENT = "Dosys Health LLC-MarketResearch/1.0";

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithLog(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
    const text = await res.text();
    const elapsed = Date.now() - start;
    logRequest(url, res.status, elapsed);
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    const elapsed = Date.now() - start;
    logRequest(url, null, elapsed, (err as Error).message);
    return { ok: false, status: 0, text: "" };
  }
}

// ---------------------------------------------------------------------------
// Reddit Scraper
// ---------------------------------------------------------------------------

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    url: string;
    permalink: string;
    ups: number;
    num_comments: number;
    created_utc: number;
    subreddit: string;
  };
}

async function scrapeRedditSubreddit(subreddit: string, term: string): Promise<number> {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(term)}&sort=top&t=year&limit=100&restrict_sr=1`;
  const res = await fetchWithLog(url);

  if (res.status === 429) {
    console.log(`[SCRAPER] Rate limited on r/${subreddit}/${term} — waiting 60s`);
    await sleep(60000);
    const retry = await fetchWithLog(url);
    if (!retry.ok) return 0;
    res.text = retry.text;
    res.ok = retry.ok;
  }

  if (!res.ok) return 0;

  let data: { data?: { children?: RedditPost[] } };
  try {
    data = JSON.parse(res.text);
  } catch {
    return 0;
  }

  const posts = data?.data?.children ?? [];
  let newCount = 0;

  for (const post of posts) {
    const p = post.data;
    const inserted = insertPost({
      source: "reddit",
      source_identifier: subreddit,
      post_id: p.id,
      title: p.title,
      body_text: p.selftext?.substring(0, 2000) || null,
      url: `https://www.reddit.com${p.permalink}`,
      upvote_count: p.ups || 0,
      comment_count: p.num_comments || 0,
      published_at: new Date(p.created_utc * 1000).toISOString(),
      top_comments: "[]", // Would need separate API call per post
    });
    if (inserted) newCount++;
  }

  return newCount;
}

export async function scrapeReddit(): Promise<{ total: number; newPosts: number }> {
  let total = 0;
  let newPosts = 0;

  for (const source of REDDIT_SOURCES) {
    for (const term of source.terms) {
      console.log(`[SCRAPER] Reddit r/${source.subreddit} — "${term}"`);
      const n = await scrapeRedditSubreddit(source.subreddit, term);
      total += 100; // approximate max per query
      newPosts += n;
      await sleep(1500); // Rate limit: 1.5s between calls
    }
  }

  return { total, newPosts };
}

// ---------------------------------------------------------------------------
// PubMed Scraper
// ---------------------------------------------------------------------------

async function scrapePubMed(): Promise<{ total: number; newPosts: number }> {
  let total = 0;
  let newPosts = 0;

  for (const search of PUBMED_SEARCHES) {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(search.query)}&mindate=${search.minDate}&maxdate=3000&retmax=20&retmode=json`;
    const searchRes = await fetchWithLog(searchUrl);
    if (!searchRes.ok) continue;

    let searchData: { esearchresult?: { idlist?: string[] } };
    try {
      searchData = JSON.parse(searchRes.text);
    } catch {
      continue;
    }

    const ids = searchData?.esearchresult?.idlist ?? [];
    if (ids.length === 0) continue;

    await sleep(500);

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const fetchRes = await fetchWithLog(fetchUrl);
    if (!fetchRes.ok) continue;

    let fetchData: { result?: Record<string, { uid?: string; title?: string; source?: string; pubdate?: string; sortfirstauthor?: string }> };
    try {
      fetchData = JSON.parse(fetchRes.text);
    } catch {
      continue;
    }

    const results = fetchData?.result ?? {};
    for (const pmid of ids) {
      const article = results[pmid];
      if (!article?.title) continue;

      const inserted = insertPost({
        source: "pubmed",
        source_identifier: "pubmed",
        post_id: pmid,
        title: article.title,
        body_text: `${article.sortfirstauthor ?? ""} — ${article.source ?? ""}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        upvote_count: 0,
        comment_count: 0,
        published_at: article.pubdate ?? null,
        top_comments: "[]",
      });
      if (inserted) newPosts++;
      total++;
    }

    await sleep(1000);
  }

  return { total, newPosts };
}

// ---------------------------------------------------------------------------
// Competitor Monitor
// ---------------------------------------------------------------------------

async function scrapeCompetitors(): Promise<{ changes: { name: string; url: string }[] }> {
  const changes: { name: string; url: string }[] = [];

  for (const comp of COMPETITOR_URLS) {
    console.log(`[SCRAPER] Checking competitor: ${comp.name}`);
    const res = await fetchWithLog(comp.url);

    if (!res.ok) {
      console.log(`[SCRAPER] ${comp.name} returned ${res.status} — skipping`);
      continue;
    }

    const hash = crypto.createHash("md5").update(res.text).digest("hex");
    const prev = getLatestSnapshot(comp.name, comp.url);
    const changed = prev ? prev.content_hash !== hash : false;

    insertSnapshot(comp.name, comp.url, hash, changed);

    if (changed) {
      changes.push({ name: comp.name, url: comp.url });
      console.log(`[SCRAPER] CHANGE DETECTED: ${comp.name}`);
    }

    await sleep(1000);
  }

  return { changes };
}

// ---------------------------------------------------------------------------
// Full Run
// ---------------------------------------------------------------------------

export async function runFullScrape(): Promise<{
  total: number;
  newPosts: number;
  duration: number;
  changes: { name: string; url: string }[];
  runId: number;
}> {
  const startTime = Date.now();
  console.log("[SCRAPER] Starting full scrape run...");

  // Reddit
  const reddit = await scrapeReddit();
  console.log(`[SCRAPER] Reddit: ${reddit.newPosts} new posts`);

  // PubMed
  const pubmed = await scrapePubMed();
  console.log(`[SCRAPER] PubMed: ${pubmed.newPosts} new articles`);

  // Competitors
  const competitors = await scrapeCompetitors();

  const total = reddit.total + pubmed.total;
  const newPosts = reddit.newPosts + pubmed.newPosts;
  const duration = (Date.now() - startTime) / 1000;

  // Run analysis
  const runId = runAnalysis(total, newPosts, duration);

  console.log(`[SCRAPER] Complete: ${newPosts} new posts, ${duration.toFixed(1)}s, run #${runId}`);

  return { total, newPosts, duration, changes: competitors.changes, runId };
}

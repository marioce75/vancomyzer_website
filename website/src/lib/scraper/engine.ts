/** Public-source collection. No bypasses of blocked sources or sign-in surfaces. */
import crypto from "node:crypto";
import { insertPost, logRequest, getLatestSnapshot, insertSnapshot, getRunById, acquireJob, finishJob } from "./db";
import { REDDIT_SOURCES, PUBMED_SEARCHES, COMPETITOR_URLS, REGIONAL_SEARCHES } from "./sources";
import { runAnalysis } from "./analysis";
import { saveRunToFiles, type RawPost } from "./filePersistence";

export interface SourceHealth { name: string; url: string; state: "ok" | "failed" | "blocked" | "skipped"; records: number; detail?: string }
export function visibleText(html: string): string {
  return html.replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
export function pubmedDate(value: string): string | null {
  const year = value.match(/\b(19|20)\d{2}\b/)?.[0];
  return year ? value : null; // Preserve source precision; never fabricate a publication day.
}
export async function runFullScrape(options: { analyze?: boolean; quick?: boolean } = {}) {
  if (!acquireJob("scraper", 900)) throw new Error("Scraper is already running.");
  const start = Date.now();
  const collected = new Map<string, RawPost>();
  const health: SourceHealth[] = [];
  const blocked = new Set<string>();
  let newPosts = 0;
  const changes: { name: string; url: string }[] = [];
  const profiles: { name: string; features: string[] }[] = [];
  const pause = () => new Promise(resolve => setTimeout(resolve, options.quick ? 400 : 600));
  function insert(post: RawPost) {
    const id = post.url || `${post.source}:${post.post_id}`;
    if (collected.has(id)) return;
    collected.set(id, post);
    if (insertPost(post)) newPosts++;
  }
  async function request(name: string, url: string): Promise<{ body: string; entry: SourceHealth } | null> {
    const entry: SourceHealth = { name, url, state: "failed", records: 0 }; health.push(entry);
    const host = new URL(url).hostname;
    if (blocked.has(host)) { entry.state = "skipped"; entry.detail = "Earlier request was blocked or rate limited; no bypass attempted."; return null; }
    if (Date.now() - start > 720000) { entry.detail = "Run time limit reached; retry later."; return null; }
    const begun = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": "DosysHealth-MarketResearch/1.1 (+https://dosys.health)", ...(host === "oauth.reddit.com" && process.env.REDDIT_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.REDDIT_ACCESS_TOKEN}` } : {}) }, signal: AbortSignal.timeout(15000) });
      logRequest(url, res.status, Date.now() - begun);
      if (!res.ok) {
        entry.state = [401,403,429].includes(res.status) ? "blocked" : "failed";
        entry.detail = `HTTP ${res.status}`;
        if (entry.state === "blocked") blocked.add(host);
        return null;
      }
      const body = await res.text();
      if (!body.trim()) { entry.detail = "Empty response"; return null; }
      entry.state = "ok";
      return { body, entry };
    } catch (error) {
      entry.detail = error instanceof Error && error.name === "TimeoutError" ? "Request timed out" : "Network or DNS failure";
      logRequest(url, null, Date.now() - begun, entry.detail);
      return null;
    } finally { await pause(); }
  }
  function json<T>(res: { body: string; entry: SourceHealth }): T | null {
    try { return JSON.parse(res.body) as T; } catch { res.entry.state = "failed"; res.entry.detail = "Invalid JSON response"; return null; }
  }
  try {
    // A small, recent, relevant sample; never infer market size from Reddit counts.
    if (!process.env.REDDIT_ACCESS_TOKEN) health.push({ name: "Reddit", url: "https://www.reddit.com/dev/api/", state: "skipped", records: 0, detail: "Approved Reddit API access/token not configured. Public JSON requests returned403; no bypass attempted." });
    for (const source of (!process.env.REDDIT_ACCESS_TOKEN ? [] : options.quick ? REDDIT_SOURCES.slice(0, 1) : REDDIT_SOURCES)) {
      for (const term of (options.quick ? source.terms.slice(0, 1) : source.terms.slice(0, 2))) {
        const url = `https://oauth.reddit.com/r/${source.subreddit}/search?q=${encodeURIComponent(term)}&sort=new&t=month&limit=25&restrict_sr=1`;
        const res = await request(`Reddit r/${source.subreddit}: ${term}`, url);
        if (!res) continue;
        const data = json<{ data?: { children?: { data: { id: string; title: string; selftext?: string; permalink: string; ups?: number; num_comments?: number; created_utc: number } }[] } }>(res);
        if (!data?.data?.children) { res.entry.state = "failed"; res.entry.detail = "No Reddit result structure"; continue; }
        for (const { data: p } of data.data.children) {
          if (!p.id || !p.title || !p.permalink || !Number.isFinite(p.created_utc)) continue;
          insert({ source: "reddit", source_identifier: source.subreddit, post_id: p.id, title: p.title, body_text: p.selftext?.slice(0, 2000) ?? null, url: `https://www.reddit.com${p.permalink}`, upvote_count: p.ups ?? 0, comment_count: p.num_comments ?? 0, published_at: new Date(p.created_utc * 1000).toISOString(), top_comments: "[]" });
          res.entry.records++;
        }
      }
    }
    for (const search of (options.quick ? PUBMED_SEARCHES.slice(0, 1) : PUBMED_SEARCHES)) {
      const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(search.query)}&mindate=${search.minDate}&datetype=pdat&sort=pub_date&retmax=20&retmode=json`;
      const found = await request(`PubMed: ${search.query}`, url);
      if (!found) continue;
      const ids = json<{ esearchresult?: { idlist?: string[] } }>(found)?.esearchresult?.idlist;
      if (!ids) { found.entry.state = "failed"; found.entry.detail = "Missing PubMed search results"; continue; }
      if (!ids.length) continue;
      const result = await request(`PubMed article metadata: ${search.query}`, `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`);
      if (!result) continue;
      const articles = json<{ result?: Record<string, { title?: string; source?: string; pubdate?: string; sortfirstauthor?: string }> }>(result)?.result;
      if (!articles) { result.entry.state = "failed"; result.entry.detail = "Missing PubMed article metadata"; continue; }
      for (const id of ids) {
        const a = articles[id]; if (!a?.title) continue;
        insert({ source: "pubmed", source_identifier: search.query, post_id: id, title: a.title, body_text: `${a.sortfirstauthor ?? ""} — ${a.source ?? ""}. Metadata only; abstract/full text not collected.`, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, published_at: pubmedDate(a.pubdate ?? ""), upvote_count: 0, comment_count: 0, top_comments: "[]" });
        result.entry.records++;
      }
    }
    for (const region of REGIONAL_SEARCHES) {
      const query = `${region.query} AND FIRST_PDATE:[2023-01-01 TO ${new Date().toISOString().slice(0,10)}] sort_date:y`;
      const res = await request(`Europe PMC: ${region.name}`, `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&resultType=core&pageSize=${options.quick ? 3 : 15}`);
      if (!res) continue;
      const data = json<{ resultList?: { result?: { id: string; source: string; pmid?: string; title: string; abstractText?: string; firstPublicationDate?: string }[] } }>(res);
      if (!data?.resultList?.result) { res.entry.state = "failed"; res.entry.detail = "Missing Europe PMC result structure"; continue; }
      for (const a of data.resultList.result) {
        if (!a.id || !a.title) continue;
        insert({ source: "europepmc", source_identifier: region.name, post_id: `${a.source}:${a.id}`, title: a.title, body_text: visibleText(a.abstractText ?? "Abstract unavailable; title/metadata only.").slice(0,2000), url: a.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/` : `https://europepmc.org/article/${a.source}/${a.id}`, published_at: a.firstPublicationDate ?? null, upvote_count: 0, comment_count: 0, top_comments: "[]" });
        res.entry.records++;
      }
    }
    for (const comp of COMPETITOR_URLS) {
      if (comp.disabledReason) { health.push({ name: comp.name, url: comp.url, state: "skipped", records: 0, detail: comp.disabledReason }); continue; }
      for (const url of Array.from(new Set([comp.url, comp.productUrl]))) {
        const res = await request(comp.name, url); if (!res) continue;
        const content = visibleText(res.body);
        if (content.length < 150 || /^(access denied|just a moment|please enable javascript)/i.test(content)) { res.entry.state = "failed"; res.entry.detail = "No usable public page text"; continue; }
        const hash = crypto.createHash("sha256").update(content).digest("hex");
        const prev = getLatestSnapshot(comp.name, url);
        const changed = Boolean(prev && prev.content_hash !== hash);
        insertSnapshot(comp.name, url, hash, changed);
        if (changed) changes.push({ name: comp.name, url });
        // Keywords are not verified capabilities; the analyst gets the page excerpt and URL.
        insert({ source: "competitor_product", source_identifier: comp.name, post_id: `page-${crypto.createHash("sha256").update(url).digest("hex").slice(0,16)}`, title: `${comp.name}: public vendor page (self-reported)`, body_text: content.slice(0,2000), url, published_at: null, upvote_count: 0, comment_count: 0, top_comments: "[]" });
        res.entry.records = 1;
      }
      profiles.push({ name: comp.name, features: [] });
    }
    const duration = (Date.now() - start)/1000;
    const runId = runAnalysis(collected.size, newPosts, duration, health);
    const row = getRunById(runId)!;
    try { const saved = saveRunToFiles(Array.from(collected.values()), row); if (saved.errors.length) throw new Error("File archive incomplete"); } catch { finishJob("scraper", "partial", "Source data saved, but file archive failed. Check persistent storage."); throw new Error("Source data saved, but file archive failed."); }
    finishJob("scraper", row.status, `Collected ${collected.size} unique records (${newPosts} new). ${health.filter(h=>h.state !== "ok").length} source checks unavailable; see coverage details.`);
    if (options.analyze !== false && collected.size > 0) {
      try { const { runAiAnalyst } = await import("./aiAnalyst"); await runAiAnalyst(runId); }
      catch (error) { console.error("[AI_ANALYST]", error instanceof Error ? error.message : "Analysis failed"); }
    }
    return { total: collected.size, newPosts, duration, changes, competitorProfiles: profiles, runId, health, status: row.status };
  } catch (error) { finishJob("scraper", "failed", error instanceof Error ? error.message : "Scraper failed"); throw error; }
}

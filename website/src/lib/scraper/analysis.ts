/**
 * Market Intelligence Analysis Engine.
 *
 * Runs after each scrape: counts drug mentions, identifies pain points,
 * classifies competitor sentiment, and extracts geographic signals.
 */

import { getRecentPosts, insertAnalysisRun } from "./db";
import {
  TRACKED_DRUGS, PAIN_POINT_PHRASES,
  POSITIVE_WORDS, NEGATIVE_WORDS,
} from "./sources";

const COMPETITORS = [
  "InsightRX", "DoseMeRx", "DoseMe", "VancoCalc", "Vancomyzer",
  "MwPharm", "DosOpt", "PrecisePK", "ID-ODS", "Pmetrics",
  "NONMEM", "Monolix", "PKanalix", "TDMx", "BestDose",
  "AutoKinetics", "MwPharm++", "TCIWorks", "SmartDose",
];

const COUNTRIES = [
  "United States", "USA", "Canada", "UK", "United Kingdom", "Australia",
  "India", "Germany", "France", "Brazil", "Saudi Arabia", "UAE", "Singapore",
  "South Korea", "Japan", "Mexico", "Nigeria", "South Africa", "Spain", "España", "China", "Kenya", "Argentina", "Chile", "Colombia", "Thailand", "Malaysia", "Indonesia",
];

function countInText(text: string, phrases: string[]): Record<string, number> {
  const lower = text.toLowerCase();
  const counts: Record<string, number> = {};
  for (const phrase of phrases) {
    const regex = new RegExp(`\\b${phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      counts[phrase] = (counts[phrase] ?? 0) + matches.length;
    }
  }
  return counts;
}

function classifySentiment(text: string): "positive" | "neutral" | "negative" {
  const lower = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const w of POSITIVE_WORDS) {
    if (lower.includes(w)) pos++;
  }
  for (const w of NEGATIVE_WORDS) {
    if (lower.includes(w)) neg++;
  }
  if (pos > neg) return "positive";
  if (neg > pos) return "negative";
  return "neutral";
}

export function runAnalysis(totalScraped: number, newPosts: number, durationSeconds: number, health: { name: string; state: string; records: number; detail?: string }[] = []): number {
  const posts = getRecentPosts(30, 2000);

  // Combine all text for analysis
  const allText = posts.map(p => `${p.title} ${p.body_text ?? ""}`).join("\n");

  // Drug mentions
  const drugMentions: Record<string, number> = {};
  for (const drug of TRACKED_DRUGS) {
    const regex = new RegExp(`\\b${drug}\\b`, "gi");
    const matches = allText.match(regex);
    drugMentions[drug] = matches?.length ?? 0;
  }
  // Sort by count
  const sortedDrugs = Object.entries(drugMentions)
    .sort((a, b) => b[1] - a[1])
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, number>);

  // Pain points
  const painPointCounts: Record<string, number> = {};
  for (const post of posts) {
    const text = `${post.title} ${post.body_text ?? ""}`;
    const hits = countInText(text, PAIN_POINT_PHRASES);
    for (const [phrase, count] of Object.entries(hits)) {
      painPointCounts[phrase] = (painPointCounts[phrase] ?? 0) + count;
    }
  }
  const topPainPoints = Object.entries(painPointCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([text, count]) => ({ text, count }));

  // Competitor mentions + sentiment
  const competitorMentions: Record<string, { count: number; positive: number; neutral: number; negative: number; posts: string[] }> = {};
  for (const comp of COMPETITORS) {
    competitorMentions[comp] = { count: 0, positive: 0, neutral: 0, negative: 0, posts: [] };
  }
  for (const post of posts) {
    const text = `${post.title} ${post.body_text ?? ""}`;
    for (const comp of COMPETITORS) {
      if (text.toLowerCase().includes(comp.toLowerCase())) {
        competitorMentions[comp].count++;
        const sentiment = post.source === "reddit" ? classifySentiment(text) : "neutral";
        competitorMentions[comp][sentiment]++;
        if (competitorMentions[comp].posts.length < 5) {
          competitorMentions[comp].posts.push(post.title.substring(0, 100));
        }
      }
    }
  }

  // Top posts by upvotes
  const topPosts = posts
    .sort((a, b) => b.upvote_count - a.upvote_count)
    .slice(0, 10)
    .map(p => ({
      title: p.title,
      source: p.source,
      source_identifier: p.source_identifier,
      upvote_count: p.upvote_count,
      url: p.url,
    }));

  // Geographic signals
  const geoSignals: Record<string, number> = {};
  for (const country of COUNTRIES) {
    const regex = new RegExp(`\\b${country}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches && matches.length > 0) {
      geoSignals[country] = matches.length;
    }
  }

  // Store analysis
  const runId = insertAnalysisRun({
    run_date: new Date().toISOString(),
    total_posts_scraped: totalScraped,
    new_posts_this_run: newPosts,
    top_pain_points: JSON.stringify(topPainPoints),
    drug_mentions: JSON.stringify(sortedDrugs),
    competitor_mentions: JSON.stringify(competitorMentions),
    top_posts: JSON.stringify(topPosts),
    geographic_signals: JSON.stringify(geoSignals),
    run_duration_seconds: durationSeconds,
    status: health.some(h => h.state !== "ok") ? (health.some(h => h.state === "ok") ? "partial" : "failed") : "completed",
    error_message: health.filter(h => h.state !== "ok").map(h => `${h.name}: ${h.detail ?? h.state}`).join("; ") || null,
    source_health: JSON.stringify(health),
  });

  return runId;
}

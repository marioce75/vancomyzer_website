/**
 * AI Market Research Analyst Agent
 *
 * Uses Claude API to analyze scraped market intelligence data and generate
 * strategic business insights, competitive analysis, and innovation opportunities.
 *
 * Runs automatically after each scrape. Also triggerable on demand from the dashboard.
 *
 * Requires ANTHROPIC_API_KEY environment variable.
 */

import { getLatestRun, getRecentPosts, getHighSignalPosts, getCompetitorChanges, insertAiReport } from "./db";
import type { ScraperAnalysisRow } from "./db";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("[AI_ANALYST] ANTHROPIC_API_KEY not set — skipping AI analysis");
    return "";
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }] as ClaudeMessage[],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[AI_ANALYST] Claude API error:", res.status, errText);
      return "";
    }

    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("[AI_ANALYST] Claude API call failed:", err);
    return "";
  }
}

function buildAnalystPrompt(run: ScraperAnalysisRow, posts: { title: string; body_text: string | null; source: string; upvote_count: number }[]): { system: string; user: string } {
  const painPoints = JSON.parse(run.top_pain_points || "[]") as { text: string; count: number }[];
  const drugMentions = JSON.parse(run.drug_mentions || "{}") as Record<string, number>;
  const competitorMentions = JSON.parse(run.competitor_mentions || "{}") as Record<string, { count: number; positive: number; negative: number; posts: string[] }>;
  const geoSignals = JSON.parse(run.geographic_signals || "{}") as Record<string, number>;
  const topPosts = JSON.parse(run.top_posts || "[]") as { title: string; upvote_count: number; source: string }[];

  const system = `You are a senior market research analyst and healthcare business strategist for Dōsys Health LLC, a startup building Vancomyzer™ — a Bayesian vancomycin dosing calculator that competes with InsightRX ($25-50M ARR, 1000+ hospitals) and DoseMeRx.

Your role is to analyze scraped market intelligence data from clinical pharmacist communities (Reddit, PubMed, competitor pages) and produce actionable strategic insights. You think like a combination of a healthcare venture capital analyst and a clinical pharmacist who understands the real pain points at the bedside.

You must:
1. Identify specific, actionable business opportunities — not generic advice
2. Find competitive gaps where Vancomyzer can win against larger players
3. Generate concrete product innovation ideas based on real clinician frustrations
4. Flag emerging threats (new competitors, regulatory changes, market shifts)
5. Recommend strategic moves with timelines

Your output must be valid JSON with this exact structure:
{
  "executive_brief": "3-5 sentence strategic summary of the most important findings",
  "market_opportunities": [
    { "title": "...", "description": "...", "evidence": "...", "priority": "high|medium|low", "estimated_impact": "...", "action_items": ["..."] }
  ],
  "competitive_gaps": [
    { "competitor": "...", "gap": "...", "vancomyzer_advantage": "...", "action": "..." }
  ],
  "innovation_ideas": [
    { "idea": "...", "rationale": "...", "evidence_from_data": "...", "effort": "low|medium|high", "impact": "high|medium|low", "timeline": "..." }
  ],
  "strategic_recommendations": [
    { "recommendation": "...", "rationale": "...", "priority": 1, "timeline": "..." }
  ],
  "risk_signals": [
    { "risk": "...", "severity": "high|medium|low", "evidence": "...", "mitigation": "..." }
  ]
}`;

  const highEngagementPosts = posts
    .filter(p => p.upvote_count > 50)
    .slice(0, 20)
    .map(p => `[${p.upvote_count}↑ ${p.source}] ${p.title}\n${(p.body_text ?? "").substring(0, 300)}`)
    .join("\n---\n");

  const competitorSummary = Object.entries(competitorMentions)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, d]) => `${name}: ${d.count} mentions (${d.positive}+ / ${d.negative}-). Recent: ${d.posts.slice(0, 2).join("; ")}`)
    .join("\n");

  const user = `Analyze this week's market intelligence scrape for Dōsys Health LLC / Vancomyzer™.

## Scrape Summary
- Total posts scanned: ${run.total_posts_scraped}
- New posts this run: ${run.new_posts_this_run}
- Date: ${run.run_date}

## Top Pain Points (from clinician discussions)
${painPoints.map(p => `- "${p.text}" — ${p.count} mentions`).join("\n")}

## Drug Mention Frequency
${Object.entries(drugMentions).filter(([,c]) => c > 0).sort((a,b) => b[1] - a[1]).map(([drug, count]) => `- ${drug}: ${count}`).join("\n")}

## Competitor Intelligence
${competitorSummary || "No competitor mentions detected."}

## Geographic Signals
${Object.entries(geoSignals).sort((a,b) => b[1] - a[1]).map(([geo, count]) => `- ${geo}: ${count} mentions`).join("\n") || "No geographic signals."}

## Top Engaged Posts (clinician discussions with highest engagement)
${highEngagementPosts || "No high-engagement posts this cycle."}

## High Signal Posts (200+ upvotes)
${topPosts.filter(p => p.upvote_count >= 200).map(p => `- [${p.upvote_count}↑] ${p.title}`).join("\n") || "None this cycle."}

## Context about Vancomyzer™
- Free Bayesian vancomycin AUC calculator, web-based, no app install needed
- Colin 2019 two-compartment PK model + obesity model (FFM-based, BMI≥40)
- AUC-guided dosing per ASHP/IDSA 2020 guidelines
- Currently pre-revenue, building toward FDA 510(k) submission
- Target: community hospitals without existing TDM software
- Key differentiator: transparency (all equations visible), speed (bedside use), cost (free vs $25-50K/year)
- SMART on FHIR scaffold built for EHR integration

Produce your analysis as the JSON structure specified in your system prompt. Focus on insights that are specific and actionable, not generic market observations.`;

  return { system, user };
}

/**
 * Run the AI Market Research Analyst on the latest scrape data.
 * Returns the report ID or null if analysis couldn't run.
 */
export async function runAiAnalyst(runId?: number): Promise<number | null> {
  const run = getLatestRun();
  if (!run) {
    console.log("[AI_ANALYST] No scrape data to analyze");
    return null;
  }

  const posts = getRecentPosts(30, 500);
  const { system, user } = buildAnalystPrompt(run, posts);

  console.log("[AI_ANALYST] Running AI analysis on scrape data...");
  const response = await callClaude(system, user);

  if (!response) {
    console.log("[AI_ANALYST] No response from Claude — skipping report");
    return null;
  }

  // Parse the JSON response
  let parsed: {
    executive_brief?: string;
    market_opportunities?: unknown[];
    competitive_gaps?: unknown[];
    innovation_ideas?: unknown[];
    strategic_recommendations?: unknown[];
    risk_signals?: unknown[];
  } = {};

  try {
    // Extract JSON from response (Claude may wrap it in markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error("[AI_ANALYST] Failed to parse Claude response:", err);
    // Store raw response even if parsing fails
  }

  const reportId = insertAiReport({
    run_id: runId ?? run.run_id,
    market_opportunities: JSON.stringify(parsed.market_opportunities ?? []),
    competitive_gaps: JSON.stringify(parsed.competitive_gaps ?? []),
    innovation_ideas: JSON.stringify(parsed.innovation_ideas ?? []),
    strategic_recommendations: JSON.stringify(parsed.strategic_recommendations ?? []),
    risk_signals: JSON.stringify(parsed.risk_signals ?? []),
    executive_brief: parsed.executive_brief ?? "",
    raw_prompt: user.substring(0, 5000),
    raw_response: response.substring(0, 10000),
  });

  console.log(`[AI_ANALYST] Report #${reportId} generated`);
  return reportId;
}

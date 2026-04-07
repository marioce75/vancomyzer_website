/**
 * Weekly email digest for market intelligence results.
 */

import nodemailer from "nodemailer";
import type { ScraperAnalysisRow } from "./db";

export async function sendWeeklyDigest(run: ScraperAnalysisRow): Promise<void> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("[DIGEST] SMTP not configured — skipping email digest");
    return;
  }

  const painPoints = JSON.parse(run.top_pain_points || "[]") as { text: string; count: number }[];
  const drugMentions = JSON.parse(run.drug_mentions || "{}") as Record<string, number>;
  const topPosts = JSON.parse(run.top_posts || "[]") as { title: string; url: string; upvote_count: number }[];
  const competitorMentions = JSON.parse(run.competitor_mentions || "{}") as Record<string, { count: number; positive: number; neutral: number; negative: number; posts: string[] }>;

  const topDrugs = Object.entries(drugMentions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Filter competitors with mentions > 0
  const activeCompetitors = Object.entries(competitorMentions)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  const dateStr = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const painPointsHtml = painPoints.slice(0, 5)
    .map(p => `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${p.text}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${p.count}</td></tr>`)
    .join("");

  const drugsHtml = topDrugs
    .map(([name, count]) => `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0">${name}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600">${count}</td></tr>`)
    .join("");

  const topPostsHtml = topPosts.slice(0, 3)
    .map(p => `<li><a href="${p.url}" style="color:#1e4d8c">${p.title.substring(0, 80)}</a> (${p.upvote_count} upvotes)</li>`)
    .join("");

  const executive = `Top pain point: "${painPoints[0]?.text ?? "N/A"}" (${painPoints[0]?.count ?? 0} mentions). Top drug opportunity: ${topDrugs[0]?.[0] ?? "N/A"} (${topDrugs[0]?.[1] ?? 0} mentions).`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e4d8c;color:#fff;padding:16px 24px">
        <h1 style="margin:0;font-size:18px">Dōsys Market Intelligence Digest</h1>
        <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">${dateStr}</p>
      </div>

      <div style="padding:20px 24px;background:#fff">
        <p style="font-size:14px;color:#2d3748;margin:0 0 16px">
          <strong>${run.new_posts_this_run}</strong> new posts discovered this week across ${run.total_posts_scraped} total scanned.
        </p>

        <h2 style="font-size:14px;color:#1e4d8c;margin:16px 0 8px">Top Pain Points</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f7fafc"><th style="padding:4px 8px;text-align:left">Pain Point</th><th style="padding:4px 8px;text-align:right">Mentions</th></tr>
          ${painPointsHtml}
        </table>

        <h2 style="font-size:14px;color:#1e4d8c;margin:16px 0 8px">Drug Opportunities</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f7fafc"><th style="padding:4px 8px;text-align:left">Drug</th><th style="padding:4px 8px;text-align:right">Mentions</th></tr>
          ${drugsHtml}
        </table>

        ${activeCompetitors.length > 0 ? `
        <h2 style="font-size:14px;color:#1e4d8c;margin:16px 0 8px">Competitor Intelligence</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f7fafc">
            <th style="padding:4px 8px;text-align:left">Competitor</th>
            <th style="padding:4px 8px;text-align:right">Mentions</th>
            <th style="padding:4px 8px;text-align:center">Sentiment</th>
          </tr>
          ${activeCompetitors.slice(0, 8).map(([name, d]) => {
            const sentimentLabel = d.positive > d.negative ? "🟢 Positive" : d.negative > d.positive ? "🔴 Negative" : "⚪ Neutral";
            return `<tr>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;font-weight:600">${name}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:right">${d.count}</td>
              <td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-size:11px">${sentimentLabel} (+${d.positive} / -${d.negative})</td>
            </tr>${d.posts.length > 0 ? `<tr><td colspan="3" style="padding:2px 8px 8px;font-size:11px;color:#718096;border-bottom:1px solid #e2e8f0">Recent: ${d.posts.slice(0, 2).join(" · ")}</td></tr>` : ""}`;
          }).join("")}
        </table>
        ` : ""}

        ${topPostsHtml ? `
        <h2 style="font-size:14px;color:#1e4d8c;margin:16px 0 8px">High Signal Posts</h2>
        <ul style="font-size:13px;color:#2d3748;padding-left:20px">${topPostsHtml}</ul>
        ` : ""}

        <div style="margin-top:20px;padding:12px;background:#f0fdf4;border:1px solid #6ee7b7;font-size:12px;color:#065f46">
          <strong>Executive Summary:</strong> ${executive}
        </div>
      </div>

      <div style="padding:12px 24px;background:#f7fafc;font-size:10px;color:#94a3b8;text-align:center">
        Dōsys Health LLC · Automated Market Intelligence
      </div>
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: `"Dōsys Market Intelligence" <${process.env.SMTP_USER}>`,
      to: "mario@dosys.health",
      subject: `Dōsys Market Intelligence Digest — ${dateStr}`,
      text: `${run.new_posts_this_run} new posts. ${executive}`,
      html,
    });
    console.log("[DIGEST] Weekly digest sent to mario@dosys.health");
  } catch (err) {
    console.error("[DIGEST] Failed to send digest:", err);
  }
}

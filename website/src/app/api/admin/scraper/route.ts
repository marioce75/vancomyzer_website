import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRecentRuns, getLatestRun, getRecentPosts, getHighSignalPosts, getCompetitorChanges, getAllPosts } from "@/lib/scraper/db";
import { logSecurityEvent } from "@/lib/db";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  if (user.role !== "admin") return null;
  return user;
}

// GET: dashboard data
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Export endpoints
  if (action === "export_posts_csv") {
    const posts = getRecentPosts(30, 5000);
    const header = "source,source_identifier,post_id,title,url,upvote_count,comment_count,published_at";
    const rows = posts.map(p =>
      [p.source, p.source_identifier, p.post_id, `"${(p.title ?? "").replace(/"/g, '""')}"`, p.url, p.upvote_count, p.comment_count, p.published_at].join(",")
    );
    return new Response([header, ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="scraper-posts-${new Date().toISOString().split("T")[0]}.csv"` },
    });
  }

  if (action === "export_summary_json") {
    const latest = getLatestRun();
    return NextResponse.json(latest ?? { message: "No runs yet." });
  }

  if (action === "export_all_posts") {
    const all = getAllPosts();
    const header = "id,source,source_identifier,post_id,title,body_text,url,upvote_count,comment_count,published_at,scraped_at";
    const rows = all.map(p =>
      [p.id, p.source, p.source_identifier, p.post_id, `"${(p.title ?? "").replace(/"/g, '""')}"`, `"${(p.body_text ?? "").replace(/"/g, '""').substring(0, 200)}"`, p.url, p.upvote_count, p.comment_count, p.published_at, p.scraped_at].join(",")
    );
    return new Response([header, ...rows].join("\n"), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="all-posts-${new Date().toISOString().split("T")[0]}.csv"` },
    });
  }

  // Default: dashboard data
  const runs = getRecentRuns(10);
  const latest = getLatestRun();
  const highSignal = getHighSignalPosts(200, 30);
  const competitorChanges = getCompetitorChanges(30);

  return NextResponse.json({ runs, latest, highSignal, competitorChanges });
}

// POST: trigger scrape run
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  logSecurityEvent({
    user_id: Number(admin.id),
    username: String(admin.username),
    action: "SCRAPER_TRIGGERED",
    severity: "info",
  });

  // Run scraper in background (don't block the response)
  try {
    const { runFullScrape } = await import("@/lib/scraper/engine");
    const result = await runFullScrape();

    // Send digest if configured
    try {
      const { getLatestRun: getLR } = await import("@/lib/scraper/db");
      const { sendWeeklyDigest } = await import("@/lib/scraper/digest");
      const latestRun = getLR();
      if (latestRun) await sendWeeklyDigest(latestRun);
    } catch (err) {
      console.error("[SCRAPER] Digest failed:", err);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[SCRAPER] Run failed:", err);

    // Log failure
    const { insertAnalysisRun } = await import("@/lib/scraper/db");
    insertAnalysisRun({
      run_date: new Date().toISOString(),
      total_posts_scraped: 0,
      new_posts_this_run: 0,
      top_pain_points: "[]",
      drug_mentions: "{}",
      competitor_mentions: "{}",
      top_posts: "[]",
      geographic_signals: "{}",
      run_duration_seconds: 0,
      status: "failed",
      error_message: (err as Error).message,
    });

    return NextResponse.json({ error: "Scrape failed.", details: (err as Error).message }, { status: 500 });
  }
}

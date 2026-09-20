import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRecentRuns, getLatestRun, getRecentPosts, getHighSignalPosts, getCompetitorChanges, getAllPosts, getLatestAiReport, getAiReports, getJob } from "@/lib/scraper/db";
import { logSecurityEvent } from "@/lib/db";
import { csvRow } from "@/lib/scraper/csv";
import { ANALYST_MODEL } from "@/lib/scraper/analystCore";
import { archiveReport } from "@/lib/scraper/filePersistence";

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

  // Status check for polling
  if (action === "status") {
    const scraper = getJob("scraper");
    return NextResponse.json({ running: scraper?.state === "running", startedAt: scraper?.started_at, scraper, analyst: getJob("analyst") });
  }

  // AI Analyst report
  if (action === "ai_report") {
    const report = getLatestAiReport();
    return NextResponse.json(report ?? { message: "No AI analysis yet. Run the scraper first." });
  }

  if (action === "ai_reports") {
    const reports = getAiReports(10);
    return NextResponse.json({ reports });
  }

  if (action === "run_analyst") return NextResponse.json({ error: "Use POST to start an analysis." }, { status: 405 });

  // Export endpoints
  if (action === "export_posts_csv") {
    const posts = getRecentPosts(30, 5000);
    const header = "source,source_identifier,post_id,title,url,upvote_count,comment_count,published_at";
    const rows = posts.map(p => csvRow([p.source, p.source_identifier, p.post_id, p.title, p.url, p.upvote_count, p.comment_count, p.published_at]));
    const csv = [header, ...rows].join("\n");
    try { archiveReport(csv, "scraper-posts", "csv"); } catch { /* non-critical */ }
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="scraper-posts-${new Date().toISOString().split("T")[0]}.csv"` },
    });
  }

  if (action === "export_summary_json") {
    const latest = getLatestRun();
    if (latest) {
      try { archiveReport(JSON.stringify(latest, null, 2), "summary", "json"); } catch { /* non-critical */ }
    }
    return NextResponse.json(latest ?? { message: "No runs yet." });
  }

  if (action === "export_all_posts") {
    const all = getAllPosts();
    const header = "id,source,source_identifier,post_id,title,body_text,url,upvote_count,comment_count,published_at,scraped_at";
    const rows = all.map(p => csvRow([p.id, p.source, p.source_identifier, p.post_id, p.title, p.body_text, p.url, p.upvote_count, p.comment_count, p.published_at, p.scraped_at]));
    const csv = [header, ...rows].join("\n");
    try { archiveReport(csv, "all-posts", "csv"); } catch { /* non-critical */ }
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="all-posts-${new Date().toISOString().split("T")[0]}.csv"` },
    });
  }

  // Default: dashboard data
  const runs = getRecentRuns(10);
  const latest = getLatestRun();
  const highSignal = getHighSignalPosts(200, 30);
  const competitorChanges = getCompetitorChanges(30);
  const aiReport = getLatestAiReport();

  const scraper = getJob("scraper");
  return NextResponse.json({ runs, latest, highSignal, competitorChanges, aiReport, scraperRunning: scraper?.state === "running", scraperStartedAt: scraper?.started_at, scraper, analyst: getJob("analyst"), analystConfigured: Boolean(process.env.ANTHROPIC_API_KEY), analystModel: ANALYST_MODEL });
}

// Explicit POST jobs. State is persisted so refreshes and interrupted runs remain visible.
// Background execution requires a persistent Node server (the existing Render service).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.NEXTAUTH_URL?.replace(/\/$/, "")) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const action = new URL(request.url).searchParams.get("action");
  if (action && action !== "run_analyst") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const kind = action === "run_analyst" ? "analyst" : "scraper";
  if (getJob(kind)?.state === "running") return NextResponse.json({ error: "Already running. Please wait for the current job." }, { status: 409 });
  if (kind === "analyst" && !process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI analysis is not configured. Add ANTHROPIC_API_KEY to the hosting service environment." }, { status: 503 });
  logSecurityEvent({ user_id: Number(admin.id), username: String(admin.username), action: kind === "analyst" ? "AI_ANALYST_TRIGGERED" : "SCRAPER_TRIGGERED", severity: "info" });
  // Both entry points acquire an atomic database lease before their first network call.
  if (kind === "analyst") {
    const { runAiAnalyst } = await import("@/lib/scraper/aiAnalyst");
    void runAiAnalyst().catch(error => console.error("[AI_ANALYST]", error instanceof Error ? error.message : "Failed"));
  } else {
    const { runFullScrape } = await import("@/lib/scraper/engine");
    void runFullScrape().catch(error => console.error("[SCRAPER]", error instanceof Error ? error.message : "Failed"));
  }
  // Manual testing/collection does not automatically send an email digest.
  return NextResponse.json({ ok: true, message: `${kind === "analyst" ? "Analysis" : "Scrape"} started. Progress and errors will appear here.` }, { status: 202 });
}

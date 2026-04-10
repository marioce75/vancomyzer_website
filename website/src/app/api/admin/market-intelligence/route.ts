import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  getIndex,
  getLatestAnalysisFile,
  getRunsByDate,
  getWeeklyDigestFile,
  getAnalysisRange,
  getFileContents,
  MI_DIR,
  ensureDirectories,
  importHistoricalData,
} from "@/lib/scraper/filePersistence";
import path from "path";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  if (user.role !== "admin") return null;
  return user;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // GET /api/admin/market-intelligence?action=index
  if (action === "index") {
    try {
      const index = getIndex();
      return NextResponse.json({ ...index, mi_dir: MI_DIR });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // GET /api/admin/market-intelligence?action=latest
  if (action === "latest") {
    const data = getLatestAnalysisFile();
    if (!data) return NextResponse.json({ error: "No analysis files yet. Run the scraper first." }, { status: 404 });
    return NextResponse.json(data);
  }

  // GET /api/admin/market-intelligence?action=run&date=YYYY-MM-DD
  if (action === "run") {
    const date = searchParams.get("date");
    if (!date) return NextResponse.json({ error: "date parameter required (YYYY-MM-DD)" }, { status: 400 });
    const results = getRunsByDate(date);
    if (results.length === 0) return NextResponse.json({ error: `No runs found for ${date}` }, { status: 404 });
    return NextResponse.json(results.length === 1 ? results[0] : results);
  }

  // GET /api/admin/market-intelligence?action=week&week=YYYY-WNN
  if (action === "week") {
    const week = searchParams.get("week");
    if (!week) return NextResponse.json({ error: "week parameter required (YYYY-WNN)" }, { status: 400 });
    const digest = getWeeklyDigestFile(week);
    if (!digest) return NextResponse.json({ error: `No digest found for week ${week}` }, { status: 404 });
    return NextResponse.json(digest);
  }

  // GET /api/admin/market-intelligence?action=range&start=YYYY-MM-DD&end=YYYY-MM-DD
  if (action === "range") {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start || !end) return NextResponse.json({ error: "start and end parameters required (YYYY-MM-DD)" }, { status: 400 });
    const result = getAnalysisRange(start, end);
    return NextResponse.json(result);
  }

  // GET /api/admin/market-intelligence?action=download&file=raw/2026-04-09_06-00_raw_posts.json
  if (action === "download") {
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "file parameter required" }, { status: 400 });
    const contents = getFileContents(file);
    if (!contents) return NextResponse.json({ error: `File not found: ${file}` }, { status: 404 });

    const filename = path.basename(file);
    const isJson = filename.endsWith(".json");
    return new Response(new Uint8Array(contents), {
      headers: {
        "Content-Type": isJson ? "application/json" : "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // GET /api/admin/market-intelligence?action=posts_csv&file=raw/...
  if (action === "posts_csv") {
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "file parameter required" }, { status: 400 });
    const contents = getFileContents(file);
    if (!contents) return NextResponse.json({ error: `File not found: ${file}` }, { status: 404 });

    const posts = JSON.parse(contents.toString()) as { source: string; source_identifier: string; post_id: string; title: string; url: string | null; upvote_count: number; comment_count: number; published_at: string | null }[];
    const header = "source,source_identifier,post_id,title,url,upvote_count,comment_count,published_at";
    const rows = posts.map(p =>
      [p.source, p.source_identifier, p.post_id, `"${(p.title ?? "").replace(/"/g, '""')}"`, p.url ?? "", p.upvote_count, p.comment_count, p.published_at ?? ""].join(","),
    );
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="posts-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // GET /api/admin/market-intelligence?action=painpoints_csv&file=analysis/...
  if (action === "painpoints_csv") {
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "file parameter required" }, { status: 400 });
    const contents = getFileContents(file);
    if (!contents) return NextResponse.json({ error: `File not found: ${file}` }, { status: 404 });

    const analysis = JSON.parse(contents.toString()) as { top_pain_points?: { text: string; count: number }[] };
    const pp = analysis.top_pain_points ?? [];
    const header = "pain_point,frequency";
    const rows = pp.map(p => `"${p.text.replace(/"/g, '""')}",${p.count}`);
    const csv = [header, ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="pain-points-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  // GET /api/admin/market-intelligence?action=import_historical
  if (action === "import_historical") {
    const result = importHistoricalData();
    return NextResponse.json(result);
  }

  // Default: ensure directories exist and return index
  try {
    ensureDirectories();
    const index = getIndex();
    return NextResponse.json({ ...index, mi_dir: MI_DIR });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

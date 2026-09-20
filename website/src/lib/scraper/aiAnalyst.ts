import { getLatestRun, getRunById, getEvidencePosts, insertAiReport, acquireJob, finishJob } from "./db";
import { AnalystError, ANALYST_MODEL, buildAnalystPrompt, selectEvidence, callAnalyst, parseReport } from "./analystCore";

export async function runAiAnalyst(runId?: number): Promise<number> {
  if (!acquireJob("analyst", 420)) throw new AnalystError("already_running", "AI analysis is already running. Wait for the current report.", 409);
  try {
    const run = runId === undefined ? getLatestRun() : getRunById(runId);
    if (!run) throw new AnalystError("no_data", "No scrape data is available. Run the scraper first.", 422);
    const evidence = selectEvidence(getEvidencePosts().filter(p => p.url).map(p => ({ ...p, url: p.url! })));
    if (!evidence.length) throw new AnalystError("no_evidence", "No recent source records are available. Run the scraper before requesting analysis.", 422);
    const { system, user } = buildAnalystPrompt(evidence, { run_id: run.run_id, collected_at: run.run_date, status: run.status, source_health: run.source_health, errors: run.error_message, scope: "Linked records collected in the past 30 days; publication dates may be older. Keyword dashboard is a rolling window, not population-level market evidence." });
    let response = await callAnalyst(system, user);
    let parsed;
    try { parsed = parseReport(response, evidence); }
    catch (error) {
      if (!(error instanceof AnalystError) || !["unverified_sources", "invalid_response"].includes(error.code)) throw error;
      response = await callAnalyst(system, user + "\nValidation feedback: " + error.code + ". Return one corrected complete JSON report. Use only the exact evidence URLs above. Remove any item not supported by those sources; never substitute an unrelated citation. Previous untrusted response:\n" + response.slice(0,20000));
      parsed = parseReport(response, evidence);
    }
    const id = insertAiReport({
      run_id: run.run_id, executive_brief: parsed.executive_brief,
      market_opportunities: JSON.stringify(parsed.market_opportunities), competitive_gaps: JSON.stringify(parsed.competitive_gaps), innovation_ideas: JSON.stringify(parsed.innovation_ideas), strategic_recommendations: JSON.stringify(parsed.strategic_recommendations), risk_signals: JSON.stringify(parsed.risk_signals),
      raw_prompt: user, raw_response: response,
      evidence_json: JSON.stringify(evidence.map(({ body_text, ...p }) => p)), model: ANALYST_MODEL,
    });
    finishJob("analyst", "completed", `Report #${id} generated from ${evidence.length} linked sources.`);
    return id;
  } catch (error) {
    finishJob("analyst", "failed", error instanceof AnalystError ? error.message : "AI report could not be saved. Check the server logs and retry.");
    throw error;
  }
}

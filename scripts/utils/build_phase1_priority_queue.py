from pathlib import Path
from datetime import datetime
import json

STATE = Path("logs/state/task_status.json")
OUT = Path("reports/execution/VANCOMYZER_PHASE1_PRIORITY_QUEUE.md")

if not STATE.exists():
    raise SystemExit(f"Missing {STATE}")

state = json.loads(STATE.read_text(encoding="utf-8"))

priority_now = [
    "063_validation_claims_guardrails.md",
    "082_mvp_website_spec_refinement.md",
    "083_mvp_page_asset_map.md",
    "084_homepage_implementation_refinement.md",
    "085_homepage_asset_selection.md",
    "086_trust_evidence_implementation_refinement.md",
    "087_trust_evidence_asset_selection.md",
    "088_faq_implementation_refinement.md",
    "089_faq_asset_selection.md",
    "090_about_implementation_refinement.md",
    "091_about_asset_selection.md",
    "092_contact_institutional_implementation_refinement.md",
    "093_contact_institutional_asset_selection.md",
    "094_phase1_sitemap_refinement.md",
    "095_phase1_crosslinking_plan.md",
    "096_phase1_asset_manifest_refinement.md",
    "097_phase1_asset_selection_bundle.md",
    "098_phase1_build_sequence_refinement.md",
    "099_phase1_ready_to_build_check.md",
    "100_phase1_handoff_packet_refinement.md",
    "101_phase1_builder_brief.md",
    "102_builder_prompt_refinement.md",
    "103_cursor_prompt_variant.md",
    "104_task_runner_refinement.md",
    "105_phase1_execution_queue.md",
]

defer_until_phase1_stable = [
    "002_research_monitoring_setup.md",
    "003_marketing_engine_setup.md",
    "004_product_growth_alignment.md",
    "006_first_weekly_intel_report.md",
    "009_marketing_signal_translation.md",
    "011_marketing_topics_from_first_pass.md",
    "015_competitor_baseline_execution.md",
    "020_competitor_synthesis.md",
    "027_content_roadmap.md",
    "033_execute_content_roadmap.md",
    "040_website_demo_pack_refinement.md",
    "044_feature_page_refinement.md",
    "046_seo_page_refinement.md",
    "048_seo_landing_section_refinement.md",
    "050_case_page_refinement.md",
    "052_comparison_page_refinement.md",
    "054_faq_refinement.md",
    "056_onboarding_flow_refinement.md",
    "058_pricing_page_refinement.md",
    "060_institutional_page_refinement.md",
    "062_trust_evidence_page_refinement.md",
    "066_resource_hub_refinement.md",
    "068_lead_magnet_refinement.md",
    "070_newsletter_refinement.md",
    "072_social_content_refinement.md",
    "074_webinar_event_refinement.md",
    "076_partnership_outreach_refinement.md",
    "078_demo_deck_refinement.md",
]

lines = []
lines.append("# Vancomyzer Phase 1 Priority Queue")
lines.append("")
lines.append(f"Generated: {datetime.utcnow().isoformat()}Z")
lines.append("")
lines.append("## Execute now")
lines.append("")

for i, task_name in enumerate(priority_now, start=1):
    item = state.get(task_name, {})
    title = item.get("title", "(missing title)")
    roles = ", ".join(item.get("assigned_roles", [])) or "(none)"
    lines.append(f"{i}. {task_name}")
    lines.append(f"   - Title: {title}")
    lines.append(f"   - Roles: {roles}")
    lines.append("")

lines.append("## Defer until Phase 1 core implementation inputs are stable")
lines.append("")

for task_name in defer_until_phase1_stable:
    item = state.get(task_name, {})
    title = item.get("title", "(missing title)")
    roles = ", ".join(item.get("assigned_roles", [])) or "(none)"
    lines.append(f"- {task_name}")
    lines.append(f"  - Title: {title}")
    lines.append(f"  - Roles: {roles}")
    lines.append("")

lines.append("## Queue logic")
lines.append("")
lines.append("- First finalize guardrails, MVP scope, page specs, sitemap, asset manifest, and build sequence.")
lines.append("- Then finalize the exact Phase 1 asset bundle.")
lines.append("- Then finalize handoff and builder prompts.")
lines.append("- Defer broader growth and expansion work until Phase 1 pages are implementation-ready.")
lines.append("")

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("\n".join(lines), encoding="utf-8")
print(f"Wrote {OUT}")

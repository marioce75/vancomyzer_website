/**
 * BAA template module — generates the Dōsys Health LLC starter BAA as
 * a PDF, pre-filled with the customer institution's name.
 *
 * ━━━ ATTORNEY REVIEW GATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Until BAA_TEMPLATE_APPROVED=true is set in the runtime environment,
 * `isBaaTemplateApproved()` returns false and the download endpoint
 * MUST refuse to serve the PDF to customers. This gate exists because
 * the template text below was synthesized by an AI from HHS sample
 * provisions and authoritative secondary sources — it is a draft
 * intended to make a healthcare attorney's review efficient, NOT a
 * launch-ready contract. Customers must never sign an unapproved draft.
 *
 * Every page of the generated PDF carries a "DRAFT — REQUIRES ATTORNEY
 * REVIEW" header until approved. This is belt-and-suspenders on top of
 * the environment gate so that even if a draft PDF leaks (e.g. via an
 * accidental download by Mario for review), no signer could mistake it
 * for an executed template.
 *
 * ━━━ REGULATORY SOURCES (cited per-clause below) ━━━━━━━━━━━━━━━━━━
 *   - 45 CFR § 164.504(e) — required BAA provisions
 *     https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E/section-164.504
 *   - 45 CFR § 164.502(e) — BA contract requirement + subcontractor flow-down
 *   - 45 CFR § 164.410 — BA breach notification deadline (60 calendar days max)
 *   - 45 CFR § 164.308–164.312 — Security Rule administrative/physical/technical safeguards
 *   - HITECH § 13404 (42 USC § 17934) — direct BA liability
 *   - HHS OCR sample BAA provisions:
 *     https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions/index.html
 *   - 2013 Omnibus Final Rule (78 Fed. Reg. 5566)
 *
 * ━━━ OPEN DEPENDENCIES (attorney must resolve before approval) ━━━━
 *   1. Confirm Dōsys Health LLC's state of organization (drives
 *      choice-of-law default; template currently assumes Delaware).
 *   2. Confirm signed BAA between Dōsys and Render (the hosting BA-
 *      subcontractor) is on file before any customer-facing GA.
 *   3. Confirm cyber liability + tech E&O insurance is bound at the
 *      levels stated in Section 7 ($1M per claim / $3M aggregate).
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** The version string stamped into every generated PDF and stored with each customer's signed copy. */
export const BAA_TEMPLATE_VERSION = "v0.1-draft-2026-05-18";

/** True only when the attorney has reviewed the template and Mario has flipped the env var. */
export function isBaaTemplateApproved(): boolean {
  return process.env.BAA_TEMPLATE_APPROVED === "true";
}

export interface BaaTemplateContext {
  institutionName: string;
  /** ISO date the PDF was generated. Stamped on the cover. */
  generatedAt: Date;
}

const MARGIN = 50;
const LINE_HEIGHT = 13;
const HEADING_SIZE = 13;
const BODY_SIZE = 10;
const CITE_SIZE = 8;
const PAGE_HEIGHT = 792; // US Letter
const PAGE_WIDTH = 612;

interface PageState {
  doc: PDFDocument;
  page: PDFPage;
  cursorY: number;
  body: PDFFont;
  bodyBold: PDFFont;
  italic: PDFFont;
}

function newPage(state: PageState, approved: boolean): void {
  state.page = state.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  state.cursorY = PAGE_HEIGHT - MARGIN;
  if (!approved) {
    drawDraftHeader(state);
  }
}

function drawDraftHeader(state: PageState): void {
  const text = "DRAFT — REQUIRES ATTORNEY REVIEW BEFORE CUSTOMER DISTRIBUTION";
  state.page.drawText(text, {
    x: MARGIN,
    y: PAGE_HEIGHT - 25,
    size: 9,
    font: state.bodyBold,
    color: rgb(0.7, 0.1, 0.1),
  });
  state.page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 32 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 32 },
    color: rgb(0.7, 0.1, 0.1),
    thickness: 0.75,
  });
}

function ensureRoom(state: PageState, lines: number, approved: boolean): void {
  const needed = lines * LINE_HEIGHT + 20;
  if (state.cursorY - needed < MARGIN) {
    newPage(state, approved);
  }
}

function drawHeading(state: PageState, text: string, approved: boolean): void {
  ensureRoom(state, 3, approved);
  state.cursorY -= LINE_HEIGHT * 1.5;
  state.page.drawText(text, {
    x: MARGIN,
    y: state.cursorY,
    size: HEADING_SIZE,
    font: state.bodyBold,
    color: rgb(0, 0, 0),
  });
  state.cursorY -= LINE_HEIGHT * 0.8;
}

/**
 * pdf-lib's standard fonts use WinAnsi encoding, which can't represent
 * characters outside Latin-1 (e.g., the macron in "Dōsys", or many
 * international institution names like "Hôpital Saint-Louis"). We strip
 * combining diacritics via NFKD normalization to get a printable
 * ASCII-friendly approximation that the legal text is still readable
 * against. Embedding a full Unicode TrueType font is the right long-term
 * fix; this is the safe interim. Other non-Latin characters (CJK, etc.)
 * are replaced with '?' rather than throwing.
 */
function toWinAnsi(text: string): string {
  const normalized = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  // Replace any remaining non-Latin1 char with '?' so pdf-lib doesn't throw.
  let out = "";
  for (const ch of normalized) {
    out += ch.charCodeAt(0) <= 0xff ? ch : "?";
  }
  return out;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  text = toWinAnsi(text);
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? current + " " + w : w;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      if (current) lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawBody(state: PageState, text: string, approved: boolean): void {
  const lines = wrapText(text, state.body, BODY_SIZE, PAGE_WIDTH - 2 * MARGIN);
  ensureRoom(state, lines.length, approved);
  for (const line of lines) {
    state.page.drawText(line, {
      x: MARGIN,
      y: state.cursorY,
      size: BODY_SIZE,
      font: state.body,
      color: rgb(0, 0, 0),
    });
    state.cursorY -= LINE_HEIGHT;
  }
  state.cursorY -= 4;
}

function drawCitation(state: PageState, text: string, approved: boolean): void {
  const lines = wrapText("[Citation: " + text + "]", state.italic, CITE_SIZE, PAGE_WIDTH - 2 * MARGIN);
  ensureRoom(state, lines.length, approved);
  for (const line of lines) {
    state.page.drawText(line, {
      x: MARGIN + 12,
      y: state.cursorY,
      size: CITE_SIZE,
      font: state.italic,
      color: rgb(0.35, 0.35, 0.45),
    });
    state.cursorY -= LINE_HEIGHT * 0.9;
  }
  state.cursorY -= 4;
}

function drawDraftNote(state: PageState, text: string, approved: boolean): void {
  if (approved) return;
  const lines = wrapText("[DRAFT NOTE — attorney to verify: " + text + "]", state.italic, CITE_SIZE, PAGE_WIDTH - 2 * MARGIN);
  ensureRoom(state, lines.length, approved);
  for (const line of lines) {
    state.page.drawText(line, {
      x: MARGIN + 12,
      y: state.cursorY,
      size: CITE_SIZE,
      font: state.italic,
      color: rgb(0.65, 0.3, 0),
    });
    state.cursorY -= LINE_HEIGHT * 0.9;
  }
  state.cursorY -= 4;
}

/**
 * Generate the BAA PDF for a given institution context.
 *
 * The PDF body is intentionally close to HHS sample provisions language
 * (with cited modifications) so the attorney can verify each clause
 * against the source. Every required clause carries an inline citation
 * to its CFR section.
 */
export async function generateBaaPdf(ctx: BaaTemplateContext): Promise<Uint8Array> {
  const approved = isBaaTemplateApproved();
  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const bodyBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  const state: PageState = {
    doc,
    page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    cursorY: PAGE_HEIGHT - MARGIN,
    body,
    bodyBold,
    italic,
  };
  if (!approved) drawDraftHeader(state);

  // ─── Cover ────────────────────────────────────────────────────────
  state.page.drawText("BUSINESS ASSOCIATE AGREEMENT", {
    x: MARGIN,
    y: PAGE_HEIGHT - 100,
    size: 18,
    font: bodyBold,
    color: rgb(0, 0, 0),
  });
  state.cursorY = PAGE_HEIGHT - 140;
  drawBody(
    state,
    `This Business Associate Agreement ("BAA") is entered into between ${ctx.institutionName} ("Covered Entity" or "CE") and Dōsys Health LLC ("Business Associate" or "BA"), and is effective as of the date last signed below ("Effective Date").`,
    approved,
  );
  drawBody(
    state,
    "This BAA supplements and is incorporated by reference into the Services Agreement governing CE's use of the Vancomyzer™ vancomycin dosing decision-support platform. To the extent of any conflict between this BAA and the Services Agreement with respect to the handling of Protected Health Information, this BAA controls.",
    approved,
  );
  drawDraftNote(
    state,
    "Confirm the underlying Services Agreement name/date once the MSA template is final.",
    approved,
  );

  // ─── 1. Definitions ───────────────────────────────────────────────
  drawHeading(state, "1. Definitions", approved);
  drawBody(
    state,
    'Capitalized terms used but not otherwise defined in this BAA have the meanings given in the HIPAA Rules. Without limiting the foregoing: "Breach," "Business Associate," "Covered Entity," "Designated Record Set," "Electronic Protected Health Information" ("ePHI"), "Health Care Operations," "Individual," "Privacy Rule," "Protected Health Information" ("PHI"), "Required by Law," "Secretary," "Security Incident," "Security Rule," "Subcontractor," "Unsecured Protected Health Information," and "Use" have the meanings set forth in 45 CFR §§ 160.103 and 164.501.',
    approved,
  );
  drawCitation(state, "45 CFR §§ 160.103, 164.501.", approved);
  drawBody(
    state,
    '"HIPAA Rules" means the Privacy, Security, Breach Notification, and Enforcement Rules at 45 CFR Parts 160 and 164, as amended by the Health Information Technology for Economic and Clinical Health Act ("HITECH"), Pub. L. 111-5.',
    approved,
  );
  drawBody(
    state,
    '"Services" means the Vancomyzer™ vancomycin Bayesian dosing decision-support services provided by BA to CE under the Services Agreement.',
    approved,
  );

  // ─── 2. Obligations of BA ─────────────────────────────────────────
  drawHeading(state, "2. Obligations and Activities of Business Associate", approved);

  // (A)/(B) Permitted/required and prohibition
  drawBody(
    state,
    "2.1  BA shall not Use or Disclose PHI other than as permitted or required by this BAA or as Required by Law.",
    approved,
  );
  drawCitation(state, "45 CFR § 164.504(e)(2)(i), (e)(2)(ii)(A).", approved);

  // (C) Safeguards
  drawBody(
    state,
    "2.2  BA shall use appropriate safeguards, and with respect to ePHI shall comply with Subpart C of 45 CFR Part 164 (the Security Rule), including the administrative safeguards at § 164.308, physical safeguards at § 164.310, and technical safeguards at § 164.312, to prevent any Use or Disclosure of PHI other than as provided for by this BAA.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.504(e)(2)(ii)(B), 164.308–164.312.", approved);

  // (D) Reporting
  drawBody(
    state,
    "2.3  BA shall report to CE: (a) any Use or Disclosure of PHI not permitted by this BAA of which BA becomes aware, including Breaches of Unsecured PHI as required by 45 CFR § 164.410; and (b) any Security Incident of which BA becomes aware. The Parties agree that unsuccessful attempts at unauthorized access (e.g. pings, port scans, and similar reconnaissance) constitute Security Incidents for which an aggregated written report not less than annually shall satisfy this Section.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.504(e)(2)(ii)(C), 164.410, 164.314(a)(2)(i)(C).", approved);
  drawBody(
    state,
    "2.4  Breach Notification Timing. BA shall provide CE with a preliminary written notice of any Breach of Unsecured PHI without unreasonable delay and in no case later than five (5) business days after Discovery. BA shall provide CE with a full written notice containing the information required by 45 CFR § 164.410(c) without unreasonable delay and in no case later than thirty (30) calendar days after Discovery. \"Discovery\" has the meaning given in 45 CFR § 164.410(a)(2). Nothing in this Section relieves BA of the 60-calendar-day regulatory ceiling in § 164.410(b).",
    approved,
  );
  drawCitation(state, "45 CFR § 164.410(a)–(c).", approved);
  drawDraftNote(
    state,
    "Hospital CE markups frequently insist on 24- or 48-hour preliminary notice. The 5-business-day window is the operationally realistic position for a small SaaS BA; tighten only if on-call paging infrastructure is funded.",
    approved,
  );

  // (E) Subcontractors
  drawBody(
    state,
    "2.5  Subcontractors. In accordance with 45 CFR §§ 164.502(e)(1)(ii) and 164.308(b)(2), BA shall ensure that any Subcontractor that creates, receives, maintains, or transmits PHI on behalf of BA agrees in writing to restrictions and conditions at least as stringent as those that apply to BA through this BAA. A current list of BA's Subcontractors that handle PHI shall be made available to CE upon written request.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.502(e)(1)(ii), 164.308(b), 164.504(e)(2)(ii)(D).", approved);
  drawDraftNote(
    state,
    "As of the Effective Date, BA's hosting Subcontractor is Render Services, Inc. Confirm signed BA-Render BAA is on file before customer GA.",
    approved,
  );

  // (F) Access
  drawBody(
    state,
    "2.6  Access. If BA maintains PHI in a Designated Record Set, BA shall make such PHI available to CE within fifteen (15) calendar days of CE's written request, in the time and manner required for CE to respond to an Individual's access request under 45 CFR § 164.524. The Parties acknowledge that the Services process PHI transiently in memory to compute dosing recommendations and do not persist patient identifiers beyond the calculation session and routine transactional logs; accordingly, BA may not maintain PHI in a Designated Record Set in the ordinary course.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.504(e)(2)(ii)(E), 164.524.", approved);

  // (G) Amendment
  drawBody(
    state,
    "2.7  Amendment. BA shall make any amendment(s) to PHI in a Designated Record Set as directed by CE, or take other measures as necessary to satisfy CE's obligations under 45 CFR § 164.526.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.504(e)(2)(ii)(F), 164.526.", approved);

  // (H) Accounting
  drawBody(
    state,
    "2.8  Accounting of Disclosures. BA shall document Disclosures of PHI and information related to such Disclosures as would be required for CE to respond to a request by an Individual for an accounting of Disclosures under 45 CFR § 164.528, and shall provide such documentation to CE within thirty (30) calendar days of written request.",
    approved,
  );
  drawCitation(state, "45 CFR §§ 164.504(e)(2)(ii)(G), 164.528.", approved);

  // (I) Internal practices + HHS access
  drawBody(
    state,
    "2.9  Internal Practices; HHS Access. To the extent BA is to carry out one or more of CE's obligations under Subpart E of 45 CFR Part 164, BA shall comply with the requirements of Subpart E that apply to CE in performing such obligation. BA shall make its internal practices, books, and records relating to the Use and Disclosure of PHI received from CE, or created or received by BA on behalf of CE, available to the Secretary of the U.S. Department of Health and Human Services for purposes of determining CE's and BA's compliance with the HIPAA Rules.",
    approved,
  );
  drawCitation(state, "45 CFR § 164.504(e)(2)(ii)(H), (I).", approved);

  // (J) Return or destruction
  drawBody(
    state,
    "2.10  Return or Destruction at Termination. Upon termination of this BAA for any reason, BA shall, if feasible, return to CE or destroy all PHI received from, or created or received by BA on behalf of, CE that BA still maintains in any form, and retain no copies of such PHI. BA shall certify such destruction in writing within thirty (30) calendar days. To the extent return or destruction is infeasible — including, without limitation, with respect to PHI residing on routine backup media subject to BA's standard rotation schedule — BA shall extend the protections of this BAA to such PHI and limit further Uses and Disclosures to those purposes that make return or destruction infeasible, for so long as BA maintains such PHI.",
    approved,
  );
  drawCitation(state, "45 CFR § 164.504(e)(2)(ii)(J); HHS CSP FAQ (transient retention).", approved);

  // ─── 3. Permitted uses ────────────────────────────────────────────
  drawHeading(state, "3. Permitted Uses and Disclosures by Business Associate", approved);
  drawBody(
    state,
    "3.1  BA may Use and Disclose PHI only as necessary to perform the Services, and as permitted by 45 CFR § 164.504(e)(4): (a) for the proper management and administration of BA or to carry out the legal responsibilities of BA, provided that any Disclosure for such purposes is Required by Law or BA obtains reasonable assurances from the recipient that the PHI will be held confidentially and Used or further Disclosed only as Required by Law or for the purpose for which it was Disclosed, and the recipient notifies BA of any instances of which it is aware that the confidentiality of the information has been breached; and (b) to provide Data Aggregation services to CE as permitted by 45 CFR § 164.504(e)(2)(i)(B).",
    approved,
  );
  drawCitation(state, "45 CFR § 164.504(e)(4), (e)(2)(i)(B).", approved);

  // ─── 4. Term & termination ────────────────────────────────────────
  drawHeading(state, "4. Term and Termination", approved);
  drawBody(
    state,
    "4.1  Term. This BAA shall be effective as of the Effective Date and shall remain in effect until the Services Agreement terminates or expires, unless terminated earlier as provided herein. The obligations of Section 2.10 (Return or Destruction) and Sections 5, 6, 7, and 9 shall survive termination.",
    approved,
  );
  drawBody(
    state,
    "4.2  Termination for Cause. Without prejudice to any other rights, either Party may terminate this BAA upon written notice to the other Party if the other Party has engaged in a pattern of activity or practice constituting a material breach or violation of its obligations under this BAA, and such breach is not cured within thirty (30) calendar days after written notice from the non-breaching Party. If termination is infeasible, the non-breaching Party shall report the violation to the Secretary as contemplated by 45 CFR § 164.504(e)(1)(ii).",
    approved,
  );
  drawCitation(state, "45 CFR § 164.504(e)(2)(iii), (e)(1)(ii).", approved);

  // ─── 5. Indemnification & liability ───────────────────────────────
  drawHeading(state, "5. Indemnification and Limitation of Liability", approved);
  drawBody(
    state,
    "5.1  Mutual Indemnification. Each Party (the \"Indemnifying Party\") shall defend and indemnify the other Party (the \"Indemnified Party\") against third-party claims, demands, suits, or proceedings to the extent arising from the Indemnifying Party's breach of this BAA or violation of the HIPAA Rules, and shall pay damages finally awarded against the Indemnified Party in respect of such claims, provided the Indemnified Party (a) promptly notifies the Indemnifying Party of the claim, (b) grants the Indemnifying Party sole control of the defense and any settlement, and (c) provides reasonable cooperation. This Section sets forth each Party's sole and exclusive remedy for the other Party's HIPAA-related breach.",
    approved,
  );
  drawDraftNote(
    state,
    "Mutual, third-party-only, fault-based. Hospital markups commonly demand one-way indemnification including first-party claims; counter-position is this Section as drafted.",
    approved,
  );
  drawBody(
    state,
    "5.2  Limitation of Liability. The limitation of liability set forth in the underlying Services Agreement shall apply to this BAA, except that BA's aggregate liability arising out of or relating to a Breach of Unsecured PHI shall not exceed two (2) times the fees actually paid by CE to BA under the Services Agreement during the twelve (12) months preceding the event giving rise to the claim. Nothing in this Section limits liability that cannot be excluded under applicable law.",
    approved,
  );
  drawDraftNote(
    state,
    "2x super-cap is market-acceptable for early-stage healthcare SaaS. Attorney to confirm against underlying MSA liability cap (typical: 12 months of fees).",
    approved,
  );

  // ─── 6. Subcontractors / Render note ──────────────────────────────
  drawHeading(state, "6. Subcontractor Disclosure", approved);
  drawBody(
    state,
    "6.1  Current Subcontractors. BA shall make available to CE, upon CE's written request, a list of Subcontractors that create, receive, maintain, or transmit PHI on BA's behalf. Material changes to such list shall be made available to CE within thirty (30) calendar days of the change.",
    approved,
  );
  drawDraftNote(
    state,
    "As of the Effective Date, BA's hosting Subcontractor is Render Services, Inc.; no other Subcontractor handles PHI. Maintain updated annex if this changes.",
    approved,
  );

  // ─── 7. Insurance ─────────────────────────────────────────────────
  drawHeading(state, "7. Insurance", approved);
  drawBody(
    state,
    "7.1  BA shall maintain, at its expense, cyber liability and technology errors & omissions insurance in an amount of not less than US$1,000,000 per claim and US$3,000,000 in the aggregate, covering, at minimum, (a) unauthorized access to or disclosure of PHI, (b) network security failure, and (c) regulatory defense costs. BA shall provide CE with a certificate of insurance upon written request.",
    approved,
  );
  drawDraftNote(
    state,
    "Confirm cyber + tech E&O policy is bound at these limits before any customer signing. Attorney may negotiate down to $1M/$1M for smaller Department customers, or up to $5M aggregate for hospital systems.",
    approved,
  );

  // ─── 8. Audit ─────────────────────────────────────────────────────
  drawHeading(state, "8. Audit and Compliance Verification", approved);
  drawBody(
    state,
    "8.1  Compliance Documentation. In lieu of on-site audit rights, BA shall make the following available to CE on written request no more than annually: (a) BA's most recent SOC 2 Type II or HITRUST report, when available; (b) a written summary of BA's HIPAA risk assessment and remediation status; and (c) a written response to a reasonable CE compliance questionnaire.",
    approved,
  );
  drawBody(
    state,
    "8.2  Post-Incident Review. CE may, upon written notice and at CE's expense, conduct an on-site review limited to the scope reasonably necessary to investigate a confirmed Breach of Unsecured PHI involving CE's PHI, during BA's normal business hours and subject to BA's reasonable confidentiality and security requirements.",
    approved,
  );

  // ─── 9. Governing law ─────────────────────────────────────────────
  drawHeading(state, "9. Governing Law and Venue", approved);
  drawBody(
    state,
    "9.1  This BAA is governed by the laws of the State of Delaware, without regard to its conflict-of-laws principles. Any dispute arising out of or relating to this BAA shall be brought exclusively in the state or federal courts located in Wilmington, Delaware, and each Party irrevocably consents to such jurisdiction and venue.",
    approved,
  );
  drawDraftNote(
    state,
    "Confirm Dōsys Health LLC's state of organization. If not Delaware, replace throughout.",
    approved,
  );

  // ─── 10. Miscellaneous ────────────────────────────────────────────
  drawHeading(state, "10. Miscellaneous", approved);
  drawBody(
    state,
    "10.1  Amendment. The Parties agree to take such action as is necessary to amend this BAA from time to time as is necessary for the Parties to comply with the requirements of the HIPAA Rules and any other applicable law.",
    approved,
  );
  drawBody(
    state,
    "10.2  Interpretation. Any ambiguity in this BAA shall be resolved to permit the Parties to comply with the HIPAA Rules.",
    approved,
  );
  drawCitation(state, "HHS sample provisions, Miscellaneous (Interpretation).", approved);
  drawBody(
    state,
    "10.3  Regulatory References. A reference in this BAA to a section in the HIPAA Rules means the section as in effect or as amended from time to time.",
    approved,
  );
  drawBody(
    state,
    "10.4  Survival. The rights and obligations of BA under Section 2.10 (Return or Destruction) and Sections 5, 6, 7, and 9 shall survive any termination or expiration of this BAA.",
    approved,
  );
  drawBody(
    state,
    "10.5  No Third-Party Beneficiaries. Nothing in this BAA shall confer upon any person other than the Parties and their respective successors or permitted assigns any rights, remedies, obligations, or liabilities whatsoever.",
    approved,
  );
  drawBody(
    state,
    "10.6  Entire Agreement. This BAA, together with the Services Agreement, constitutes the entire agreement between the Parties regarding the subject matter hereof and supersedes all prior agreements and understandings, written or oral, with respect to such subject matter.",
    approved,
  );

  // ─── Signature blocks ─────────────────────────────────────────────
  drawHeading(state, "Signatures", approved);
  ensureRoom(state, 12, approved);

  const sigBlockY = state.cursorY;
  // CE
  state.page.drawText("COVERED ENTITY", { x: MARGIN, y: sigBlockY, size: BODY_SIZE, font: bodyBold });
  state.page.drawText(toWinAnsi(ctx.institutionName), { x: MARGIN, y: sigBlockY - 16, size: BODY_SIZE, font: body });
  state.page.drawLine({
    start: { x: MARGIN, y: sigBlockY - 40 },
    end: { x: MARGIN + 220, y: sigBlockY - 40 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Signature", { x: MARGIN, y: sigBlockY - 52, size: CITE_SIZE, font: italic });
  state.page.drawLine({
    start: { x: MARGIN, y: sigBlockY - 80 },
    end: { x: MARGIN + 220, y: sigBlockY - 80 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Printed name", { x: MARGIN, y: sigBlockY - 92, size: CITE_SIZE, font: italic });
  state.page.drawLine({
    start: { x: MARGIN, y: sigBlockY - 120 },
    end: { x: MARGIN + 220, y: sigBlockY - 120 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Title                                            Date", { x: MARGIN, y: sigBlockY - 132, size: CITE_SIZE, font: italic });

  // BA
  const baX = PAGE_WIDTH - MARGIN - 220;
  state.page.drawText("BUSINESS ASSOCIATE", { x: baX, y: sigBlockY, size: BODY_SIZE, font: bodyBold });
  state.page.drawText(toWinAnsi("Dōsys Health LLC"), { x: baX, y: sigBlockY - 16, size: BODY_SIZE, font: body });
  state.page.drawLine({
    start: { x: baX, y: sigBlockY - 40 },
    end: { x: baX + 220, y: sigBlockY - 40 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Signature", { x: baX, y: sigBlockY - 52, size: CITE_SIZE, font: italic });
  state.page.drawLine({
    start: { x: baX, y: sigBlockY - 80 },
    end: { x: baX + 220, y: sigBlockY - 80 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Printed name", { x: baX, y: sigBlockY - 92, size: CITE_SIZE, font: italic });
  state.page.drawLine({
    start: { x: baX, y: sigBlockY - 120 },
    end: { x: baX + 220, y: sigBlockY - 120 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  state.page.drawText("Title                                            Date", { x: baX, y: sigBlockY - 132, size: CITE_SIZE, font: italic });

  // ─── Footer on every page ─────────────────────────────────────────
  const totalPages = doc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = doc.getPage(i);
    p.drawText(
      `Vancomyzer™ BAA · ${BAA_TEMPLATE_VERSION} · Generated ${ctx.generatedAt.toISOString().slice(0, 10)} · Page ${i + 1} of ${totalPages}`,
      {
        x: MARGIN,
        y: 25,
        size: CITE_SIZE,
        font: italic,
        color: rgb(0.4, 0.4, 0.45),
      },
    );
  }

  return doc.save();
}

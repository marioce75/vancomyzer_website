/**
 * Regulatory disclaimer strip — rendered on every screen of the app.
 *
 * Uses the approved short-form regulatory wording (review remediation,
 * 15 Sep 2026). Vancomyzer is DESIGNED to meet the non-device CDS criteria
 * of FD&C Act §520(o)(1)(E); the FDA has made no determination, so never
 * say it "is" or is "classified as" non-device CDS. The long form lives on
 * /disclaimer, /register and the landing page. Do not remove without legal
 * review.
 */
export default function RegulatoryFooter() {
  return (
    <div
      role="contentinfo"
      aria-label="Regulatory disclaimer"
      style={{
        borderTop: "1px solid var(--color-border)",
        background: "var(--color-card)",
        padding: "8px 16px",
        textAlign: "center",
        fontSize: 11,
        lineHeight: 1.5,
        color: "var(--color-dim)",
        fontFamily: "'Share Tech Mono', monospace",
      }}
    >
      Vancomyzer&trade; is a clinical decision-support tool for qualified healthcare
      professionals only. Not FDA-cleared or approved. Designed to meet the non-device
      clinical decision support criteria of FD&amp;C Act §520(o)(1)(E); not reviewed by
      the FDA.
    </div>
  );
}

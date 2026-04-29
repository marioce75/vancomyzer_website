/**
 * Regulatory disclaimer strip — required on every screen of the app
 * per 21st Century Cures Act §3060 non-device CDS posture and our
 * dosys.health public commitments. Do not remove without legal review.
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
      professionals only. Not FDA-cleared as a medical device. Classified as
      non-device CDS under the 21st Century Cures Act, Section 3060.
    </div>
  );
}

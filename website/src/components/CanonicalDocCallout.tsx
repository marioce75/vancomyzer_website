/**
 * Canonical legal-document callout.
 *
 * Sits at the top of in-app /disclaimer, /privacy, /terms (and BAA
 * surfaces) and points to the authoritative version on dosys.health.
 * The in-app pages remain useful for direct visitors but are explicitly
 * marked as summaries — the dosys.health document is what governs.
 */

interface CanonicalDocCalloutProps {
  docName: string;
  href: string;
}

export default function CanonicalDocCallout({ docName, href }: CanonicalDocCalloutProps) {
  return (
    <div
      role="region"
      aria-label="Canonical document notice"
      className="mt-6 mb-8 px-4 py-3 border-l-4 rounded-r"
      style={{
        borderLeftColor: "#0d9488",
        background: "#f0fdfa",
        color: "#115e59",
      }}
    >
      <p className="text-sm leading-relaxed m-0">
        <strong>The authoritative {docName} for Vancomyzer&trade; is maintained at{" "}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0d9488", textDecoration: "underline", fontWeight: 600 }}
          >
            {href.replace(/^https?:\/\//, "")}
          </a>.
        </strong>{" "}
        The summary below is provided for reference; the linked document governs in case of any conflict.
      </p>
    </div>
  );
}

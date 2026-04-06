"use client";

import type { CalculationDetails } from "@/types/calculator";

interface ResultEvidenceBannerProps {
  details?: CalculationDetails | null;
}

function toneFromLevel(level: CalculationDetails["review_status"]["level"]) {
  if (level === "caution") {
    return {
      wrap: "border-amber-200 bg-amber-50",
      title: "text-amber-950",
      body: "text-amber-900",
      actionWrap: "border-amber-300 bg-white/70",
      actionLabel: "text-amber-950",
    };
  }
  if (level === "supported") {
    return {
      wrap: "border-emerald-200 bg-emerald-50",
      title: "text-emerald-950",
      body: "text-emerald-900",
      actionWrap: "border-emerald-300 bg-white/70",
      actionLabel: "text-emerald-950",
    };
  }
  return {
    wrap: "border-blue-200 bg-blue-50",
    title: "text-blue-950",
    body: "text-blue-900",
    actionWrap: "border-blue-300 bg-white/70",
    actionLabel: "text-blue-950",
  };
}

export default function ResultEvidenceBanner({
  details,
}: ResultEvidenceBannerProps) {
  if (!details) return null;

  const tone = toneFromLevel(details.review_status.level);
  const [primaryAction, ...remainingActions] = details.review_status.next_actions;

  return (
    <section className={`rounded-lg border p-4 ${tone.wrap}`}>
      <h2 className={`text-lg font-semibold ${tone.title}`}>
        {details.review_status.banner_title}
      </h2>
      <p className={`mt-2 text-sm ${tone.body}`}>
        {details.review_status.banner_body}
      </p>

      {primaryAction && (
        <div className={`mt-3 rounded-md border p-3 ${tone.actionWrap}`}>
          <p className={`text-sm font-medium ${tone.actionLabel}`}>Recommended next step</p>
          <p className={`mt-1 text-sm ${tone.body}`}>{primaryAction}</p>
        </div>
      )}

      {remainingActions.length > 0 && (
        <ul className={`mt-3 list-disc space-y-1 pl-5 text-sm ${tone.body}`}>
          {remainingActions.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <a href="/faq" className={`font-medium underline hover:no-underline ${tone.title}`}>
          FAQ
        </a>
        <a href="/references" className={`font-medium underline hover:no-underline ${tone.title}`}>
          References
        </a>
      </div>
    </section>
  );
}

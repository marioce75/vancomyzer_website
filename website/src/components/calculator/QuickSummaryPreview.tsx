"use client";

interface QuickSummaryPreviewProps {
  quick_summary?: string | null;
}

export default function QuickSummaryPreview({
  quick_summary,
}: QuickSummaryPreviewProps) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Quick summary preview
      </h2>
      <div className="mt-4">
        {quick_summary != null && quick_summary !== "" ? (
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-sm text-gray-700">
            {quick_summary}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">
            Run a calculation to see the quick summary.
          </p>
        )}
      </div>
    </section>
  );
}

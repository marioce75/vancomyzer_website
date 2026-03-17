"use client";

interface ClinicalNotePreviewProps {
  clinical_note?: string | null;
}

export default function ClinicalNotePreview({
  clinical_note,
}: ClinicalNotePreviewProps) {
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Clinical note preview
      </h2>
      <div className="mt-4">
        {clinical_note != null && clinical_note !== "" ? (
          <pre className="whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-sm text-gray-700">
            {clinical_note}
          </pre>
        ) : (
          <p className="text-sm text-gray-500">
            Run a calculation to see the clinical note preview.
          </p>
        )}
      </div>
    </section>
  );
}

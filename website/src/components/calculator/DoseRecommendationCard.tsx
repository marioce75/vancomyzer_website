"use client";

interface DoseRecommendationCardProps {
  recommended_dose?: string | null;
  recommended_interval_hours?: number | null;
}

export default function DoseRecommendationCard({
  recommended_dose,
  recommended_interval_hours,
}: DoseRecommendationCardProps) {
  const hasContent =
    (recommended_dose != null && recommended_dose !== "") ||
    (recommended_interval_hours != null && !Number.isNaN(recommended_interval_hours));

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Dose recommendation
      </h2>
      <div className="mt-4 text-gray-700">
        {hasContent ? (
          <>
            {recommended_dose != null && recommended_dose !== "" && (
              <p>{recommended_dose}</p>
            )}
            {recommended_interval_hours != null &&
              !Number.isNaN(recommended_interval_hours) && (
                <p className="mt-1">
                  Recommended interval: {recommended_interval_hours} hours
                </p>
              )}
          </>
        ) : (
          <p className="text-gray-500">Run a calculation to see recommendation.</p>
        )}
      </div>
    </section>
  );
}

"use client";

interface AssumptionsCardProps {
  assumptions?: string[] | null;
}

export default function AssumptionsCard({
  assumptions,
}: AssumptionsCardProps) {
  const list = assumptions?.filter(Boolean) ?? [];

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">Assumptions</h2>
      <div className="mt-4">
        {list.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
            {list.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">
            Run a calculation to see assumptions.
          </p>
        )}
      </div>
    </section>
  );
}

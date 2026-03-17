"use client";

import type { CalculateRequestLevel } from "@/types/calculator";

interface LevelEntryTableProps {
  levels: CalculateRequestLevel[];
  onChange: (levels: CalculateRequestLevel[]) => void;
}

const emptyLevel: CalculateRequestLevel = {
  value_mcg_ml: 0,
  collection_time: "",
  time_since_last_dose_hours: 0,
};

export default function LevelEntryTable({
  levels,
  onChange,
}: LevelEntryTableProps) {
  const update = (index: number, updates: Partial<CalculateRequestLevel>) => {
    const next = [...levels];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const addRow = () => {
    onChange([...levels, { ...emptyLevel }]);
  };

  const removeRow = (index: number) => {
    if (levels.length <= 1) return;
    onChange(levels.filter((_, i) => i !== index));
  };

  const displayLevels = levels.length ? levels : [emptyLevel];

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-semibold text-gray-900">
        Vancomycin level entry
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Enter at least one level with collection time and time since last dose.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-700">
              <th className="pb-2 pr-2 font-medium">Level (mcg/mL)</th>
              <th className="pb-2 pr-2 font-medium">Collection time</th>
              <th className="pb-2 pr-2 font-medium">Time since last dose (h)</th>
              <th className="pb-2 font-medium w-16" />
            </tr>
          </thead>
          <tbody>
            {displayLevels.map((level, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={level.value_mcg_ml ?? ""}
                    onChange={(e) =>
                      update(i, {
                        value_mcg_ml: e.target.value
                          ? Number(e.target.value)
                          : 0,
                      })
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="datetime-local"
                    value={
                      level.collection_time
                        ? level.collection_time.slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      update(i, { collection_time: e.target.value || "" })
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={level.time_since_last_dose_hours ?? ""}
                    onChange={(e) =>
                      update(i, {
                        time_since_last_dose_hours: e.target.value
                          ? Number(e.target.value)
                          : 0,
                      })
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  {displayLevels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={addRow}
          className="mt-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Add level
        </button>
      </div>
    </section>
  );
}

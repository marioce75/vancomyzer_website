"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ResearchSummary {
  total: number;
  eligible: number;
  excluded: number;
  obesity: number;
  totalLevels: number;
  totalDoses: number;
}

export default function ResearchPage() {
  const [summary, setSummary] = useState<ResearchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/research");
        if (res.ok) {
          const data = await res.json();
          setSummary(data.summary ?? null);
        } else {
          setError("Failed to load research data.");
        }
      } catch {
        setError("Research module unavailable.");
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading research data...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Research</h1>
      <p className="text-sm text-gray-500 mb-6">Enrollment summary and research database access</p>

      {error && (
        <div className="mb-4 px-4 py-2 text-sm rounded-md bg-amber-50 border border-amber-300 text-amber-800">
          {error}
        </div>
      )}

      {/* Enrollment summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Enrolled", value: summary.total, color: "text-gray-800" },
            { label: "Eligible (Inclusion Met)", value: summary.eligible, color: "text-green-700" },
            { label: "Excluded", value: summary.excluded, color: "text-red-700" },
            { label: "Obesity (BMI >= 40)", value: summary.obesity, color: "text-amber-700" },
            { label: "Total Levels Recorded", value: summary.totalLevels, color: "text-gray-800" },
            { label: "Total Doses Recorded", value: summary.totalDoses, color: "text-gray-800" },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{card.label}</p>
              <span className={`text-2xl font-bold ${card.color}`}>{card.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Links */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Quick Links</h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/research"
          className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90"
          style={{ background: "#1e4d8c" }}
        >
          Full Research Dashboard
        </Link>
        <Link
          href="/research/enter"
          className="px-4 py-2 text-sm font-medium text-white rounded-md bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          Add New Patient
        </Link>
      </div>
    </div>
  );
}

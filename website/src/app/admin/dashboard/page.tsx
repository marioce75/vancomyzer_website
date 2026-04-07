"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OverviewData {
  users: { total: number; pending: number; active: number; disabled: number; mfaEnabled: number };
  security: { total: number; failedLogins24h: number; lockedAccounts: number };
  research: { total: number; eligible: number; excluded: number; obesity: number } | null;
  health: { status: string; uptime_seconds: number; version: string; db: string } | null;
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/dashboard/overview");
        if (res.ok) setData(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading dashboard...</div>;
  if (!data) return <div className="text-red-600 text-center py-20">Failed to load dashboard data.</div>;

  const cards = [
    {
      title: "Total Users",
      value: data.users.total,
      badge: data.users.pending > 0 ? `${data.users.pending} pending` : null,
      badgeColor: "bg-amber-100 text-amber-800",
    },
    {
      title: "Active Users",
      value: data.users.active,
      badge: null,
      badgeColor: "",
    },
    {
      title: "Security Events (24h)",
      value: data.security.failedLogins24h,
      badge: data.security.lockedAccounts > 0 ? `${data.security.lockedAccounts} locked` : null,
      badgeColor: "bg-red-100 text-red-800",
    },
    {
      title: "Research Patients",
      value: data.research?.total ?? 0,
      badge: data.research ? `${data.research.eligible} eligible` : null,
      badgeColor: "bg-green-100 text-green-800",
    },
    {
      title: "System Health",
      value: data.health?.status === "ok" ? "Healthy" : "Degraded",
      badge: data.health ? `v${data.health.version}` : null,
      badgeColor: data.health?.status === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
    },
    {
      title: "MFA Enabled",
      value: data.users.mfaEnabled,
      badge: null,
      badgeColor: "",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Dashboard Overview</h1>
      <p className="text-sm text-gray-500 mb-6">Vancomyzer Admin Console</p>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.title} className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{card.title}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: "#1e4d8c" }}>{card.value}</span>
              {card.badge && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${card.badgeColor}`}>
                  {card.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Quick Actions</h2>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/dashboard/security"
          className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90"
          style={{ background: "#1e4d8c" }}
        >
          View Audit Log
        </Link>
        <Link
          href="/research/enter"
          className="px-4 py-2 text-sm font-medium text-white rounded-md bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          Add Research Patient
        </Link>
        <Link
          href="/admin/dashboard/users"
          className="px-4 py-2 text-sm font-medium text-white rounded-md bg-gray-600 hover:bg-gray-700 transition-colors"
        >
          User Management
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";

const REQUIRED_ENV_VARS = [
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "ADMIN_EMAIL",
  "BACKUP_ENCRYPTION_KEY",
  "B2_ENDPOINT",
  "B2_KEY_ID",
  "B2_APP_KEY",
  "B2_BUCKET",
];

interface HealthData {
  status: string;
  timestamp: string;
  version: string;
  db: string;
  uptime_seconds: number;
}

export default function SystemPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/health");
        if (res.ok) setHealth(await res.json());
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  if (loading) return <div className="text-gray-500 text-center py-20">Loading system info...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>System Configuration</h1>
      <p className="text-sm text-gray-500 mb-6">Environment, health, and deployment information</p>

      {/* Health check */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Health Check</h2>
        {health ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                health.status === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {health.status === "ok" ? "Healthy" : "Degraded"}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Database</p>
              <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                health.db === "connected" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {health.db}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="text-sm font-semibold text-gray-800 mt-1">{formatUptime(health.uptime_seconds)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Check</p>
              <p className="text-sm text-gray-800 mt-1">{new Date(health.timestamp).toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600">Health check unavailable.</p>
        )}
      </div>

      {/* App version */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Application</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Version</p>
            <p className="text-sm font-semibold text-gray-800 mt-1">{health?.version ?? "0.1.0"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Framework</p>
            <p className="text-sm text-gray-800 mt-1">Next.js 14 (App Router)</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Runtime</p>
            <p className="text-sm text-gray-800 mt-1">Node.js</p>
          </div>
        </div>
      </div>

      {/* Environment variables */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Environment Variables</h2>
        <p className="text-xs text-gray-400 mb-3">Key names only. Values are not exposed for security.</p>
        <div className="space-y-1.5">
          {REQUIRED_ENV_VARS.map((varName) => (
            <div key={varName} className="flex items-center gap-3 text-sm">
              <span className="font-mono text-xs text-gray-700 w-52">{varName}</span>
              {/* Server-side status unknown from client; show as "Required" indicator */}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
                REQUIRED
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* External links */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">External Links</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://dashboard.render.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:opacity-90"
            style={{ background: "#1e4d8c" }}
          >
            Render Dashboard
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}

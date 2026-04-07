"use client";

import { useState, useEffect, useCallback } from "react";

interface UserRecord {
  id: number;
  full_name: string;
  username: string;
  email: string;
  credentials: string;
  institution: string | null;
  role: string;
  status: string;
  last_login: string | null;
  mfa_enabled: number;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "disabled">("all");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (res.ok) {
        const data = await res.json();
        const all: UserRecord[] = [
          ...(data.pending ?? []).map((u: Record<string, unknown>) => ({ ...u, status: "pending", role: "pharmacist", mfa_enabled: 0, failed_login_attempts: 0, locked_until: null, last_login: null })),
          ...(data.active ?? []).map((u: Record<string, unknown>) => ({ ...u, status: "active", mfa_enabled: u.mfa_enabled ?? 0, failed_login_attempts: u.failed_login_attempts ?? 0, locked_until: u.locked_until ?? null })),
        ];
        setUsers(all);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async (action: string, userId: number) => {
    setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Done.");
      fetchUsers();
    } catch {
      setMessage("Request failed.");
    }
  };

  const handleUnlock = async (userId: number) => {
    setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", userId }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Done.");
      fetchUsers();
    } catch {
      setMessage("Request failed.");
    }
  };

  const handleForceReset = async (userId: number) => {
    setMessage("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "force_reset", userId }),
      });
      const data = await res.json();
      setMessage(data.message ?? data.error ?? "Done.");
    } catch {
      setMessage("Request failed.");
    }
  };

  const filtered = users.filter((u) => filter === "all" || u.status === filter);

  if (loading) return <div className="text-gray-500 text-center py-20">Loading users...</div>;

  const isLocked = (u: UserRecord) => u.locked_until && new Date(u.locked_until) > new Date();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>User Management</h1>
      <p className="text-sm text-gray-500 mb-4">Approve, manage, and monitor user accounts</p>

      {message && (
        <div className="mb-4 px-4 py-2 text-sm rounded-md bg-green-50 border border-green-300 text-green-800">
          {message}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "pending", "active", "disabled"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
              filter === f
                ? "bg-blue-50 border-blue-300 text-blue-800"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "pending" && users.filter((u) => u.status === "pending").length > 0 && (
              <span className="ml-1 bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full text-[10px]">
                {users.filter((u) => u.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Name</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Username</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Email</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Role</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Status</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Last Login</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>MFA</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Failed</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-400">No users found.</td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{u.full_name}</td>
                    <td className="px-3 py-2 font-semibold text-gray-800">{u.username}</td>
                    <td className="px-3 py-2 text-gray-600">{u.email}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        u.status === "active" ? "bg-green-100 text-green-800" :
                        u.status === "pending" ? "bg-amber-100 text-amber-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {isLocked(u) ? "LOCKED" : u.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {u.last_login ? new Date(u.last_login).toLocaleString() : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      {u.mfa_enabled ? (
                        <span className="text-green-600 font-semibold">ON</span>
                      ) : (
                        <span className="text-gray-400">OFF</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{u.failed_login_attempts ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 flex-wrap">
                        {u.status === "pending" && (
                          <>
                            <button onClick={() => handleAction("approve", u.id)} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-green-700 rounded hover:bg-green-800">
                              APPROVE
                            </button>
                            <button onClick={() => handleAction("disable", u.id)} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-700 rounded hover:bg-red-800">
                              REJECT
                            </button>
                          </>
                        )}
                        {u.status === "active" && u.role !== "admin" && (
                          <button onClick={() => handleAction("disable", u.id)} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-red-700 rounded hover:bg-red-800">
                            DISABLE
                          </button>
                        )}
                        {isLocked(u) && (
                          <button onClick={() => handleUnlock(u.id)} className="px-2 py-0.5 text-[10px] font-semibold text-white bg-amber-600 rounded hover:bg-amber-700">
                            UNLOCK
                          </button>
                        )}
                        {u.status === "active" && (
                          <button onClick={() => handleForceReset(u.id)} className="px-2 py-0.5 text-[10px] font-semibold text-gray-700 bg-gray-200 rounded hover:bg-gray-300">
                            RESET PW
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

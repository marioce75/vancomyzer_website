"use client";

/**
 * User Management dashboard — redesign (v2026.05).
 *
 * Three-pane layout:
 *   - Top: dashboard widgets (total, growth, tier mix, top country, top org)
 *   - Left sidebar: segments (tier, country top-N, org top-N, health buckets)
 *   - Center: search bar + filter chips + paginated table with kebab actions
 *   - Right drawer (slide-over): selected user's full detail + all actions
 *
 * Built for scale: server-side filtering + pagination via /api/admin/users-v2/list,
 * segment counts via /api/admin/users-v2/segments. The old flat-table-with-6-inline-
 * buttons approach broke past 500 users; this one handles 50K+.
 *
 * Actions still POST to /api/admin (the legacy action endpoint), which handles
 * approve, disable, reactivate, unlock, force_reset, delete, set_role, set_tier.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCountryName, getInstitutionTypeName, getPracticeSettingName } from "@/lib/userCategorization";

interface UserRow {
  id: number;
  username: string;
  email: string;
  full_name: string;
  credentials: string;
  institution: string | null;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login: string | null;
  mfa_enabled: number;
  failed_login_attempts: number;
  locked_until: string | null;
  subscription_tier: string;
  subscription_status: string;
  subscription_expiry: string | null;
  institutional_account_id: number | null;
  institutional_role: string;
  country_code: string | null;
  institution_type: string | null;
  practice_setting: string | null;
}

interface SegmentCounts {
  total: number;
  by_status: Array<{ key: string; count: number }>;
  by_tier: Array<{ key: string; count: number }>;
  by_country: Array<{ key: string; count: number }>;
  by_institution_type: Array<{ key: string; count: number }>;
  top_institutional_accounts: Array<{ id: number; institution_name: string; count: number }>;
  health: { inactive_90d: number; mfa_off: number; locked: number; profile_incomplete: number };
  growth: { new_24h: number; new_7d: number; new_30d: number };
}

interface ListResponse {
  users: UserRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

type FilterShape = {
  search: string;
  status: string;
  tier: string;
  country: string;
  institution_type: string;
  institutional_account_id: number | null;
  mfa_off: boolean;
  locked: boolean;
  inactive_days: number | null;
  sort: string;
  page: number;
};

const DEFAULT_FILTER: FilterShape = {
  search: "",
  status: "",
  tier: "",
  country: "",
  institution_type: "",
  institutional_account_id: null,
  mfa_off: false,
  locked: false,
  inactive_days: null,
  sort: "created_desc",
  page: 1,
};

export default function UsersPage() {
  const [filter, setFilter] = useState<FilterShape>(DEFAULT_FILTER);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [list, setList] = useState<ListResponse | null>(null);
  const [segments, setSegments] = useState<SegmentCounts | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Debounce search 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filter.search), 250);
    return () => clearTimeout(t);
  }, [filter.search]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filter.status) p.set("status", filter.status);
    if (filter.tier) p.set("tier", filter.tier);
    if (filter.country) p.set("country", filter.country);
    if (filter.institution_type) p.set("institution_type", filter.institution_type);
    if (filter.institutional_account_id != null) p.set("institutional_account_id", String(filter.institutional_account_id));
    if (filter.mfa_off) p.set("mfa_off", "1");
    if (filter.locked) p.set("locked", "1");
    if (filter.inactive_days != null) p.set("inactive_days", String(filter.inactive_days));
    p.set("sort", filter.sort);
    p.set("page", String(filter.page));
    p.set("page_size", "50");
    return p.toString();
  }, [debouncedSearch, filter]);

  const loadSegments = useCallback(async () => {
    setLoadingSegments(true);
    try {
      const res = await fetch("/api/admin/users-v2/segments");
      if (res.ok) setSegments(await res.json());
    } catch { /* ignore */ }
    setLoadingSegments(false);
  }, []);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users-v2/list?${queryString}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load users.");
        setList(null);
      } else {
        setList(data);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoadingList(false);
    }
  }, [queryString]);

  useEffect(() => { void loadSegments(); }, [loadSegments]);
  useEffect(() => { void loadList(); }, [loadList]);

  const updateFilter = useCallback((patch: Partial<FilterShape>) => {
    setFilter((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilter(DEFAULT_FILTER);
    setSelectedUser(null);
  }, []);

  const handleAction = useCallback(async (userId: number, action: string, extra: Record<string, unknown> = {}) => {
    setActionMsg(null);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action, ...extra }),
    });
    const body = await res.json();
    if (!res.ok) {
      setActionMsg({ type: "err", text: body.error ?? "Action failed." });
      return;
    }
    setActionMsg({ type: "ok", text: body.message ?? "Done." });
    void loadList();
    void loadSegments();
    if (selectedUser?.id === userId) {
      const refreshed = await fetch(`/api/admin/users-v2/list?search=${selectedUser.email}`);
      if (refreshed.ok) {
        const data: ListResponse = await refreshed.json();
        const updated = data.users.find((u) => u.id === userId);
        if (updated) setSelectedUser(updated);
      }
    }
  }, [loadList, loadSegments, selectedUser]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (filter.status) chips.push({ label: `Status: ${filter.status}`, onRemove: () => updateFilter({ status: "" }) });
    if (filter.tier) chips.push({ label: `Tier: ${tierLabel(filter.tier)}`, onRemove: () => updateFilter({ tier: "" }) });
    if (filter.country) chips.push({ label: `Country: ${getCountryName(filter.country)}`, onRemove: () => updateFilter({ country: "" }) });
    if (filter.institution_type) chips.push({ label: `Type: ${getInstitutionTypeName(filter.institution_type)}`, onRemove: () => updateFilter({ institution_type: "" }) });
    if (filter.institutional_account_id != null) {
      const org = segments?.top_institutional_accounts.find((o) => o.id === filter.institutional_account_id);
      chips.push({ label: `Org: ${org?.institution_name ?? `#${filter.institutional_account_id}`}`, onRemove: () => updateFilter({ institutional_account_id: null }) });
    }
    if (filter.mfa_off) chips.push({ label: "MFA off", onRemove: () => updateFilter({ mfa_off: false }) });
    if (filter.locked) chips.push({ label: "Locked", onRemove: () => updateFilter({ locked: false }) });
    if (filter.inactive_days != null) chips.push({ label: `Inactive >${filter.inactive_days}d`, onRemove: () => updateFilter({ inactive_days: null }) });
    return chips;
  }, [filter, segments, updateFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>User Management</h1>
      <p className="text-sm text-gray-500 mb-4">Search, segment, and act on user accounts.</p>

      <DashboardWidgets segments={segments} loading={loadingSegments} />

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 mt-6">
        <Sidebar
          segments={segments}
          filter={filter}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
        />

        <div className="min-w-0">
          <div className="bg-white border border-gray-200 rounded p-3 mb-3">
            <input
              type="search"
              placeholder="Search name, email, username, institution…"
              value={filter.search}
              onChange={(e) => updateFilter({ search: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
            />
            {activeFilterChips.length > 0 && (
              <div className="mt-2 flex gap-1.5 flex-wrap items-center">
                <span className="text-xs text-gray-500">Active filters:</span>
                {activeFilterChips.map((chip, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={chip.onRemove}
                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded hover:bg-blue-100"
                  >
                    {chip.label} ×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {actionMsg && (
            <div className={`mb-3 px-3 py-2 text-xs rounded ${actionMsg.type === "ok" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {actionMsg.text}
            </div>
          )}

          <UserTable
            list={list}
            loading={loadingList}
            error={error}
            sort={filter.sort}
            onSortChange={(sort) => updateFilter({ sort })}
            onSelect={setSelectedUser}
            selectedId={selectedUser?.id ?? null}
            onAction={handleAction}
          />

          {list && list.total_pages > 1 && (
            <Pagination
              page={list.page}
              totalPages={list.total_pages}
              total={list.total}
              onChange={(page) => setFilter((f) => ({ ...f, page }))}
            />
          )}
        </div>
      </div>

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onAction={handleAction}
        />
      )}
    </div>
  );
}

// ─── Dashboard widgets ──────────────────────────────────────────────

function DashboardWidgets({ segments, loading }: { segments: SegmentCounts | null; loading: boolean }) {
  if (loading || !segments) {
    return <div className="text-sm text-gray-400">Loading widgets…</div>;
  }
  const topCountry = segments.by_country[0];
  const topOrg = segments.top_institutional_accounts.find((o) => o.count > 0);
  const tierMix = segments.by_tier;
  const tierTotal = tierMix.reduce((s, t) => s + t.count, 0) || 1;
  const freePct = Math.round(((tierMix.find((t) => t.key === "free")?.count ?? 0) / tierTotal) * 100);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Widget label="Total users" primary={segments.total.toLocaleString()} secondary={`+${segments.growth.new_7d.toLocaleString()} this week`} />
      <Widget label="New today" primary={segments.growth.new_24h.toLocaleString()} secondary={`${segments.growth.new_30d.toLocaleString()} in 30d`} />
      <Widget
        label="Tier mix"
        primary={`${freePct}% free`}
        secondary={tierMix.filter((t) => t.key !== "free").map((t) => `${t.count} ${tierLabel(t.key)}`).join(" · ") || "no paid yet"}
      />
      <Widget
        label="Top country"
        primary={topCountry ? getCountryName(topCountry.key) : "—"}
        secondary={topCountry ? `${topCountry.count} user${topCountry.count === 1 ? "" : "s"}` : "no data yet"}
      />
      <Widget
        label="Top organization"
        primary={topOrg ? topOrg.institution_name : "—"}
        secondary={topOrg ? `${topOrg.count} member${topOrg.count === 1 ? "" : "s"}` : "no orgs yet"}
      />
    </div>
  );
}

function Widget({ label, primary, secondary }: { label: string; primary: string; secondary: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5 truncate" style={{ color: "#1e4d8c" }}>{primary}</div>
      <div className="text-[11px] text-gray-500 mt-0.5 truncate">{secondary}</div>
    </div>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────

function Sidebar({
  segments, filter, updateFilter, clearFilters,
}: {
  segments: SegmentCounts | null;
  filter: FilterShape;
  updateFilter: (patch: Partial<FilterShape>) => void;
  clearFilters: () => void;
}) {
  return (
    <aside className="space-y-3 text-sm">
      <div className="bg-white border border-gray-200 rounded">
        <button
          type="button"
          onClick={clearFilters}
          className={`w-full px-3 py-2 text-left text-xs font-semibold ${!hasActiveFilter(filter) ? "bg-blue-50 text-blue-800" : "text-gray-600 hover:bg-gray-50"}`}
        >
          All users {segments && <span className="text-gray-400 float-right">{segments.total}</span>}
        </button>
      </div>

      <SidebarGroup
        title="By tier"
        items={segments?.by_tier.map((t) => ({ key: t.key, label: tierLabel(t.key), count: t.count })) ?? []}
        activeKey={filter.tier}
        onSelect={(key) => updateFilter({ tier: filter.tier === key ? "" : key })}
      />

      <SidebarGroup
        title="By status"
        items={segments?.by_status.map((s) => ({ key: s.key, label: s.key, count: s.count })) ?? []}
        activeKey={filter.status}
        onSelect={(key) => updateFilter({ status: filter.status === key ? "" : key })}
      />

      <SidebarGroup
        title="Top countries"
        items={(segments?.by_country ?? []).slice(0, 10).map((c) => ({ key: c.key, label: getCountryName(c.key), count: c.count }))}
        activeKey={filter.country}
        onSelect={(key) => updateFilter({ country: filter.country === key ? "" : key })}
      />

      <SidebarGroup
        title="Institution type"
        items={(segments?.by_institution_type ?? []).map((t) => ({ key: t.key, label: getInstitutionTypeName(t.key), count: t.count }))}
        activeKey={filter.institution_type}
        onSelect={(key) => updateFilter({ institution_type: filter.institution_type === key ? "" : key })}
      />

      {(segments?.top_institutional_accounts.filter((o) => o.count > 0).length ?? 0) > 0 && (
        <div className="bg-white border border-gray-200 rounded">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
            Top organizations
          </div>
          <div className="divide-y divide-gray-100">
            {segments!.top_institutional_accounts.filter((o) => o.count > 0).map((org) => {
              const active = filter.institutional_account_id === org.id;
              return (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => updateFilter({ institutional_account_id: active ? null : org.id })}
                  className={`w-full px-3 py-1.5 text-xs text-left flex justify-between items-center ${active ? "bg-blue-50 text-blue-800 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  <span className="truncate pr-2">{org.institution_name}</span>
                  <span className={active ? "text-blue-700" : "text-gray-400"}>{org.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded">
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">Health</div>
        <div className="divide-y divide-gray-100">
          <SidebarItem label="Inactive >90 days" count={segments?.health.inactive_90d ?? 0} active={filter.inactive_days === 90} onSelect={() => updateFilter({ inactive_days: filter.inactive_days === 90 ? null : 90 })} />
          <SidebarItem label="MFA off" count={segments?.health.mfa_off ?? 0} active={filter.mfa_off} onSelect={() => updateFilter({ mfa_off: !filter.mfa_off })} />
          <SidebarItem label="Locked" count={segments?.health.locked ?? 0} active={filter.locked} onSelect={() => updateFilter({ locked: !filter.locked })} />
          <SidebarItem label="Profile incomplete" count={segments?.health.profile_incomplete ?? 0} active={false} onSelect={() => {}} disabled />
        </div>
      </div>
    </aside>
  );
}

function SidebarGroup({
  title, items, activeKey, onSelect,
}: {
  title: string;
  items: Array<{ key: string; label: string; count: number }>;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">{title}</div>
      <div className="divide-y divide-gray-100">
        {items.map((item) => {
          const active = activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`w-full px-3 py-1.5 text-xs text-left flex justify-between items-center ${active ? "bg-blue-50 text-blue-800 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
            >
              <span className="truncate pr-2">{item.label}</span>
              <span className={active ? "text-blue-700" : "text-gray-400"}>{item.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarItem({
  label, count, active, onSelect, disabled,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => { if (!disabled) onSelect(); }}
      disabled={disabled}
      className={`w-full px-3 py-1.5 text-xs text-left flex justify-between items-center ${active ? "bg-blue-50 text-blue-800 font-semibold" : disabled ? "text-gray-500 cursor-default" : "text-gray-700 hover:bg-gray-50"}`}
    >
      <span>{label}</span>
      <span className={active ? "text-blue-700" : "text-gray-400"}>{count}</span>
    </button>
  );
}

function hasActiveFilter(f: FilterShape): boolean {
  return Boolean(f.search || f.status || f.tier || f.country || f.institution_type || f.institutional_account_id != null || f.mfa_off || f.locked || f.inactive_days != null);
}

// ─── Table ──────────────────────────────────────────────────────────

function UserTable({
  list, loading, error, sort, onSortChange, onSelect, selectedId, onAction,
}: {
  list: ListResponse | null;
  loading: boolean;
  error: string | null;
  sort: string;
  onSortChange: (sort: string) => void;
  onSelect: (user: UserRow) => void;
  selectedId: number | null;
  onAction: (userId: number, action: string, extra?: Record<string, unknown>) => void;
}) {
  if (loading && !list) return <div className="bg-white border border-gray-200 rounded p-8 text-center text-sm text-gray-500">Loading…</div>;
  if (error) return <div className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800">{error}</div>;
  if (!list || list.users.length === 0) {
    return <div className="bg-white border border-gray-200 rounded p-8 text-center text-sm text-gray-500">No users match these filters.</div>;
  }
  return (
    <div className="bg-white border border-gray-200 rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <ColumnHeader label="Name" sortKey="name_asc" currentSort={sort} onSort={onSortChange} />
              <ColumnHeader label="Email" sortKey="email_asc" currentSort={sort} onSort={onSortChange} />
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Tier</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Country</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Status</th>
              <ColumnHeader label="Last login" sortKey="last_login_desc" currentSort={sort} onSort={onSortChange} />
              <ColumnHeader label="Joined" sortKey="created_desc" currentSort={sort} onSort={onSortChange} />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.users.map((u) => (
              <UserRowComp
                key={u.id}
                user={u}
                selected={selectedId === u.id}
                onSelect={onSelect}
                onAction={onAction}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 text-[11px] text-gray-500 border-t border-gray-100 bg-gray-50">
        Showing {list.users.length} of {list.total.toLocaleString()} users
      </div>
    </div>
  );
}

function ColumnHeader({ label, sortKey, currentSort, onSort }: { label: string; sortKey: string; currentSort: string; onSort: (s: string) => void }) {
  const active = currentSort === sortKey;
  return (
    <th className="px-3 py-2 text-left font-semibold text-gray-500">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 ${active ? "text-blue-700" : "text-gray-500 hover:text-gray-700"}`}
      >
        {label}
        {active && <span>↓</span>}
      </button>
    </th>
  );
}

function UserRowComp({
  user, selected, onSelect, onAction,
}: {
  user: UserRow;
  selected: boolean;
  onSelect: (user: UserRow) => void;
  onAction: (userId: number, action: string, extra?: Record<string, unknown>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <tr
      className={`hover:bg-gray-50 cursor-pointer ${selected ? "bg-blue-50" : ""}`}
      onClick={() => onSelect(user)}
    >
      <td className="px-3 py-2">
        <div className="font-semibold text-gray-900">{user.full_name}</div>
        <div className="text-[10px] text-gray-500">@{user.username} · {user.credentials}</div>
      </td>
      <td className="px-3 py-2 text-gray-700">{user.email}</td>
      <td className="px-3 py-2"><TierBadge tier={user.subscription_tier} /></td>
      <td className="px-3 py-2 text-gray-700">{user.country_code ? getCountryName(user.country_code) : <span className="text-gray-400">—</span>}</td>
      <td className="px-3 py-2 text-gray-700 truncate" style={{ maxWidth: 140 }}>{user.institution_type ? getInstitutionTypeName(user.institution_type) : <span className="text-gray-400">—</span>}</td>
      <td className="px-3 py-2"><StatusBadge status={user.status} role={user.role} locked={Boolean(user.locked_until && new Date(user.locked_until) > new Date())} /></td>
      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDateShort(user.last_login)}</td>
      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDateShort(user.created_at)}</td>
      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="relative inline-block">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded"
            aria-label="Actions menu"
          >
            ⋯
          </button>
          {menuOpen && (
            <ActionMenu
              user={user}
              onClose={() => setMenuOpen(false)}
              onAction={onAction}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Action menu + drawer ───────────────────────────────────────────

function ActionMenu({
  user, onClose, onAction,
}: {
  user: UserRow;
  onClose: () => void;
  onAction: (userId: number, action: string, extra?: Record<string, unknown>) => void;
}) {
  const fire = (action: string, extra?: Record<string, unknown>) => {
    onAction(user.id, action, extra);
    onClose();
  };
  const isLocked = Boolean(user.locked_until && new Date(user.locked_until) > new Date());
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded shadow-lg min-w-[180px] py-1 text-xs">
        {user.status === "pending" && <ActionItem label="Approve" onClick={() => fire("approve")} />}
        {user.status === "active" && <ActionItem label="Disable" onClick={() => fire("disable")} />}
        {user.status === "disabled" && <ActionItem label="Reactivate" onClick={() => fire("reactivate")} />}
        {isLocked && <ActionItem label="Unlock account" onClick={() => fire("unlock")} />}
        <ActionItem label="Force password reset" onClick={() => fire("force_reset")} />
        <ActionItem label="Resend approval email" onClick={() => fire("resend_approval")} />
        <hr className="my-1 border-gray-100" />
        <ActionItem
          label={user.role === "admin" ? "Demote to pharmacist" : "Promote to superadmin"}
          onClick={() => {
            if (confirm(`${user.role === "admin" ? "Demote" : "Promote"} ${user.username}?`)) {
              fire("set_role", { role: user.role === "admin" ? "pharmacist" : "admin" });
            }
          }}
        />
        <ActionItem
          label="Change tier…"
          onClick={() => {
            const tier = prompt(`New tier for ${user.username}? (free, individual_pro, department, hospital)`, user.subscription_tier);
            if (tier) fire("set_tier", { tier });
          }}
        />
        <hr className="my-1 border-gray-100" />
        <ActionItem
          label="Delete user"
          danger
          onClick={() => {
            if (confirm(`Permanently delete ${user.username}? This cannot be undone.`)) {
              fire("delete");
            }
          }}
        />
      </div>
    </>
  );
}

function ActionItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full text-left px-3 py-1.5 hover:bg-gray-100 ${danger ? "text-red-700 hover:bg-red-50" : "text-gray-700"}`}
    >
      {label}
    </button>
  );
}

function UserDetailDrawer({
  user, onClose, onAction,
}: {
  user: UserRow;
  onClose: () => void;
  onAction: (userId: number, action: string, extra?: Record<string, unknown>) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={`User detail for ${user.full_name}`}
        className="fixed top-0 right-0 bottom-0 z-50 bg-white border-l border-gray-200 shadow-xl overflow-y-auto"
        style={{ width: 420 }}
      >
        <header className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#1e4d8c" }}>{user.full_name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">@{user.username} · {user.credentials}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 text-lg px-2"
          >
            ×
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <DetailSection title="Account">
            <DetailRow k="Email" v={user.email} />
            <DetailRow k="Status" v={<StatusBadge status={user.status} role={user.role} locked={Boolean(user.locked_until && new Date(user.locked_until) > new Date())} />} />
            <DetailRow k="System role" v={user.role} />
            <DetailRow k="Tier" v={<TierBadge tier={user.subscription_tier} />} />
            <DetailRow k="Joined" v={fmtDateLong(user.created_at)} />
            <DetailRow k="Approved" v={user.approved_at ? `${fmtDateLong(user.approved_at)} by ${user.approved_by ?? "?"}` : "—"} />
            <DetailRow k="Last login" v={fmtDateLong(user.last_login)} />
          </DetailSection>

          <DetailSection title="Profile">
            <DetailRow k="Institution" v={user.institution ?? "—"} />
            <DetailRow k="Country" v={user.country_code ? getCountryName(user.country_code) : "—"} />
            <DetailRow k="Institution type" v={user.institution_type ? getInstitutionTypeName(user.institution_type) : "—"} />
            <DetailRow k="Practice setting" v={user.practice_setting ? getPracticeSettingName(user.practice_setting) : "—"} />
            {user.institutional_account_id != null && (
              <DetailRow k="Member of org" v={`#${user.institutional_account_id} (${user.institutional_role})`} />
            )}
          </DetailSection>

          <DetailSection title="Security">
            <DetailRow k="MFA" v={user.mfa_enabled ? "Enabled" : "Disabled"} />
            <DetailRow k="Failed logins" v={String(user.failed_login_attempts ?? 0)} />
            {user.locked_until && (
              <DetailRow k="Locked until" v={fmtDateLong(user.locked_until)} />
            )}
          </DetailSection>

          <DetailSection title="Actions">
            <div className="grid grid-cols-2 gap-2">
              {user.status === "pending" && <DrawerActionBtn label="Approve" onClick={() => onAction(user.id, "approve")} />}
              {user.status === "active" && <DrawerActionBtn label="Disable" onClick={() => onAction(user.id, "disable")} />}
              {user.status === "disabled" && <DrawerActionBtn label="Reactivate" onClick={() => onAction(user.id, "reactivate")} />}
              {user.locked_until && new Date(user.locked_until) > new Date() && (
                <DrawerActionBtn label="Unlock" onClick={() => onAction(user.id, "unlock")} />
              )}
              <DrawerActionBtn label="Force PW reset" onClick={() => onAction(user.id, "force_reset")} />
              <DrawerActionBtn label="Resend approval" onClick={() => onAction(user.id, "resend_approval")} />
              <DrawerActionBtn
                label="Change tier"
                onClick={() => {
                  const tier = prompt(`New tier? (free, individual_pro, department, hospital)`, user.subscription_tier);
                  if (tier) onAction(user.id, "set_tier", { tier });
                }}
              />
              <DrawerActionBtn
                label={user.role === "admin" ? "Demote" : "Promote to admin"}
                onClick={() => {
                  if (confirm(`${user.role === "admin" ? "Demote" : "Promote"} ${user.username}?`)) {
                    onAction(user.id, "set_role", { role: user.role === "admin" ? "pharmacist" : "admin" });
                  }
                }}
              />
              <DrawerActionBtn
                label="Delete"
                danger
                onClick={() => {
                  if (confirm(`Permanently delete ${user.username}? This cannot be undone.`)) {
                    onAction(user.id, "delete");
                  }
                }}
              />
            </div>
          </DetailSection>
        </div>
      </aside>
    </>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{title}</h3>
      <div className="space-y-1 text-xs">{children}</div>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <div className="text-gray-500">{k}</div>
      <div className="text-gray-900 break-words">{v}</div>
    </div>
  );
}

function DrawerActionBtn({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-semibold rounded border ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────

function Pagination({
  page, totalPages, total, onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
      <span>Page {page} of {totalPages} · {total.toLocaleString()} total</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 border border-gray-200 rounded disabled:opacity-40 hover:bg-gray-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// ─── Badges + formatters ────────────────────────────────────────────

function StatusBadge({ status, role, locked }: { status: string; role: string; locked: boolean }) {
  if (locked) return <Badge color="red">Locked</Badge>;
  if (role === "admin") return <Badge color="purple">Superadmin</Badge>;
  if (status === "active") return <Badge color="green">Active</Badge>;
  if (status === "pending") return <Badge color="amber">Pending</Badge>;
  if (status === "disabled") return <Badge color="gray">Disabled</Badge>;
  return <Badge color="gray">{status}</Badge>;
}

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "gray",
    individual_pro: "blue",
    department: "indigo",
    hospital: "purple",
  };
  return <Badge color={colors[tier] ?? "gray"}>{tierLabel(tier)}</Badge>;
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const palettes: Record<string, { bg: string; fg: string; border: string }> = {
    green: { bg: "#ecfdf5", fg: "#047857", border: "#6ee7b7" },
    blue: { bg: "#eff6ff", fg: "#1e40af", border: "#bfdbfe" },
    indigo: { bg: "#eef2ff", fg: "#3730a3", border: "#c7d2fe" },
    purple: { bg: "#faf5ff", fg: "#6b21a8", border: "#d8b4fe" },
    amber: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    red: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    gray: { bg: "#f3f4f6", fg: "#4b5563", border: "#d1d5db" },
  };
  const p = palettes[color] ?? palettes.gray;
  return (
    <span
      className="inline-block px-2 py-0.5 text-[10px] font-semibold rounded"
      style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}
    >
      {children}
    </span>
  );
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "free": return "Free";
    case "individual_pro": return "Pro";
    case "department": return "Department";
    case "hospital": return "Hospital";
    default: return tier;
  }
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  try {
    const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
  } catch { return iso; }
}

function fmtDateLong(iso: string | null): string {
  if (!iso) return "—";
  try {
    const s = iso.includes("T") || iso.includes("Z") ? iso : iso.replace(" ", "T") + "Z";
    return new Date(s).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

"use client";

const policies = [
  { id: "POL-001", title: "Information Security Policy", owner: "CISO", effective: "2025-01-15", review: "2026-01-15", status: "Current" },
  { id: "POL-002", title: "Access Control Policy", owner: "IT Security", effective: "2025-01-15", review: "2026-01-15", status: "Current" },
  { id: "POL-003", title: "Change Management Policy", owner: "Engineering Lead", effective: "2025-03-01", review: "2026-03-01", status: "Current" },
  { id: "POL-004", title: "Incident Response Policy", owner: "CISO", effective: "2025-01-15", review: "2026-01-15", status: "Current" },
  { id: "POL-005", title: "Risk Assessment Policy", owner: "Compliance", effective: "2024-12-01", review: "2025-12-01", status: "Due for Review" },
  { id: "POL-006", title: "Data Protection & Privacy Policy", owner: "DPO", effective: "2024-06-01", review: "2025-06-01", status: "Overdue" },
];

const complianceChecklist = [
  { control: "Multi-Factor Authentication (MFA)", enabled: true },
  { control: "Account Lockout (5 attempts / 15 min)", enabled: true },
  { control: "Session Timeout (Admin: 60 min)", enabled: true },
  { control: "Security Audit Log", enabled: true },
  { control: "Vulnerability Scanning", enabled: false },
  { control: "Automated Backups", enabled: false },
  { control: "Uptime Monitoring", enabled: false },
];

function statusBadge(status: string) {
  switch (status) {
    case "Current":
      return "bg-green-100 text-green-800";
    case "Due for Review":
      return "bg-amber-100 text-amber-800";
    case "Overdue":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export default function PolicyPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "#1e4d8c" }}>Policy Management</h1>
      <p className="text-sm text-gray-500 mb-6">SOC 2 Type II policy library and compliance controls</p>

      {/* Policies table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>ID</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Policy Title</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Owner</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Effective Date</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Review Date</th>
                <th className="px-3 py-2 text-left font-semibold" style={{ color: "#1e4d8c" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-gray-700">{p.id}</td>
                  <td className="px-3 py-2 font-semibold text-gray-800">{p.title}</td>
                  <td className="px-3 py-2 text-gray-600">{p.owner}</td>
                  <td className="px-3 py-2 text-gray-500">{p.effective}</td>
                  <td className="px-3 py-2 text-gray-500">{p.review}</td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${statusBadge(p.status)}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Checklist */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Compliance Controls Checklist</h2>
        <div className="space-y-2">
          {complianceChecklist.map((item) => (
            <div key={item.control} className="flex items-center gap-3 text-sm">
              {item.enabled ? (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold">
                  &#x2713;
                </span>
              ) : (
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">
                  &#x2717;
                </span>
              )}
              <span className={item.enabled ? "text-gray-800" : "text-gray-500"}>{item.control}</span>
              {!item.enabled && (
                <span className="text-[10px] text-red-500 font-medium">NOT IMPLEMENTED</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

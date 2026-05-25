"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { label: "Overview", href: "/admin/dashboard", icon: "📊" },
  { label: "Users", href: "/admin/dashboard/users", icon: "👤" },
  { label: "Calculations", href: "/admin/dashboard/calculations", icon: "🧪" },
  { label: "Pilot Applications", href: "/admin/dashboard/pilot-applications", icon: "🏥" },
  { label: "BAA Queue", href: "/admin/dashboard/baa", icon: "📝" },
  { label: "Discounts", href: "/admin/dashboard/discounts", icon: "🎓" },
  { label: "Research", href: "/admin/dashboard/research", icon: "🔬" },
  { label: "Security", href: "/admin/dashboard/security", icon: "🔒" },
  { label: "Market Intel", href: "/admin/dashboard/market-intelligence", icon: "📡" },
  { label: "Policy", href: "/admin/dashboard/policy", icon: "📋" },
  { label: "System", href: "/admin/dashboard/system", icon: "⚙️" },
  { label: "Calculator", href: "/calculator", icon: "🧮" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const username = (session?.user as Record<string, unknown> | undefined)?.username as string | undefined;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname.startsWith(href);
  };

  const sidebar = (
    <>
      <div>
        <Link href="/calculator" className="block px-5 pt-6 pb-2 hover:opacity-80 transition-opacity">
          <span className="text-white font-bold text-lg tracking-tight">Vancomyzer</span>
          <span className="text-blue-200 text-xs ml-1">Admin</span>
        </Link>
        {username && (
          <div className="px-5 pb-4">
            <span className="text-white text-xs font-medium">{username}</span>
          </div>
        )}
        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-white/20 text-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="px-3 pb-5 flex flex-col gap-2">
        <Link href="/calculator" className="text-white hover:text-blue-100 text-xs font-medium px-3 py-1.5 transition-colors hover:bg-white/10 rounded">
          ← Back to Calculator
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-left text-white hover:text-blue-100 text-xs font-medium px-3 py-1.5 transition-colors hover:bg-white/10 rounded"
        >
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile header with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: "#1e4d8c" }}>
        <span className="text-white font-bold text-base tracking-tight">Vancomyzer Admin</span>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-1" aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {sidebarOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="3" y1="7" x2="21" y2="7" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="17" x2="21" y2="17" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 h-full w-[260px] flex flex-col justify-between"
            style={{ background: "#1e4d8c" }}
            onClick={e => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen flex-col justify-between"
        style={{ width: 220, background: "#1e4d8c" }}>
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 min-h-screen pt-14 md:pt-0 md:ml-[220px]">
        <div className="p-4 sm:p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

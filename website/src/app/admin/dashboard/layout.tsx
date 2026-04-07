"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navItems = [
  { label: "Overview", href: "/admin/dashboard", icon: "📊" },
  { label: "Users", href: "/admin/dashboard/users", icon: "👤" },
  { label: "Research", href: "/admin/dashboard/research", icon: "🔬" },
  { label: "Security", href: "/admin/dashboard/security", icon: "🔒" },
  { label: "Policy", href: "/admin/dashboard/policy", icon: "📋" },
  { label: "System", href: "/admin/dashboard/system", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const username = (session?.user as Record<string, unknown> | undefined)?.username as string | undefined;

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen flex flex-col justify-between"
        style={{ width: 220, background: "#1e4d8c" }}>
        <div>
          {/* Logo */}
          <div className="px-5 pt-6 pb-2">
            <span className="text-white font-bold text-lg tracking-tight">Vancomyzer</span>
            <span className="text-blue-200 text-xs ml-1">Admin</span>
          </div>
          {username && (
            <div className="px-5 pb-4">
              <span className="text-blue-200 text-xs">{username}</span>
            </div>
          )}

          {/* Nav */}
          <nav className="flex flex-col gap-0.5 px-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
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

        {/* Bottom */}
        <div className="px-3 pb-5 flex flex-col gap-2">
          <Link href="/" className="text-blue-200 hover:text-white text-xs px-3 py-1 transition-colors">
            Back to Calculator
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-left text-blue-200 hover:text-white text-xs px-3 py-1 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 min-h-screen" style={{ marginLeft: 220 }}>
        <div className="p-6 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team — Vancomyzer™",
  description: "Manage your team's Vancomyzer access.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

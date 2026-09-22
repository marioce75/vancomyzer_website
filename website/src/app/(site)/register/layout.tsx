import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account — Vancomyzer™",
  description: "Create a Vancomyzer account.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

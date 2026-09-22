import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compliance documentation — Vancomyzer™",
  description: "SOC 2 compliance documentation for Hospital Site subscribers.",
  alternates: { canonical: "https://vancomyzer.com/compliance" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Vancomyzer™",
  description: "Questions about the calculator, its evidence, or a site license.",
  alternates: { canonical: "https://vancomyzer.com/contact" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password — Vancomyzer™",
  description: "Request a password-reset link.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

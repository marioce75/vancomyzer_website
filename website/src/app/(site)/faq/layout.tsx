import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/faq" },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}

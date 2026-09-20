import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/contact" },
};

export default function PageLayout({ children }: { children: React.ReactNode }) {
  return children;
}

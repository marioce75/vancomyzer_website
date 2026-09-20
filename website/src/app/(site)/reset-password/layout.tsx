import type { Metadata } from "next";

// Account utility pages must be crawlable so search engines can read noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AccountPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}

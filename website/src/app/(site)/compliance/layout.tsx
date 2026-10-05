import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Compliance documentation — Vancomyzer™",
  description: "SOC 2 compliance documentation for Hospital Site subscribers.",
  alternates: { canonical: "https://vancomyzer.com/compliance" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}

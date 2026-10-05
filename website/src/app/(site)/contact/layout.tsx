import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Contact — Vancomyzer™",
  description: "Questions about the calculator, its evidence, or a site license.",
  alternates: { canonical: "https://vancomyzer.com/contact" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}

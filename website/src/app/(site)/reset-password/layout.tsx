import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";

const englishMetadata: Metadata = {
  title: "Reset password — Vancomyzer™",
  description: "Request a password-reset link.",
  robots: { index: false, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}

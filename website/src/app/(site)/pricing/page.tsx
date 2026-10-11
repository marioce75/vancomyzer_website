import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";
import PricingClient from "./PricingClient";

const englishMetadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/pricing" },
  title: "Free access — Vancomyzer™",
  description:
    "Access the Vancomyzer calculator and review its methods, scope and limitations.",
};

export default function PricingPage() {
  return <PricingClient />;
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}

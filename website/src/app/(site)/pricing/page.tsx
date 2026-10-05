import { localizeMetadata } from "@/localization/metadata";
import { requestLocale } from "@/localization/server";
import type { Metadata } from "next";
import PricingClient from "./PricingClient";

const englishMetadata: Metadata = {
  alternates: { canonical: "https://vancomyzer.com/pricing" },
  title: "Pricing — Vancomyzer™",
  description:
    "The core Vancomyzer calculator is free. Individual Pro and Hospital Site plans add account and site features; every plan uses the same calculation method.",
};

export default function PricingPage() {
  return <PricingClient />;
}

export async function generateMetadata() {
  return localizeMetadata(englishMetadata, await requestLocale());
}

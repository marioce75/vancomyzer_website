import type { Metadata } from "next";
import PricingClient from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Vancomyzer™",
  description:
    "Transparent pricing for transparent math. From individual pharmacists to health systems — Vancomyzer™ scales with your needs.",
};

export default function PricingPage() {
  return <PricingClient />;
}

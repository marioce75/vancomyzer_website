"use client";
import Link from "next/link";
import { LocalizedText } from "@/localization/LanguageProvider";

export default function PricingClient() {
  return <div className="mx-auto max-w-3xl px-4 py-16">
    <p className="text-sm font-semibold uppercase tracking-wide"><LocalizedText text="Free access" /></p>
    <h1 className="vz-serif mt-3 text-3xl"><LocalizedText text="Access to Vancomyzer is currently free." /></h1>
    <p className="mt-4 text-lg"><LocalizedText text="Access the Vancomyzer calculator and review its methods, scope and limitations." /></p>
    <Link href="/calculator" className="vz-mbtn vz-mbtn--primary mt-6"><LocalizedText text="Open the calculator" /></Link>
    <section className="mt-10 border-t pt-6">
      <h2 className="text-xl font-semibold"><LocalizedText text="Questions about access?" /></h2>
      <p className="mt-3"><LocalizedText text="Contact us about account access or institutional requirements." /></p>
      <p className="mt-3"><LocalizedText text="Institutional services, support and integrations require a separate review of requirements and availability." /></p>
      <p className="mt-3"><LocalizedText text="Saved history, institution details on exports and team administration depend on your account access. Contact us about availability." /></p>
      <Link href="/contact" className="mt-3 inline-block underline"><LocalizedText text="Contact" /></Link>
    </section>
    <p className="mt-8 text-sm"><LocalizedText text="Existing subscriptions and institutional agreements retain their agreed terms. Manage an existing subscription in Billing, or contact us about your agreement." /></p>
    <Link href="/settings/billing" className="mt-3 inline-block underline"><LocalizedText text="Billing" /></Link>
  </div>;
}

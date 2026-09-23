import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Vancomyzer™",
  description: "Subscriptions, permitted use, intellectual property and clinical responsibility.",
  alternates: { canonical: "https://vancomyzer.com/terms" },
};

import CanonicalDocCallout from "@/components/CanonicalDocCallout";
import { PageHeader, Record, INK, INK2 } from "@/components/site/Record";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function TermsPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader kicker="Legal" title="Terms of Use" compact lede={<span className="text-[15px]">Last updated: September 21, 2026</span>} />
      <Record label="Summary" note="The linked document on dosys.health governs." last>
      <CanonicalDocCallout docName="Terms of Use" href={LEGAL_LINKS.terms} />
      <div className="vz-prose mt-8 max-w-[70ch] space-y-8" style={{ color: INK2 }}>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Subscriptions, renewal and cancellation</h2>
          <p>Individual Pro is $49.99 per year, billed annually after a 14-day trial when you explicitly choose that subscription. It renews yearly until canceled. Verified discounts and their duration are shown at checkout. Free accounts and free pilots are never automatically converted to paid billing.</p>
          <p className="mt-3">Cancel online through Settings, then Billing, then Manage billing / cancel. Administrators of existing institutional subscriptions use Team, then Manage billing. Cancel before the trial ends to avoid a charge, or before the next renewal to stop that charge. Cancellation stops future renewal; access continues through the remaining paid period unless otherwise stated in your agreement.</p>
          <p className="mt-3">A confirmation email records your subscription and cancellation details. Renewal reminders include management links. We will provide required advance notice of accepted fee changes, including 7–30 days before a change takes effect where California law applies. The new public prices do not automatically change existing subscription agreements.</p>
          <p className="mt-3">Hospital Site licenses cost $990/year for up to 100 beds or $2,500/year for 101–400 beds, with unlimited individual users at one named site and no implementation fee. Annual or two-year agreements require site review and account setup before billing. Team administration, audit logs, multi-site arrangements and any BAA require separate written scope review; they are not automatically included in a site license. No plan currently includes EHR integration.</p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Acceptance of Terms</h2>
          <p>
            By accessing or using Vancomyzer™, you agree to be bound by these Terms of Use and the Medical Disclaimer. If you do not agree, do not use this tool.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Permitted Use</h2>
          <p>
            Vancomyzer™ is licensed to qualified healthcare professionals, and to institutions that subscribe on their behalf, for internal clinical, educational, and quality-improvement use. Subject to these Terms and payment of any applicable fees, you are granted a limited, non-exclusive, non-transferable, non-sublicensable license to access and use the tool for that purpose. Using it in the course of your practice or employment, including at a for-profit institution, is permitted.
          </p>
          <p className="mt-3">You may not:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm">
            <li>Resell, rent, sublicense, white-label, or otherwise make the tool available to anyone who is not an authorized user under your own subscription</li>
            <li>Operate the tool as a service bureau or application service provider, or offer dosing services to third parties as a standalone product built on it</li>
            <li>Modify, copy, reproduce, distribute, or create derivative works from this tool without prior written consent</li>
            <li>Remove or alter any copyright, trademark, or legal notices</li>
            <li>Reverse-engineer or attempt to extract proprietary algorithms or model parameters</li>
            <li>Access the tool in order to design or develop a competing product</li>
          </ul>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Intellectual Property</h2>
          <p>
            All content, design, algorithms, and code comprising Vancomyzer™ are the exclusive intellectual property of their respective owners. All rights reserved. The Vancomyzer™ name and logo are trademarks. Unauthorized use of any intellectual property associated with this tool is prohibited.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Clinical Responsibility</h2>
          <p>
            Users remain solely responsible for independent clinical review, institutional-policy alignment, and final treatment decisions. Do not rely on this tool as a substitute for professional judgment, local protocol, product labeling, or therapeutic drug monitoring.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Limitation of Liability</h2>
          <p className="uppercase font-semibold text-slate-800">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE DEVELOPERS OF VANCOMYZER SHALL NOT BE LIABLE FOR ANY DAMAGES OF ANY KIND ARISING FROM USE OF THIS TOOL. SEE THE FULL MEDICAL DISCLAIMER FOR COMPLETE LIABILITY LANGUAGE.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Modifications</h2>
          <p>
            We may update these terms. Subscription changes remain subject to applicable notice and consent requirements; continued free use does not authorize paid billing.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Governing Law</h2>
          <p>
            These terms are governed by the laws of the State of Texas, without regard to its conflict-of-law rules. Any dispute arising from these terms or from use of Vancomyzer™ shall be brought in the state or federal courts located in Hidalgo County, Texas, and you consent to the jurisdiction of those courts.
          </p>
        </section>

      </div>
      </Record>
    </div>
  );
}

import CanonicalDocCallout from "@/components/CanonicalDocCallout";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Terms of Use</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: September 18, 2026</p>

      <CanonicalDocCallout docName="Terms of Use" href={LEGAL_LINKS.terms} />

      <div className="mt-8 space-y-8 text-slate-700">

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Acceptance of Terms</h2>
          <p>
            By accessing or using Vancomyzer™, you agree to be bound by these Terms of Use and the Medical Disclaimer. If you do not agree, do not use this tool.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Permitted Use</h2>
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
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Intellectual Property</h2>
          <p>
            All content, design, algorithms, and code comprising Vancomyzer™ are the exclusive intellectual property of their respective owners. All rights reserved. The Vancomyzer™ name and logo are trademarks. Unauthorized use of any intellectual property associated with this tool is prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Clinical Responsibility</h2>
          <p>
            Users remain solely responsible for independent clinical review, institutional-policy alignment, and final treatment decisions. Do not rely on this tool as a substitute for professional judgment, local protocol, product labeling, or therapeutic drug monitoring.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Limitation of Liability</h2>
          <p className="uppercase font-semibold text-slate-800">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE DEVELOPERS OF VANCOMYZER SHALL NOT BE LIABLE FOR ANY DAMAGES OF ANY KIND ARISING FROM USE OF THIS TOOL. SEE THE FULL MEDICAL DISCLAIMER FOR COMPLETE LIABILITY LANGUAGE.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Modifications</h2>
          <p>
            These terms may be updated at any time without prior notice. Continued use of the tool after changes constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Governing Law</h2>
          <p>
            These terms shall be governed by and construed in accordance with applicable law. Any disputes shall be resolved in the jurisdiction where the developers are located.
          </p>
        </section>

      </div>
    </div>
  );
}

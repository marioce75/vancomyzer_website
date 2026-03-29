export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Terms of Use</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: March 2026</p>

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
            Vancomyzer™ is provided for evaluation, educational use, and clinical decision-support review by qualified healthcare professionals. You are granted a limited, non-exclusive, non-transferable license to use this tool for lawful, non-commercial purposes only.
          </p>
          <p className="mt-3">You may not:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-sm">
            <li>Modify, copy, reproduce, distribute, or create derivative works from this tool without prior written consent</li>
            <li>Use this tool for commercial purposes or to provide paid dosing services</li>
            <li>Remove or alter any copyright, trademark, or legal notices</li>
            <li>Reverse-engineer or attempt to extract proprietary algorithms</li>
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

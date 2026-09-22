import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medical Disclaimer — Vancomyzer™",
  description: "Who Vancomyzer is for, what it is not, and its regulatory status.",
  alternates: { canonical: "https://vancomyzer.com/disclaimer" },
};

import CanonicalDocCallout from "@/components/CanonicalDocCallout";
import { PageHeader, Record, INK, INK2 } from "@/components/site/Record";
import { LEGAL_LINKS } from "@/lib/legalLinks";

export default function DisclaimerPage() {
  return (
    <div style={{ color: INK }}>
      <PageHeader kicker="Legal" title="Medical Disclaimer" compact lede={<span className="text-[15px]">Last updated: September 21, 2026</span>} />
      <Record label="Summary" note="The linked document on dosys.health governs." last>
      <CanonicalDocCallout docName="Medical Disclaimer" href={LEGAL_LINKS.disclaimer} />
      <div className="vz-prose mt-8 max-w-[70ch] space-y-8" style={{ color: INK2 }}>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>For Healthcare Professionals Only</h2>
          <p>
            Vancomyzer™ is intended solely for use by qualified healthcare professionals, including licensed physicians, pharmacists, and other clinicians with appropriate training in vancomycin pharmacokinetics and therapeutic drug monitoring. This tool is <strong>not intended for use by patients, caregivers, or non-clinical personnel</strong>. If you are not a healthcare professional, do not use this tool — consult your physician or pharmacist for medication guidance.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Not Medical Advice</h2>
          <p>
            Vancomyzer™ provides clinical decision-support information for clinician review only. Nothing on this site constitutes medical advice, a prescription, a diagnosis, or a treatment recommendation. All dosing outputs are model-based review aids generated from pharmacokinetic calculations. They must be independently reviewed and validated by a licensed clinician before any clinical application. The clinician retains full responsibility for all dosing and patient care decisions.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Scope of Use</h2>
          <p>
            The calculator is scoped to <strong>adult intermittent-infusion vancomycin</strong> as described on this site. Vancomyzer™ has not yet been validated in real patients. Its equations are checked against published values and synthetic test cases; external validation with patient data is planned. It is not designed for pediatric patients, patients receiving dialysis or other renal replacement therapy, continuous-infusion vancomycin, or conditions outside the stated assumptions. Outputs should not be used in clinical situations outside this explicit scope without independent clinical assessment.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Regulatory Status</h2>
          <p>
            Vancomyzer™ is designed to meet the criteria for non-device clinical decision support in section 520(o)(1)(E) of the Federal Food, Drug, and Cosmetic Act (added by section 3060 of the 21st Century Cures Act). It has <strong>not been cleared, approved or otherwise reviewed by the FDA</strong>. It is intended for licensed healthcare professionals, who must independently review the basis for each recommendation.
          </p>
          <p className="mt-3">
            It has not been evaluated in prospective clinical outcome studies, and no claim is made that its use improves patient outcomes relative to other dosing methods.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>PROVIDED &ldquo;AS IS&rdquo; &mdash; NO WARRANTIES</h2>
          <p className="uppercase font-semibold text-slate-800">
            THIS TOOL IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF ACCURACY, FITNESS FOR A PARTICULAR PURPOSE, COMPLETENESS, OR TIMELINESS. THE DEVELOPERS MAKE NO REPRESENTATION THAT THE TOOL OR ITS OUTPUTS ARE FREE FROM ERROR. ANY USE OF OR RELIANCE ON THIS TOOL SHALL BE AT YOUR SOLE RISK.
          </p>
          <p className="mt-3">
            The developers have no obligation to update the tool, correct errors, or advise users of changes. Information may become outdated as clinical guidelines evolve.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>Limitation of Liability</h2>
          <p className="uppercase font-semibold text-slate-800">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VANCOMYZER, ITS DEVELOPERS, CONTRIBUTORS, OR ANY AFFILIATED PARTIES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THIS TOOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p className="mt-3">
            This includes but is not limited to any damages resulting from reliance on tool outputs, errors in pharmacokinetic calculations, or clinical decisions made based on tool recommendations.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>User Indemnification</h2>
          <p>
            By using Vancomyzer™, you agree to defend, indemnify, and hold harmless the developers and contributors from and against any and all claims, damages, obligations, losses, liabilities, costs, or expenses arising from: (a) your use of the tool; (b) your violation of these terms; or (c) any clinical decision made in reliance on tool outputs.
          </p>
        </section>

        <section>
          <h2 className="vz-serif mb-2 text-[22px]" style={{ color: INK }}>No Guarantee of Availability</h2>
          <p>
            This tool may be modified, suspended, or discontinued at any time without notice. The developers assume no liability for interruption of service or loss of access.
          </p>
        </section>

      </div>
      </Record>
    </div>
  );
}

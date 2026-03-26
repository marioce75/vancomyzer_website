export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Medical Disclaimer</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: March 2026</p>

      <div className="mt-8 space-y-8 text-slate-700">

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">For Healthcare Professionals Only</h2>
          <p>
            Vancomyzer™<sup>™</sup> is intended solely for use by qualified healthcare professionals, including licensed physicians, pharmacists, and other clinicians with appropriate training in vancomycin pharmacokinetics and therapeutic drug monitoring. This tool is <strong>not intended for use by patients, caregivers, or non-clinical personnel</strong>. If you are not a healthcare professional, do not use this tool — consult your physician or pharmacist for medication guidance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Not Medical Advice</h2>
          <p>
            Vancomyzer™ provides clinical decision-support information for clinician review only. Nothing on this site constitutes medical advice, a prescription, a diagnosis, or a treatment recommendation. All dosing outputs are model-based review aids generated from pharmacokinetic calculations. They must be independently reviewed and validated by a licensed clinician before any clinical application. The clinician retains full responsibility for all dosing and patient care decisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Scope of Use</h2>
          <p>
            The calculator is scoped to <strong>adult intermittent-infusion vancomycin</strong> as described on this site. It is not validated for pediatric use, continuous infusion, or conditions outside the stated assumptions. Outputs should not be used in clinical situations outside this explicit scope without independent clinical assessment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Non-Device Clinical Decision Support</h2>
          <p>
            Vancomyzer™ is classified as non-device clinical decision support software consistent with FDA CDS guidance. It is <strong>not FDA-cleared or FDA-approved as a medical device</strong>. It has not been clinically validated in prospective outcomes studies, and no claim is made that its use improves patient outcomes relative to other dosing methods.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">PROVIDED &ldquo;AS IS&rdquo; &mdash; NO WARRANTIES</h2>
          <p className="uppercase font-semibold text-slate-800">
            THIS TOOL IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF ACCURACY, FITNESS FOR A PARTICULAR PURPOSE, COMPLETENESS, OR TIMELINESS. THE DEVELOPERS MAKE NO REPRESENTATION THAT THE TOOL OR ITS OUTPUTS ARE FREE FROM ERROR. ANY USE OF OR RELIANCE ON THIS TOOL SHALL BE AT YOUR SOLE RISK.
          </p>
          <p className="mt-3">
            The developers have no obligation to update the tool, correct errors, or advise users of changes. Information may become outdated as clinical guidelines evolve.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Limitation of Liability</h2>
          <p className="uppercase font-semibold text-slate-800">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL VANCOMYZER, ITS DEVELOPERS, CONTRIBUTORS, OR ANY AFFILIATED PARTIES BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THIS TOOL, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p className="mt-3">
            This includes but is not limited to any damages resulting from reliance on tool outputs, errors in pharmacokinetic calculations, or clinical decisions made based on tool recommendations.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">User Indemnification</h2>
          <p>
            By using Vancomyzer™, you agree to defend, indemnify, and hold harmless the developers and contributors from and against any and all claims, damages, obligations, losses, liabilities, costs, or expenses arising from: (a) your use of the tool; (b) your violation of these terms; or (c) any clinical decision made in reliance on tool outputs.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">No Guarantee of Availability</h2>
          <p>
            This tool may be modified, suspended, or discontinued at any time without notice. The developers assume no liability for interruption of service or loss of access.
          </p>
        </section>

      </div>
    </div>
  );
}

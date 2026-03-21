export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Medical Disclaimer</h1>
      <div className="mt-6 space-y-4 text-gray-600">
        <p>
          Vancomyzer provides educational and clinical decision-support information for clinician review.
          It does not replace professional judgment, institutional policy, pharmacist or physician review,
          or patient-specific clinical assessment.
        </p>
        <p>
          The current calculator workflow is scoped to adult intermittent-infusion vancomycin use as described
          on the site. It is not presented here as clinically validated, FDA-cleared, outcome-improving, or
          superior to other dosing tools.
        </p>
        <p>
          Outputs are model-based review aids. Draft summaries and note-style text should be reviewed and edited
          before any use in clinical communication or the medical record.
        </p>
      </div>
    </div>
  );
}

export default function Disclaimer() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Disclaimer</h1>
      <div className="space-y-3 text-sm">
        <p>
          This tool provides educational clinical decision support only. It is not medical advice and does not replace
          clinician judgment, local protocols, or pharmacy/infectious diseases consultation.
        </p>
        <p>
          The software is provided “as is,” without warranties of any kind. You assume all risk for use of the outputs,
          including clinical decisions and patient outcomes.
        </p>
        <p>
          Do not enter PHI. Always verify doses, timing, and level interpretation against institutional guidelines and
          patient-specific factors (renal function changes, weight, critical illness, and drug interactions).
        </p>
        <p>
          Bayesian estimates rely on accurate dosing history and level timing; incorrect inputs will produce misleading
          results.
        </p>
      </div>
    </div>
  );
}

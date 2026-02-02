export default function References() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">References</h1>
      <div className="space-y-3 text-sm">
        <h2 className="font-medium">Targets and rationale</h2>
        <ul className="list-disc ml-5">
          <li>AUC/MIC (mg·h/L) target 400–600 for serious MRSA to balance efficacy and nephrotoxicity.</li>
          <li>Trough alone is imperfect; AUC-guided dosing is recommended.</li>
        </ul>
        <h2 className="font-medium">Educational background</h2>
        <ul className="list-disc ml-5">
          <li>
            <a className="underline" href="/bayesian-pk-education.pdf" target="_blank" rel="noreferrer">
              Bayesian PK simulation primer (PDF)
            </a>
          </li>
        </ul>
        <h2 className="font-medium">Monitoring strategy and timing</h2>
        <ul className="list-disc ml-5">
          <li>Obtain levels at steady state or after dose changes; use Bayesian when feasible.</li>
          <li>Recheck levels after 3–4 doses; monitor Scr daily in ICU.</li>
        </ul>
        <h2 className="font-medium">Nephrotoxicity risk</h2>
        <ul className="list-disc ml-5">
          <li>Risk increases with AUC &gt; 600; avoid AUC &gt; 800 when possible.</li>
        </ul>
        <h2 className="font-medium">Special populations</h2>
        <ul className="list-disc ml-5">
          <li>Consider obesity, renal dysfunction, and critical illness when selecting dose.</li>
        </ul>
        <h2 className="font-medium">Citations</h2>
        <ul className="list-disc ml-5">
          <li>IDSA/ASHP vancomycin monitoring guideline (placeholder citation).</li>
          <li>Institutional protocols and consensus statements (local).</li>
        </ul>
        <div className="text-xs text-muted-foreground">Not affiliated with IDSA/ASHP.</div>
      </div>
    </div>
  );
}

export default function Disclaimer() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Disclaimer</h1>
      <div className="space-y-3 text-sm">
        <p>Not medical advice. For licensed professionals. No warranty. Patient-specific factors may not be fully captured.</p>
        <p>Use institutional protocols to confirm dosing decisions. This tool does not replace clinical judgment.</p>
        <p>Bayesian estimates depend on accurate level timing and dosing history; inaccuracies will affect results.</p>
      </div>
    </div>
  );
}

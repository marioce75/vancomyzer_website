export default function CalculatorHeader() {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        Vancomyzer Calculator
      </h1>
      <p className="mt-2 text-gray-600">
        Enter patient and regimen details and vancomycin levels to view
        interpretable PK results. Outputs are intended to support review, not
        replace clinician judgment.
      </p>
      <p className="mt-3 text-sm text-gray-500">
        Assumptions and limitations are shown with the results. Review them
        before applying any recommendation.
      </p>
    </header>
  );
}

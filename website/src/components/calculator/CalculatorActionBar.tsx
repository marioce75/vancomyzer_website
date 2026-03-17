"use client";

interface CalculatorActionBarProps {
  onCalculate: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function CalculatorActionBar({
  onCalculate,
  onReset,
  disabled,
}: CalculatorActionBarProps) {
  return (
    <section className="mt-6 flex flex-wrap gap-4">
      <button
        type="button"
        onClick={onCalculate}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        Calculate
      </button>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Reset
      </button>
    </section>
  );
}

"use client";

import { ReactNode } from "react";

interface CalculatorResultStateProps {
  hasResult: boolean;
  children: ReactNode;
}

export default function CalculatorResultState({
  hasResult,
  children,
}: CalculatorResultStateProps) {
  if (!hasResult) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-8">
        <p className="text-gray-500">
          Enter inputs and click Calculate to see results.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

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
    return <>{children}</>;
  }

  return <>{children}</>;
}

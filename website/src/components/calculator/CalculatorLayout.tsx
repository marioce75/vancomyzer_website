import { ReactNode } from "react";

interface CalculatorLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export default function CalculatorLayout({ left, right }: CalculatorLayoutProps) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="lg:min-w-0">{left}</div>
      <div className="lg:min-w-0">{right}</div>
    </div>
  );
}

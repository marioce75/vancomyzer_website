import { ReactNode } from "react";

interface CalculatorLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export default function CalculatorLayout({ left, right }: CalculatorLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden xl:flex-row">
      <div
        className="custom-scrollbar z-10 flex w-full shrink-0 flex-col overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:w-[400px] lg:w-[430px] xl:w-[470px] lg:px-5 lg:py-5 xl:h-full"
        style={{ borderRight: "1px solid var(--color-border)", background: "var(--color-card)" }}
      >
        {left}
      </div>
      <div className="custom-scrollbar h-full min-w-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="mx-auto flex h-full max-w-[1480px] flex-col">
          {right}
        </div>
      </div>
    </div>
  );
}

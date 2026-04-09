import { ReactNode } from "react";

interface CalculatorLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export default function CalculatorLayout({ left, right }: CalculatorLayoutProps) {
  return (
    <div className="flex w-full flex-col xl:flex-row xl:h-full xl:overflow-hidden">
      {/* Left panel: scrolls independently on desktop, flows naturally on mobile */}
      <div
        className="custom-scrollbar z-10 flex w-full shrink-0 flex-col xl:overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 md:w-[400px] lg:w-[430px] xl:w-[470px] lg:px-5 lg:py-5 xl:h-full"
        style={{ borderRight: "1px solid var(--color-border)", background: "var(--color-card)" }}
      >
        {left}
      </div>
      {/* Right panel: scrolls independently on desktop, flows naturally on mobile */}
      <div className="custom-scrollbar min-w-0 flex-1 xl:overflow-y-auto xl:h-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
        <div className="mx-auto flex max-w-[1480px] flex-col">
          {right}
        </div>
      </div>
    </div>
  );
}

import { ReactNode } from "react";

interface CalculatorLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

export default function CalculatorLayout({ left, right }: CalculatorLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden xl:flex-row">
      <div className="custom-scrollbar z-10 flex h-full w-full shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-5 py-5 shadow-[16px_0_36px_-28px_rgba(15,23,42,0.28)] md:w-[430px] lg:w-[470px] lg:px-6 lg:py-6">
        {left}
      </div>
      <div className="custom-scrollbar h-full min-w-0 flex-1 overflow-y-auto px-5 py-5 lg:px-8 lg:py-8">
        <div className="mx-auto flex h-full max-w-[1480px] flex-col">
          {right}
        </div>
      </div>
    </div>
  );
}

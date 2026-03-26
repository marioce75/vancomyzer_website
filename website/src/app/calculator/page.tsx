import { Suspense } from "react";
import CalculatorWorkspace from "@/components/calculator/CalculatorWorkspace";

export default function CalculatorPage() {
  return (
    <Suspense fallback={null}>
      <CalculatorWorkspace />
    </Suspense>
  );
}

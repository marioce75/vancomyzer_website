import { Suspense } from "react";
import CalculatorWorkspace from "@/components/calculator/CalculatorWorkspace";
import DisclaimerGate from "@/components/calculator/DisclaimerGate";

export default function CalculatorPage() {
  return (
    <Suspense fallback={null}>
      {/* The calculator is not mounted until the disclaimer has been accepted. */}
      <DisclaimerGate>
        <CalculatorWorkspace />
      </DisclaimerGate>
    </Suspense>
  );
}

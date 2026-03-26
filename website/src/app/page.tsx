import { Suspense } from "react";
import CalculatorWorkspace from "@/components/calculator/CalculatorWorkspace";

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CalculatorWorkspace />
    </Suspense>
  );
}

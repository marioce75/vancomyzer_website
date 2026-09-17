import { ReactNode } from "react";

interface CalculatorLayoutProps {
  left: ReactNode;
  right: ReactNode;
}

/**
 * Calculator shell.
 *  - <1024px: one scrolling column — Patient → Recommendation → Graph → Alternatives → Details.
 *  - ≥1024px: CSS grid, input rail (var(--vz-rail-w)) + workspace, each scrolling
 *    independently inside the viewport-locked app frame (see .vz-shell in globals.css).
 */
export default function CalculatorLayout({ left, right }: CalculatorLayoutProps) {
  return (
    <div className="vz-shell">
      <div
        className="vz-rail custom-scrollbar"
        style={{ borderRight: "1px solid var(--color-border)", background: "var(--color-card)" }}
      >
        {left}
      </div>
      <div className="vz-workspace custom-scrollbar">
        {right}
      </div>
    </div>
  );
}

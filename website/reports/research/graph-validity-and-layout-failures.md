# Vancomycin UI Graph & Layout Failures Research

## 1. What is wrong with the current graph behavior
- The `LivePreviewGraph` component generates a pharmacokinetically implausible, single-dose curve for intermittent IV vancomycin. 
- It fakes the preview by linearly ramping to an arbitrary peak during the infusion, then exponentially decaying to zero over 48 hours without any repeated dosing logic, accumulation, or steady-state behavior.
- In actual intermittent IV dosing, vancomycin is given at regular intervals (e.g., q12h, q24h). At steady state, the trough does not return to zero; it returns to a therapeutic minimum (e.g., 10-20 mcg/mL).
- `LivePreviewGraph` incorrectly highlights the 10-20 mcg/mL range, conflicting with the AUC24 400-600 goal stated throughout the app.
- `ConcentrationTimeGraph` uses an area band of `y1={400/24}` to `y2={600/24}` (16.6 to 25 mcg/mL) as an AUC average proxy, which is reasonable visually but could be refined. The most egregious error is the fake `LivePreviewGraph` generation logic.

## 2. What is wrong with the current expandable details behavior
- In `CalculatorWorkspace.tsx`, the `Secondary Details` section is wrapped in a `<details>` tag with flex children inside a heavily constrained grid column (`min-h-0`, `flex-1`).
- When the `<details>` panel expands, its height exceeds the remaining viewport space. Because the parent grid is rigidly clamped to prevent main-page scroll (using `h-screen`, `overflow-hidden`), expanding the panel causes overlapping and clipping of content without proper internal scrolling, breaking the enterprise UI constraint.

## 3. What a correct vancomycin PK display should show
- For an empiric preview/initial display, it should show a full 48-hour horizon where multiple doses accumulate (or at least one full steady-state interval repeating) according to the input `interval_hours`.
- At steady state, the curve should start at $C_{min}$ (trough), linearly rise over `infusion_duration_hours` to $C_{max}$ (peak), and exponentially decay back to $C_{min}$ over the remainder of the interval.
- Target reference ranges should reflect either the average steady state concentration ($C_{ss,avg}$ = 16.7 - 25 mcg/mL for AUC 400-600) or simply avoid misleading trough targets if AUC is the primary clinical goal.

## 4. What layout behavior should replace the current overlapping details panel
- Instead of using a `<details>` panel that drops down inline and breaks the constrained flex layout, the right column should properly encapsulate scrolling.
- The wrapper for the `Secondary Details` (or the right column itself) needs `overflow-y-auto` enforced *below* the critical metrics and graph, allowing the details list to scroll cleanly within its own box without overlapping the graph or forcing the whole page to scroll.

## 5. Exact implementation recommendations
1. **Fix `LivePreviewGraph.tsx`**: Replace the fake single-dose calculation with a steady-state intermittent IV approximation. Calculate elimination rate constant ($k_e$) using the assumed elimination window, then use steady-state accumulation formulas to compute true peak and trough, and generate points that repeat every `interval` hours across the 48-hour horizon.
2. **Fix `CalculatorWorkspace.tsx` Layout**: Ensure the `rightColumn` has an internal flex layout where the details panel or the container itself uses `overflow-y-auto` appropriately. Remove nested `min-h-0` issues inside the right panel that clip the `<details>` dropdown, or convert the right column to a single scrollable container that still stops at the viewport height.

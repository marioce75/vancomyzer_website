import { describe, expect, it } from "vitest";
import { derivePeakTroughFromCurve } from "@/lib/pkCurve";

describe("derivePeakTroughFromCurve", () => {
  it("derives peak at infusion end and trough at interval end", () => {
    const curve = [
      { t_hr: 0, conc_mg_l: 0 },
      { t_hr: 1, conc_mg_l: 10 },
      { t_hr: 12, conc_mg_l: 2 },
      { t_hr: 13, conc_mg_l: 8 },
      { t_hr: 24, conc_mg_l: 3 },
    ];
    const regimen = { intervalHr: 12, infusionHr: 1 };
    const result = derivePeakTroughFromCurve(curve, regimen);

    expect(result.peakTime).toBeCloseTo(13, 6);
    expect(result.troughTime).toBeCloseTo(24, 5);
    expect(result.peak).toBeCloseTo(8, 2);
    expect(result.trough).toBeCloseTo(3, 2);
  });
});


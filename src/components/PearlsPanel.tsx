import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PEARLS: Array<{ title: string; body: string }> = [
  {
    title: "Target",
    body: "Most guidelines target AUC/MIC 400–600 (assuming MIC 1 mg/L) for serious MRSA infections. Avoid chasing troughs alone.",
  },
  {
    title: "Timing",
    body: "If drawing a single level, document infusion stop time. Early levels are sensitive to timing errors.",
  },
  {
    title: "Renal function",
    body: "Dose is often limited by kidney function. If Scr is changing, treat estimates as unstable and re-check levels sooner.",
  },
  {
    title: "Safety",
    body: "Higher AUC (>600) and concomitant nephrotoxins increase AKI risk. Use the lowest effective exposure.",
  },
];

export default function PearlsPanel() {
  const [index, setIndex] = useState(0);
  const pearl = useMemo(() => PEARLS[index % PEARLS.length], [index]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Pearls</CardTitle>
        <Button variant="secondary" size="sm" onClick={() => setIndex((i) => i + 1)}>
          Next pearl
        </Button>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="font-medium">{pearl.title}</div>
        <div className="mt-1 text-muted-foreground">{pearl.body}</div>
      </CardContent>
    </Card>
  );
}

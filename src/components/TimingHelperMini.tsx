import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TimingHelperMini() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Timing helper</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="space-y-2">
          <div>
            <div className="font-medium text-foreground">Trough</div>
            <div>Draw within 30 min before next dose (document scheduled time).</div>
          </div>
          <div>
            <div className="font-medium text-foreground">Post-infusion level</div>
            <div>Commonly 1–2 hours after infusion ends (document stop time).</div>
          </div>
          <div>
            <div className="font-medium text-foreground">If renal function changing</div>
            <div>Consider earlier re-check; interpret Bayesian estimates cautiously.</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

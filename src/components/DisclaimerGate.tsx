import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const KEY = "vancomyzer_disclaimer_ack";

export default function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const [ack, setAck] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(KEY);
    setAck(v === "true");
  }, []);

  function confirm() {
    localStorage.setItem(KEY, "true");
    setAck(true);
  }

  if (ack) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur">
      <div className="max-w-md w-full rounded-lg border bg-card p-6 shadow">
        <h2 className="text-lg font-semibold mb-2">Clinical decision support only</h2>
        <p className="text-sm text-muted-foreground mb-4">Verify with institutional protocols. For licensed professionals. No patient identifiers collected.</p>
        <div className="flex items-center gap-2 mb-4">
          <Checkbox id="ack" onCheckedChange={(v) => setAck(!!v)} />
          <label htmlFor="ack" className="text-sm">I understand this does not replace clinical judgment.</label>
        </div>
        <Button className="w-full" disabled={!ack} onClick={confirm}>Continue</Button>
      </div>
    </div>
  );
}

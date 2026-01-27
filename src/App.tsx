import React, { Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import DisclaimerGate from "@/components/DisclaimerGate";
import CalculatorForm from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import AucDoseSliderChart from "@/components/AucDoseSliderChart";
import ConcentrationTimeChart from "@/components/ConcentrationTimeChart";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { PkCalculateResponse } from "@/lib/api";

const ReferencesPageLazy = React.lazy(() => import("@/pages/References"));
const DisclaimerPageLazy = React.lazy(() => import("@/pages/Disclaimer"));
const AboutPageLazy = React.lazy(() => import("@/pages/About"));

// Simple internal router
function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const handler = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  return path;
}
function navigate(to: string) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function HomePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PkCalculateResponse | undefined>(undefined);
  const [trustDate] = useState<string>(new Date().toISOString().slice(0, 10));

  async function onAdjust(update: { dose?: number; interval?: number }) {
    if (!result) return;
    const updated = { ...result };
    if (update.dose !== undefined) updated.maintenanceDoseMg = update.dose;
    if (update.interval !== undefined) updated.intervalHr = update.interval;
    setResult(updated);
  }

  const targets = useMemo(() => ({ low: 400, high: 600 }), []);

  return (
    <DisclaimerGate>
      <div className="min-h-screen pb-24">
        <header className="px-4 py-3 border-b bg-background sticky top-0 z-30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Vancomyzer</span>
              <div className="text-xs text-muted-foreground hidden sm:block">Built for rounds</div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2 py-1 rounded bg-green-100 text-green-700">AUC-based</span>
              <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Guideline-aligned</span>
              <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">No PHI stored</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h1 className="text-xl font-semibold mb-3">Hit the AUC target—fast.</h1>
              <Alert className="border-warning bg-warning/10 text-warning-foreground mb-4">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <div className="text-xs">Clinical decision support only. Verify with institutional protocols.</div>
              </Alert>
              <CalculatorForm onResult={setResult} onLoadingChange={setLoading} />
            </div>
            <div>
              <ResultsPanel result={result} onAdjustDose={onAdjust} />
              {result && (
                <div className="mt-4 grid gap-4">
                  <AucDoseSliderChart
                    doseMg={Math.round(result.maintenanceDoseMg)}
                    intervalHr={result.intervalHr}
                    auc24={result.auc24}
                    targetLow={targets.low}
                    targetHigh={targets.high}
                    onChange={({ doseMg, intervalHr }) => onAdjust({ dose: doseMg, interval: intervalHr })}
                  />
                  <ConcentrationTimeChart curve={result.concentrationCurve} levels={undefined} showBand={false} />
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span>Safety + References</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="underline" onClick={() => navigate("/references")}>References</button>
              <button className="underline" onClick={() => navigate("/disclaimer")}>Disclaimer</button>
              <button className="underline" onClick={() => navigate("/about")}>About</button>
              <span className="text-muted-foreground">v1 • Updated {trustDate}</span>
            </div>
          </div>
        </footer>
      </div>
    </DisclaimerGate>
  );
}

function App() {
  const path = usePath();
  if (path === "/references") return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <ReferencesPageLazy />
    </Suspense>
  );
  if (path === "/disclaimer") return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <DisclaimerPageLazy />
    </Suspense>
  );
  if (path === "/about") return (
    <Suspense fallback={<div className="p-4">Loading…</div>}>
      <AboutPageLazy />
    </Suspense>
  );
  return <HomePage />;
}

export default App;

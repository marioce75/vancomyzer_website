import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import DisclaimerGate from "@/components/DisclaimerGate";
import CalculatorForm, { type CalculatorFormHandle } from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import ConcentrationTimeChart from "@/components/ConcentrationTimeChart";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import PearlsPanel from "@/components/PearlsPanel";
import TimingHelperMini from "@/components/TimingHelperMini";
import RoundsSummaryCard from "@/components/RoundsSummaryCard";
import { copyToClipboard, decodeShareState } from "@/lib/shareLink";
import { calculateEducational, type CalculateRequest, type CalculateResponse } from "@/lib/api";
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
  const [result, setResult] = useState<BasicCalculateResponse | BayesianCalculateResponse | CalculateResponse | undefined>(undefined);
  const [mode, setMode] = useState<"basic" | "bayesian" | "educational">("basic");
  const [bayesLevels, setBayesLevels] = useState<Array<{ time_hr: number; concentration_mg_l: number }>>([]);
  const [activeRegimen, setActiveRegimen] = useState<{ doseMg: number; intervalHr: number; infusionHr: number }>({
    doseMg: 1000,
    intervalHr: 12,
    infusionHr: 1.0,
  });
  const formRef = useRef<CalculatorFormHandle | null>(null);

  const [sharedRegimenText, setSharedRegimenText] = useState<string | null>(null);
  const [roundsMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("vancomyzer.roundsMode") === "1";
    } catch {
      return false;
    }
  });

  // If a share link was opened, show a tiny non-PHI summary banner.
  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/(?:^#|&)s=([^&]+)/);
    if (!m) return;
    const state = decodeShareState(m[1]);
    if (!state?.result) return;
    const text = `Opened shared regimen: ${Math.round(state.result.maintenanceDoseMg ?? 0)} mg q${state.result.intervalHr ?? 12}h (AUC24 ~ ${Math.round(state.result.auc24 ?? 0)}).`;
    setSharedRegimenText(text);
  }, []);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <DisclaimerGate>
      <div className="min-h-screen pb-24">
        <header className="px-4 py-4 border-b bg-sky-50 sticky top-0 z-30">
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <span className="font-semibold text-2xl sm:text-3xl tracking-tight">Vancomyzer®</span>
              <div className="text-xs text-muted-foreground mt-1">Educational PK estimates only — not medical advice.</div>
              <div className="text-sm font-medium mt-2 text-sky-900">Hit that AUC target—fast</div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4">
          {sharedRegimenText && (
            <Alert className="mb-4">
              <div className="text-xs">{sharedRegimenText}</div>
            </Alert>
          )}

          <Alert className="border-warning bg-warning/10 text-warning-foreground mb-4">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <div className="text-xs">Educational PK estimates only — not medical advice. Verify with institutional protocols. No PHI stored.</div>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <CalculatorForm
                ref={formRef}
                onResult={(res, nextMode) => {
                  setResult(res);
                  setMode(nextMode);
                  if (nextMode !== "bayesian") {
                    setBayesLevels([]);
                  }
                }}
                onInputsChange={(payload) => {
                  if (payload.mode === "bayesian" && payload.levels) {
                    setBayesLevels(payload.levels);
                  }
                  if (payload.regimen) {
                    setActiveRegimen(payload.regimen);
                  }
                }}
              />
            </div>
            <div>
              <ResultsPanel
                mode={mode}
                result={result}
                onAdjustDose={(delta) => formRef.current?.adjustDose(delta)}
                regimen={activeRegimen}
                onRegimenChange={(next) => {
                  setActiveRegimen(next);
                  formRef.current?.recompute(next);
                }}
              />

              {mode === "basic" && result && "curve" in result && result.curve && (
                <div className="mt-4 grid gap-4">
                  <ConcentrationTimeChart curve={result.curve} levels={[]} />
                </div>
              )}

              {mode === "bayesian" && result && "curve" in result && (
                <div className="mt-4 grid gap-4">
                  <ConcentrationTimeChart
                    curve={result.curve}
                    levels={bayesLevels}
                    band={{ lower: result.curve_ci_low, upper: result.curve_ci_high }}
                  />
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="max-w-6xl mx-auto p-3 grid grid-cols-3 items-center text-xs">
            <div className="flex items-center gap-2 justify-start">
              <AlertTriangle className="h-3 w-3 text-warning" />
              <span>Safety + References</span>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button className="underline" onClick={() => navigate("/references")}>References</button>
              <button className="underline" onClick={() => navigate("/disclaimer")}>Disclaimer</button>
              <button className="underline" onClick={() => navigate("/about")}>About</button>
            </div>
            <div className="text-muted-foreground text-right">© {currentYear} Vancomyzer®</div>
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

import React, { Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import DisclaimerGate from "@/components/DisclaimerGate";
import CalculatorForm from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import PearlsPanel from "@/components/PearlsPanel";
import TimingHelperMini from "@/components/TimingHelperMini";
import RoundsSummaryCard from "@/components/RoundsSummaryCard";
import { decodeShareState } from "@/lib/shareLink";
import { ApiError, calculateEducational, type CalculateRequest, type CalculateResponse } from "@/lib/api";

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
  const [result, setResult] = useState<PkCalculateResponse | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  const [inputs, setInputs] = useState<CalculateRequest | null>(null);
  const latestInputsRef = useRef<CalculateRequest | null>(null);

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

  // Debounced recompute when regimen changes
  const recomputeTimer = useRef<number | null>(null);

  function scheduleRecompute(next: CalculateRequest) {
    setInputs(next);
    latestInputsRef.current = next;
    setSimError(null);
    if (recomputeTimer.current) window.clearTimeout(recomputeTimer.current);
    recomputeTimer.current = window.setTimeout(async () => {
      setUpdating(true);
      try {
        const r = await calculateEducational(next);
        setResult(r);
      } catch (err) {
        if (err instanceof ApiError) {
          setSimError(err.detail || err.message);
        } else if (err instanceof Error) {
          setSimError(err.message);
        } else {
          setSimError("Simulation temporarily unavailable.");
        }
      } finally {
        setUpdating(false);
      }
    }, 300);
  }

  async function onAdjust(delta: { dose?: number; interval?: number }) {
    if (!inputs?.regimen) return;
    const next: CalculateRequest = {
      ...inputs,
      regimen: {
        ...inputs.regimen,
        doseMg: Math.min(3000, Math.max(250, inputs.regimen.doseMg + (delta.dose ?? 0))),
        intervalHr: Math.max(4, inputs.regimen.intervalHr + (delta.interval ?? 0)),
      },
    };
    scheduleRecompute(next);
  }

  const targets = useMemo(
    () => ({
      low: inputs?.aucTargetLow ?? 400,
      high: inputs?.aucTargetHigh ?? 600,
    }),
    [inputs?.aucTargetLow, inputs?.aucTargetHigh],
  );
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <DisclaimerGate>
      <div className="min-h-screen pb-24">
        <header className="px-4 py-4 border-b bg-sky-50 sticky top-0 z-30">
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <span className="font-semibold text-2xl sm:text-3xl tracking-tight text-sky-900">Vancomyzer®</span>
              <div className="text-xs text-muted-foreground mt-1">Aligned with current IDSA/ASHP vancomycin monitoring guidelines</div>
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
                onResult={(r) => {
                  setResult(r);
                  setSimError(null);
                  if (r && latestInputsRef.current) {
                    setInputs({
                      ...latestInputsRef.current,
                      regimen: {
                        doseMg: r.maintenanceDoseMg,
                        intervalHr: r.intervalHr,
                        infusionHours: 1,
                      },
                    });
                  }
                }}
                onInputsChange={(payload) => {
                  latestInputsRef.current = payload;
                  setInputs(payload);
                }}
              />
            </div>
            <div>
              <ResultsPanel result={result} onAdjustDose={onAdjust} updating={updating} />

              {result && inputs?.regimen && (
                <div className="mt-4 grid gap-4">
                  <AucDoseSliderChart
                    doseMg={Math.round(inputs.regimen.doseMg)}
                    intervalHr={Math.round(inputs.regimen.intervalHr)}
                    auc24={result.auc24}
                    targetLow={targets.low}
                    targetHigh={targets.high}
                    pending={updating}
                    onChange={({ doseMg, intervalHr }) =>
                      scheduleRecompute({
                        ...inputs,
                        regimen: {
                          ...inputs.regimen,
                          doseMg: doseMg ?? inputs.regimen.doseMg,
                          intervalHr: intervalHr ?? inputs.regimen.intervalHr,
                        },
                      })
                    }
                  />
                  <ConcentrationTimeChart
                    curve={result.concentrationCurve}
                    levels={inputs.levels?.map((l) => ({ timeHr: l.timeHoursFromDoseStart, concentration: l.concentration }))}
                    showBand={false}
                  />

                  {simError && (
                    <Alert className="border-warning bg-warning/10 text-warning-foreground">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <div className="flex flex-col gap-2 text-xs">
                        <div className="font-medium">Simulation temporarily unavailable.</div>
                        <div>{simError}</div>
                        <div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => latestInputsRef.current && scheduleRecompute(latestInputsRef.current)}
                          >
                            Retry simulation
                          </Button>
                        </div>
                      </div>
                    </Alert>
                  )}

            <TabsContent value="auc">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <CalculatorForm onResult={setResult} onLoadingChange={setUpdating} />
                </div>
                <div className="space-y-4">
                  {updating && (
                    <div className="text-xs text-muted-foreground">Updating…</div>
                  )}
                  <ResultsPanel result={result} />
                  {roundsMode && result && (
                    <div className="grid gap-4">
                      <RoundsSummaryCard result={result} />
                      <PearlsPanel />
                      <TimingHelperMini />
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bayesian">
              <BayesianSimulator />
            </TabsContent>
          </Tabs>
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
            <div className="text-muted-foreground text-right">v1 · © {currentYear} Vancomyzer®</div>
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

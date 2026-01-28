import React, { Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import DisclaimerGate from "@/components/DisclaimerGate";
import CalculatorForm from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import AucDoseSliderChart from "@/components/AucDoseSliderChart";
import ConcentrationTimeChart from "@/components/ConcentrationTimeChart";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { PkCalculateResponse, getVersion, type VersionResponse } from "@/lib/api";
import RoundsModeBar from "@/components/RoundsModeBar";
import PearlsPanel from "@/components/PearlsPanel";
import TimingHelperMini from "@/components/TimingHelperMini";
import { copyToClipboard, decodeShareState } from "@/lib/shareLink";

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
  const [trustDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [roundsMode, setRoundsMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("vancomyzer.roundsMode") === "1";
    } catch {
      return false;
    }
  });
  const [sharedRegimenText, setSharedRegimenText] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionResponse | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem("vancomyzer.roundsMode", roundsMode ? "1" : "0");
    } catch {
      // ignore
    }
  }, [roundsMode]);

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

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((v) => {
        if (!cancelled) setVersion(v);
      })
      .catch(() => {
        // ignore; footer will just omit version
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAdjust(update: { dose?: number; interval?: number }) {
    if (!result) return;
    const updated = { ...result };
    if (update.dose !== undefined) updated.maintenanceDoseMg = update.dose;
    if (update.interval !== undefined) updated.intervalHr = update.interval;
    setResult(updated);
  }

  async function onCopyRoundsSummary() {
    if (!result) return;
    const line = `Rounding summary: vanc ${Math.round(result.maintenanceDoseMg)} mg q${result.intervalHr}h (AUC24 ~ ${Math.round(result.auc24)}). Verify w/ protocol; no PHI.`;
    await copyToClipboard(line);
  }

  const targets = useMemo(() => ({ low: 400, high: 600 }), []);

  return (
    <DisclaimerGate>
      <div className="min-h-screen pb-24">
        <header className="px-4 py-3 border-b bg-background sticky top-0 z-30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Vancomyzer</span>
              <div className="text-xs text-muted-foreground hidden sm:block">Built for rounds</div>
            </div>
            <div className="flex items-center gap-3">
              <RoundsModeBar enabled={roundsMode} onChange={setRoundsMode} onCopyRoundsSummary={onCopyRoundsSummary} />
              <div className="hidden md:flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-green-100 text-green-700">AUC-based</span>
                <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">Guideline-aligned</span>
                <span className="px-2 py-1 rounded bg-neutral-100 text-neutral-700">No PHI stored</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto p-4">
          {sharedRegimenText && (
            <Alert className="mb-4">
              <div className="text-xs">{sharedRegimenText}</div>
            </Alert>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h1 className="text-xl font-semibold mb-3">Hit the AUC target—fast.</h1>
              <Alert className="border-warning bg-warning/10 text-warning-foreground mb-4">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <div className="text-xs">Clinical decision support only. Verify with institutional protocols.</div>
              </Alert>
              <CalculatorForm onResult={setResult} />
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
                  {roundsMode && (
                    <div className="grid gap-4">
                      <PearlsPanel />
                      <TimingHelperMini />
                    </div>
                  )}
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
              <span className="text-muted-foreground">
                v1 • Updated {trustDate}
                {version?.git ? ` • ${version.git}` : ""}
                {version?.built_at ? ` • ${new Date(version.built_at).toISOString().slice(0, 19)}Z` : ""}
              </span>
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

import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import DisclaimerGate from "@/components/DisclaimerGate";
import CalculatorForm, { type CalculatorFormHandle } from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import ConcentrationTimeChart from "@/components/ConcentrationTimeChart";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { decodeShareState } from "@/lib/shareLink";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BasicCalculateResponse, BayesianCalculateResponse, CalculateResponse } from "@/lib/api";

function HomePage() {
  const [result, setResult] = useState<BasicCalculateResponse | BayesianCalculateResponse | CalculateResponse | undefined>(undefined);
  const [mode, setMode] = useState<"basic" | "bayesian" | "educational">("basic");
  const [bayesLevels, setBayesLevels] = useState<Array<{ time_hr: number; concentration_mg_l: number }>>([]);
  const formRef = useRef<CalculatorFormHandle | null>(null);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [sharedRegimenText, setSharedRegimenText] = useState<string | null>(null);
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
              <div className="text-xs text-muted-foreground mt-1">Educational PK estimates only - not medical advice.</div>
              <div className="text-sm font-medium mt-2 text-sky-900">Hit that AUC target fast</div>
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
            <div className="text-xs">Educational PK estimates only - not medical advice. Verify with institutional protocols. No PHI stored.</div>
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
                onReset={() => {
                  setResult(undefined);
                  setMode("basic");
                  setBayesLevels([]);
                  setSharedRegimenText(null);
                }}
                onInputsChange={(payload) => {
                  if (payload.mode === "bayesian" && payload.levels) {
                    setBayesLevels(payload.levels);
                  }
                }}
              />
            </div>
            <div>
              <div id="dosing-panel-host" className="space-y-4" />
              <ResultsPanel
                mode={mode}
                result={result}
                onAdjustDose={(delta) => formRef.current?.adjustDose(delta)}
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
          <div className="max-w-6xl mx-auto p-3 text-xs">
            <div className="grid grid-cols-3 items-center">
              <div className="flex items-center gap-2 justify-start">
                <AlertTriangle className="h-3 w-3 text-warning" />
                <span>Safety + References</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <button className="underline" onClick={() => setReferencesOpen(true)}>References</button>
                <button className="underline" onClick={() => setDisclaimerOpen(true)}>Disclaimer</button>
                <button className="underline" onClick={() => setAboutOpen(true)}>About</button>
              </div>
              <div className="text-muted-foreground text-right">© {currentYear} Vancomyzer®</div>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground text-center">
              © 2026 Mario Cardenas, PharmD, MBA. All rights reserved. Do not copy, distribute, or otherwise disseminate without express permission.
            </div>
          </div>
        </footer>
      </div>
      <Dialog open={referencesOpen} onOpenChange={setReferencesOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>References</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <ol className="list-decimal ml-5 space-y-2">
              <li>
                Rybak MJ, Le J, Lodise TP, et al. Therapeutic monitoring of vancomycin for serious methicillin-resistant
                Staphylococcus aureus infections: a revised consensus guideline. Am J Health Syst Pharm. 2020;77(11):835-864.
                doi:10.1093/ajhp/zxaa036
              </li>
              <li>
                Liu C, Bayer A, Cosgrove SE, et al. Clinical practice guidelines by the Infectious Diseases Society of America
                for the treatment of methicillin-resistant Staphylococcus aureus infections. Clin Infect Dis. 2011;52(3):e18-e55.
                doi:10.1093/cid/ciq146
              </li>
              <li>
                Patel N, Pai MP, Rodvold KA, Lomaestro B, Drusano GL. Vancomycin: we can't get there from here.
                Clin Infect Dis. 2011;52(8):969-974. doi:10.1093/cid/cir078
              </li>
            </ol>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Disclaimer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              This software provides educational and informational pharmacokinetic estimates only. It does not provide medical
              advice, does not establish a clinician-patient relationship, and is not a substitute for professional judgment.
            </p>
            <p>
              Outputs depend entirely on the accuracy, completeness, and timing of user-entered data. Users are responsible for
              verifying results against institutional protocols, current clinical guidelines, and the full clinical context.
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>Use is limited to licensed healthcare professionals.</li>
              <li>No patient identifiers should be entered; no PHI is stored.</li>
              <li>No warranty is provided; accuracy and suitability are not guaranteed.</li>
              <li>This tool is not FDA-cleared and should not be relied upon as the sole basis for care decisions.</li>
              <li>In emergencies, follow institutional policies and standard of care.</li>
            </ul>
            <p>
              By using this software, you acknowledge and accept these limitations and agree to assume all responsibility for
              clinical decisions and outcomes.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>About</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Vancomyzer was built to make vancomycin dosing workflows more robust, reliable, and error-resistant while reducing
              recurring friction and variability at the bedside.
            </p>
            <p>
              Built by clinicians and engineers, the product reflects bedside realities paired with software rigor: transparent
              inputs, explicit assumptions, and reproducible outputs.
            </p>
            <p>
              The goal is clarity and consistency, not clinical validation claims, so teams can verify results quickly and align
              with institutional standards.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <button className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm">Close</button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DisclaimerGate>
  );
}

function App() {
  return <HomePage />;
}

export default App;

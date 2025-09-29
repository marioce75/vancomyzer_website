import { useState, useCallback, useMemo } from "react";
import { Patient, Regimen, PKOptions, calculatePK, calculateLoadingDose } from "@/pk/core";
import { Header } from "@/components/Header";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { PatientForm } from "@/components/PatientForm";
import { DosingForm } from "@/components/DosingForm";
import { OptionsPanel } from "@/components/OptionsPanel";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ConcentrationChart } from "@/components/ConcentrationChart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Info } from "lucide-react";

const Index = () => {
  // Default patient
  const [patient, setPatient] = useState<Patient>({
    age: 65,
    sex: 'M',
    weight: 80,
    height: 175,
    scr: 1.2
  });

  // Default regimen
  const [regimen, setRegimen] = useState<Regimen>({
    dose: 1000,
    interval: 12,
    infusionTime: 60
  });

  // Default options
  const [options, setOptions] = useState<PKOptions>({
    weightStrategy: 'Auto',
    scrPolicy: 'none',
    scrFloor: 0.7,
    aucMethod: 'doseCL',
    vdPerKg: 0.7,
    clOffset: 0,
    clScale: 1.0
  });

  // Calculate results with memoization for performance
  const pkResult = useMemo(() => {
    try {
      return calculatePK(patient, regimen, options);
    } catch (error) {
      console.error('PK calculation error:', error);
      return null;
    }
  }, [patient, regimen, options]);

  // Calculate loading dose suggestion
  const loadingDose = useMemo(() => {
    return calculateLoadingDose(patient);
  }, [patient]);

  const handleLoadingDoseApply = useCallback(() => {
    setRegimen(prev => ({ ...prev, dose: loadingDose }));
  }, [loadingDose]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <DisclaimerBanner />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Patient Input */}
          <div className="lg:col-span-1">
            <PatientForm patient={patient} onChange={setPatient} />
          </div>
          
          {/* Dosing Input */}
          <div className="lg:col-span-1">
            <DosingForm regimen={regimen} onChange={setRegimen} />
          </div>
          
          {/* Loading Dose Helper */}
          <div className="lg:col-span-1">
            <Card className="bg-gradient-to-br from-accent to-accent/50 shadow-card border-primary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-primary flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Loading Dose Helper
                </CardTitle>
                <CardDescription>
                  Suggested loading dose based on patient weight
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {loadingDose} mg
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Based on {(loadingDose / patient.weight).toFixed(1)} mg/kg
                  </div>
                </div>
                
                <Button 
                  onClick={handleLoadingDoseApply}
                  className="w-full"
                  variant="outline"
                >
                  Apply Loading Dose
                </Button>
                
                <div className="text-xs text-muted-foreground">
                  Typically 20-25 mg/kg TBW, rounded to nearest 250 mg
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Options Panel */}
        <div className="mb-8">
          <OptionsPanel options={options} onChange={setOptions} />
        </div>

        {/* Results and Chart */}
        {pkResult && (
          <div className="space-y-8">
            <ResultsPanel metrics={pkResult.metrics} />
            <ConcentrationChart data={pkResult.timeCourse} regimen={regimen} />
          </div>
        )}

        {/* Status and Method Info */}
        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                <Info className="h-3 w-3 mr-1" />
                Population PK Model
              </Badge>
              <Badge variant="secondary" className="text-xs">
                One-Compartment IV
              </Badge>
              <Badge variant="secondary" className="text-xs">
                Steady State
              </Badge>
            </div>
            
            <div className="text-sm text-muted-foreground">
              Model: Cockcroft-Gault • First-order elimination • Superposition principle
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer Disclaimer */}
      <footer className="border-t border-border bg-muted/30 py-6 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              <strong>IMPORTANT:</strong> This calculator is for educational purposes only and should not replace clinical judgment.
            </p>
            <p>
              Always follow institutional guidelines and consult with healthcare professionals before making dosing decisions.
              Individual patient factors may significantly affect vancomycin pharmacokinetics.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;

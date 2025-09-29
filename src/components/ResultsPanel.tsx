import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PKMetrics } from "@/pk/core";
import { CalculationMethod } from "./MethodSelector";

interface ResultsPanelProps {
  metrics: PKMetrics;
  targetAUC?: { min: number; max: number };
  method?: CalculationMethod;
  isLoadingBayesian?: boolean;
  levelsCount?: number;
}

export function ResultsPanel({ 
  metrics, 
  targetAUC = { min: 400, max: 600 },
  method = 'deterministic',
  isLoadingBayesian = false,
  levelsCount = 0
}: ResultsPanelProps) {
  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  const getAUCStatus = (auc: number) => {
    if (auc < targetAUC.min) return { label: 'Below Target', variant: 'destructive' as const };
    if (auc > targetAUC.max) return { label: 'Above Target', variant: 'warning' as const };
    return { label: 'On Target', variant: 'success' as const };
  };

  const aucStatus = getAUCStatus(metrics.auc24);

  return (
    <Card className="bg-gradient-to-br from-card to-primary/5 shadow-elevated border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          Pharmacokinetic Results
        </CardTitle>
        <CardDescription>
          {method === 'bayesian' 
            ? 'Bayesian predictions with uncertainty quantification'
            : method === 'levels' 
            ? `Individual PK fitting from ${levelsCount} measured level${levelsCount !== 1 ? 's' : ''}`
            : 'Steady-state predictions based on population pharmacokinetics'
          }
          {isLoadingBayesian && ' (Computing...)'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Primary Outcomes */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">
              Primary Outcomes
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">AUC₂₄</span>
                  <Badge variant={aucStatus.variant === 'success' ? 'default' : aucStatus.variant}>
                    {aucStatus.label}
                  </Badge>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatNumber(metrics.auc24, 0)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    mg·h/L
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target: {targetAUC.min}-{targetAUC.max} mg·h/L
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Peak (End-of-Infusion)</span>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(metrics.peak)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    mg/L
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Trough (Pre-dose)</span>
                <div className="text-xl font-bold text-foreground">
                  {formatNumber(metrics.trough)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    mg/L
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Patient Parameters */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">
              Patient Parameters
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Creatinine Clearance</span>
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber(metrics.crcl)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    mL/min
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Weight Used</span>
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber(metrics.weightUsed)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    kg
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* PK Parameters */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">
              PK Parameters
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Volume of Distribution</span>
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber(metrics.vd)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    L
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Clearance</span>
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber(metrics.cl)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    L/h
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <span className="text-muted-foreground text-sm">Half-life</span>
                <div className="text-lg font-semibold text-foreground">
                  {formatNumber((0.693 / metrics.k))}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    hours
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Results based on steady-state population pharmacokinetics using one-compartment model
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
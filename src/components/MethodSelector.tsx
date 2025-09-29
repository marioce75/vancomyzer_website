import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calculator, Activity, Brain, Info } from "lucide-react";

export type CalculationMethod = 'deterministic' | 'levels' | 'bayesian';

interface MethodSelectorProps {
  method: CalculationMethod;
  onChange: (method: CalculationMethod) => void;
  isBayesianOnline: boolean;
  hasLevels: boolean;
}

export function MethodSelector({ method, onChange, isBayesianOnline, hasLevels }: MethodSelectorProps) {
  const methods = [
    {
      id: 'deterministic' as const,
      name: 'Population PK',
      description: 'Population pharmacokinetics for initial estimates',
      icon: Calculator,
      available: true,
      recommended: !hasLevels
    },
    {
      id: 'levels' as const,
      name: 'Levels/EoIP',
      description: 'Individual PK fitting from measured levels',
      icon: Activity,
      available: hasLevels,
      recommended: hasLevels && !isBayesianOnline
    },
    {
      id: 'bayesian' as const,
      name: 'Bayesian',
      description: 'Bayesian optimization with uncertainty',
      icon: Brain,
      available: isBayesianOnline,
      recommended: hasLevels && isBayesianOnline
    }
  ];

  const currentMethod = methods.find(m => m.id === method);
  const IconComponent = currentMethod?.icon || Calculator;

  return (
    <Card className="bg-gradient-to-br from-card to-muted/30 shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-primary flex items-center gap-2">
          <IconComponent className="h-5 w-5" />
          Calculation Method
        </CardTitle>
        <CardDescription>
          Choose the pharmacokinetic calculation approach
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Method</Label>
          <Select value={method} onValueChange={onChange}>
            <SelectTrigger className="transition-all duration-200 focus:shadow-focus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {methods.map((methodOption) => (
                <SelectItem 
                  key={methodOption.id} 
                  value={methodOption.id}
                  disabled={!methodOption.available}
                >
                  <div className="flex items-center gap-2">
                    <methodOption.icon className="h-4 w-4" />
                    <span>{methodOption.name}</span>
                    {methodOption.recommended && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        Recommended
                      </Badge>
                    )}
                    {!methodOption.available && (
                      <Badge variant="outline" className="text-xs ml-2">
                        Unavailable
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {currentMethod?.description}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Badge 
              variant={method === 'deterministic' ? 'default' : 'outline'} 
              className="text-xs"
            >
              <Calculator className="h-3 w-3 mr-1" />
              Population PK
            </Badge>
            
            {hasLevels && (
              <Badge 
                variant={method === 'levels' ? 'default' : 'outline'} 
                className="text-xs"
              >
                <Activity className="h-3 w-3 mr-1" />
                Individual Fit
              </Badge>
            )}
            
            <Badge 
              variant={isBayesianOnline ? (method === 'bayesian' ? 'default' : 'secondary') : 'outline'} 
              className="text-xs"
            >
              <Brain className="h-3 w-3 mr-1" />
              Bayesian {!isBayesianOnline && '(Offline)'}
            </Badge>
          </div>

          {method === 'levels' && !hasLevels && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/20 rounded-md">
              <Info className="h-4 w-4 text-warning mt-0.5" />
              <div className="text-sm text-warning-foreground">
                <strong>No levels entered.</strong> Add measured vancomycin levels to use individual PK fitting.
              </div>
            </div>
          )}

          {method === 'bayesian' && !isBayesianOnline && (
            <div className="flex items-start gap-2 p-3 bg-muted border border-border rounded-md">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <strong>Bayesian API offline.</strong> Using population PK calculations instead.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}